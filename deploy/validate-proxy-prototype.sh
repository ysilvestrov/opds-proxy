#!/usr/bin/env bash
# One manual acceptance session. Always stop prototype; rollback on failure.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/validate-proxy-prototype.sh'
  echo 'Activate pinned prototype, verify private feeds and one ZIP in memory, then stop.'
  echo 'Failure restores baseline pointer/pre-proxy config. Production/timer unchanged.'
  exit 0
fi
[[ $# == 0 && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'STOP: run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
for unit in searchfloor-opds.service searchfloor-opds-prototype.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer; do
  [[ $(systemctl show "$unit" -p ActiveState --value) == inactive ]] || { echo "STOP: $unit must be inactive." >&2; exit 1; }
done
[[ $(systemctl show searchfloor-opds-deploy.timer -p UnitFileState --value) == disabled ]] || { echo 'STOP: production timer must be disabled.' >&2; exit 1; }
[[ $(ss -ltn 'sport = :8787' | wc -l) == 1 ]] || { echo 'STOP: port8787 occupied.' >&2; exit 1; }
evidence=$(mktemp -d /home/ysi/opds/proxy-acceptance-checks-XXXXXX)
echo "Sanitized acceptance evidence: $evidence/checks.jsonl"
sudo -v
sudo /usr/bin/python3 - <<'PY' | python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
import base64
import datetime
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile

SHA='e57f0a6d33799593afc594a8adefabfa46ee6341'
OLD='16cc521448bbb792aa74594cf7c1c1def5ae16f9'
ROOT=Path('/opt/searchfloor-opds/prototype')
ENV=Path('/etc/searchfloor-opds/prototype.env')
UNIT='searchfloor-opds-prototype.service'
NS='{http://www.w3.org/2005/Atom}'
phase='guards'


def emit(row):
    print(json.dumps(dict(time=datetime.datetime.now(datetime.timezone.utc).isoformat(),**row)),flush=True)


def show(unit, properties):
    args=['/usr/bin/systemctl','show',unit]
    for prop in properties:args+=['-p',prop]
    return dict(line.split('=',1) for line in subprocess.check_output(args,text=True).splitlines())


def inspect_zip(data, unpacked_limit=32*1024*1024):
    if len(data)>20*1024*1024 or not data.startswith(b'PK\x03\x04'):raise ValueError('ZIP signature/limit')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members=archive.infolist()
        fb2=[entry for entry in members if not entry.is_dir() and entry.filename.lower().endswith('.fb2')]
        if len(members)>64 or len(fb2)!=1 or fb2[0].file_size>unpacked_limit:raise ValueError('FB2 limits')
        count=0;prefix=b''
        with archive.open(fb2[0]) as stream:
            while chunk:=stream.read(65536):
                count+=len(chunk)
                if count>unpacked_limit:raise ValueError('FB2 expanded limit')
                if len(prefix)<4096:prefix=(prefix+chunk)[:4096]
        if b'<FictionBook' not in prefix:raise ValueError('FB2 header')
    return True


def resources(label):
    properties=['ActiveState','SubState','NRestarts','MemoryCurrent','MemoryPeak','CPUUsageNSec','MainPID']
    runtime=show(UNIT,properties)
    pid=int(runtime.get('MainPID','0'))
    rss=None
    if pid:
        rss=next((line.split(':',1)[1].strip() for line in Path(f'/proc/{pid}/status').read_text().splitlines() if line.startswith('VmRSS:')),None)
    fs=os.statvfs('/')
    available=next(int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
    cache=Path('/var/lib/searchfloor-opds/prototype-cache')
    emit({'check':'resources','label':label,'runtime':runtime,'VmRSS':rss,'ramAvailableBytes':available,'diskAvailableBytes':fs.f_bavail*fs.f_frsize,'freeInodes':fs.f_favail,
          'cacheBytes':{name:(cache/name).stat().st_size if (cache/name).exists() else 0 for name in ['catalog.sqlite','catalog.sqlite-wal','catalog.sqlite-shm']},
          'retainedCodeLogicalBytes':{sha:sum(p.stat().st_size for p in (ROOT/sha).rglob('*') if p.is_file()) for sha in [OLD,SHA]}})


def bot_health():
    state=show('warsaw-beer-bot.service',['ActiveState','SubState','NRestarts'])
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open('http://127.0.0.1:3000/health',timeout=5) as response:
        status=response.status;health=json.loads(response.read(4096))
    if status!=200 or health.get('ok') is not True or state['ActiveState']!='active':raise ValueError('Bot health')
    emit({'check':'bot-health','status':status,'ok':True,**state})
    return state


def atomic_pointer(sha):
    link=ROOT/('.current-proxy-'+uuid.uuid4().hex)
    if os.path.lexists(link):raise ValueError('Temporary pointer exists')
    try:
        link.symlink_to(ROOT/sha)
        os.replace(link,ROOT/'current')
    finally:
        if os.path.lexists(link):link.unlink()


def restore_config(backup):
    fd,name=tempfile.mkstemp(prefix='.prototype.env.restore-',dir=ENV.parent)
    try:
        with os.fdopen(fd,'wb') as output:
            output.write(backup.read_bytes());output.flush();os.fsync(output.fileno())
        os.replace(name,ENV)
    finally:
        if os.path.exists(name):os.unlink(name)


def download_once(config, url, fetch):
    auth='Basic '+base64.b64encode((config['OPDS_USERNAME']+':'+config['OPDS_PASSWORD']).encode()).decode()
    row={'check':'one-acquisition','valid':False,'branch':'full-file-validation','serverCancellationExercised':False,'transport':'system-curl-default-UA'}
    previous=signal.signal(signal.SIGALRM,lambda *_:(_ for _ in ()).throw(TimeoutError('Deadline')))
    signal.setitimer(signal.ITIMER_REAL,60)
    try:
        status,headers,body=fetch(url,auth,timeout=60,limit=20*1024*1024,accept='application/zip')
        row['status']=status
        mime=headers.get('content-type','').split(';')[0].strip().lower()
        if status!=200 or mime!='application/zip':raise ValueError('Acquisition response')
        row['zipBytes']=len(body)
        row['fb2Present']=inspect_zip(body)
        row['valid']=True
    except Exception:
        row['failure']='acquisition'
        raise
    finally:
        signal.setitimer(signal.ITIMER_REAL,0);signal.signal(signal.SIGALRM,previous)
        emit(row)


def main():
    global phase
    if os.geteuid()!=0:raise ValueError('Root required')
    spec=importlib.util.spec_from_file_location('verifier','scripts/verify-existing-prototype.py')
    verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)
    current=ROOT/'current'
    if not current.is_symlink() or current.resolve()!=ROOT/OLD:raise ValueError('Baseline pointer')
    for sha in [OLD,SHA]:
        code=ROOT/sha
        if code.is_symlink() or code.lstat().st_uid!=0 or json.loads((code/'release.json').read_text())['sha']!=sha:raise ValueError('Immutable identity')
    for unit in [UNIT,'searchfloor-opds.service','searchfloor-opds-deploy.service','searchfloor-opds-deploy.timer']:
        if show(unit,['ActiveState'])['ActiveState']!='inactive':raise ValueError('Unit collision')
    if show('searchfloor-opds-deploy.timer',['UnitFileState'])['UnitFileState']!='disabled':raise ValueError('Timer enabled')
    if len(subprocess.check_output(['/usr/bin/ss','-ltn','sport = :8787'],text=True).splitlines())!=1:raise ValueError('Port collision')
    config=verifier.load_private_config()
    if not config.get('OPDS_SOURCE_PROXY_URL'):raise ValueError('Independent proxy required')
    backups=sorted(ENV.parent.glob('.prototype.env.before-proxy-*'),key=lambda p:p.stat().st_mtime_ns)
    if not backups:raise ValueError('Rollback backup missing')
    backup=backups[-1]
    prior=verifier.load_private_config(backup)
    if config!=dict(prior,OPDS_SOURCE_PROXY_URL=config['OPDS_SOURCE_PROXY_URL']):raise ValueError('Backup mismatch')
    # Preconditions: the prior terminal probe is captured and committed by the agent.
    rows=[json.loads(line) for line in Path('docs/proxy-prototype-dedicated-source.jsonl').read_text().splitlines()]
    if not any(r.get('check')=='dedicated-source-get' and r.get('valid') is True and r.get('status')==200 for r in rows):raise ValueError('Dedicated source evidence required')
    before=bot_health();resources('before')
    switched=False;started=False;passed=False
    journal_start=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    try:
        phase='activate'
        if current.resolve()!=ROOT/OLD:raise ValueError('Pointer changed')
        atomic_pointer(SHA);switched=True
        started=True
        subprocess.run(['/usr/bin/systemctl','start',UNIT],check=True)
        phase='readiness'
        deadline=time.monotonic()+15
        while True:
            try:
                opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
                with opener.open('http://127.0.0.1:8787/health',timeout=1) as response:
                    health=json.loads(response.read(4096));valid=response.status==200 and health.get('ready') is True and health.get('sha')==SHA
                emit({'check':'startup-readiness','valid':valid})
                if valid:break
            except Exception:emit({'check':'startup-readiness','valid':False,'failure':'not-ready'})
            if time.monotonic()>=deadline:raise ValueError('Readiness deadline')
            time.sleep(0.25)
        resources('after-readiness')
        phase='private-feeds'
        emit({'check':'acceptance-transport','client':'system-curl-default-UA','automaticFallback':False})
        completed=[]
        def fetch(url, authorization):
            result=verifier.request_curl(url,authorization)
            if url.endswith('/opds/searchfloor/completed?page=1') and authorization and result[0]==200:completed.append(result[2])
            return result
        verifier.verify(config,SHA,live=True,fetch=fetch)
        phase='one-acquisition'
        feed=ET.fromstring(completed[0]);base=urllib.parse.urlsplit(config['PUBLIC_BASE_URL'].rstrip('/'))
        acquisition=None
        for entry in feed.findall(NS+'entry'):
            for link in entry.findall(NS+'link'):
                if link.get('rel')!='http://opds-spec.org/acquisition':continue
                url=link.get('href','');target=urllib.parse.urlsplit(url)
                if target.scheme==base.scheme and target.netloc==base.netloc and not target.query and not target.fragment and re.fullmatch(re.escape(base.path)+r'/opds/searchfloor/books/[0-9]+/download\.fb2\.zip',target.path):
                    acquisition=url;break
            if acquisition:break
        if not acquisition:raise ValueError('Listed acquisition missing')
        download_once(config,acquisition,verifier.request_curl)
        phase='runtime-resources'
        resources('during')
        if bot_health()!=before:raise ValueError('Bot state changed')
        passed=True
    finally:
        if started:
            phase_before_stop=phase
            phase='stop-prototype'
            subprocess.run(['/usr/bin/systemctl','stop',UNIT],check=True)
            if show(UNIT,['ActiveState'])['ActiveState']!='inactive':raise ValueError('Prototype did not stop')
            phase=phase_before_stop
        try:
            # Only structured allowlisted lifecycle events; never raw journal messages.
            raw=subprocess.check_output(['/usr/bin/journalctl','-u',UNIT,'--since',journal_start,'-o','json','--no-pager'],text=True)
            for line in raw.splitlines():
                try:
                    message=json.loads(json.loads(line).get('MESSAGE',''))
                    if message.get('event') in ['listening','started','stopped','cache_reset']:
                        emit({'check':'runtime-event','event':message['event']})
                except (ValueError,AttributeError):pass
            resources('after-stop')
            after=bot_health()
            if after!=before:raise ValueError('Bot state changed')
            states={unit:show(unit,['ActiveState','UnitFileState']) for unit in [UNIT,'searchfloor-opds.service','searchfloor-opds-deploy.service','searchfloor-opds-deploy.timer']}
            free=len(subprocess.check_output(['/usr/bin/ss','-ltn','sport = :8787'],text=True).splitlines())==1
            valid=free and all(s['ActiveState']=='inactive' for s in states.values()) and states['searchfloor-opds-deploy.timer']['UnitFileState']=='disabled'
            emit({'check':'final-state','valid':valid,'units':states,'port8787Free':free,'currentSha':current.resolve().name})
            if not valid:raise ValueError('Final state')
        except Exception:
            passed=False
            raise
        finally:
            if switched and not passed:
                atomic_pointer(OLD);restore_config(backup)
                verifier.load_private_config()
                emit({'check':'rollback','pointerRestored':current.resolve()==ROOT/OLD,'privateConfigRestored':True,'baselineLeftStopped':True})
    emit({'check':'acceptance-summary','valid':True,'prototypeStopped':True,'readerAcceptance':'pending','providerUsageAfter':'pending dashboard snapshot'})


if __name__=='__main__':
    try:main()
    except Exception as error:
        emit({'check':'acceptance-summary','valid':False,'phase':phase,'failure':type(error).__name__})
        raise SystemExit(1) from None
PY
