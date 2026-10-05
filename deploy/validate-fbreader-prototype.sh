#!/usr/bin/env bash
# One manual acceptance session. Always stop prototype; rollback on failure.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/validate-fbreader-prototype.sh'
  echo 'Activate pinned prototype, verify private feeds and FB2 acquisition link MIME, then stop.'
  echo 'Failure restores baseline pointer/unchanged private config. Production/timer unchanged.'
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
evidence=$(mktemp -d /home/ysi/opds/fbreader-acceptance-checks-XXXXXX)
echo "Sanitized acceptance evidence: $evidence/checks.jsonl"
sudo -v
sudo /usr/bin/python3 - <<'PY' | python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
import base64
import datetime
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET

SHA='c22ac2e6edafeba1563d88363326b2bd19cbb097'
OLD='e57f0a6d33799593afc594a8adefabfa46ee6341'
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


def inspect_acquisition_links(data, public_base):
    feed=ET.fromstring(data)
    if feed.tag!=NS+'feed':raise ValueError('Not Atom feed')
    base=urllib.parse.urlsplit(public_base.rstrip('/'))
    entries=feed.findall(NS+'entry')
    if not entries:raise ValueError('No listed books')
    count=0
    for entry in entries:
        links=[link for link in entry.findall(NS+'link') if link.get('rel')=='http://opds-spec.org/acquisition']
        if len(links)!=1 or links[0].get('type')!='application/fb2+zip':raise ValueError('Acquisition MIME/count')
        target=urllib.parse.urlsplit(links[0].get('href',''))
        if target.scheme!=base.scheme or target.netloc!=base.netloc or target.query or target.fragment or not re.fullmatch(re.escape(base.path)+r'/opds/searchfloor/books/[0-9]+/download\.fb2\.zip',target.path):raise ValueError('Acquisition URL')
        count+=1
    return count


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
    # Snapshot the current independent proxy/Basic config, not the old pre-proxy backup.
    fd,backup_name=tempfile.mkstemp(prefix='.prototype.env.before-mime-',dir=ENV.parent)
    backup=Path(backup_name)
    with os.fdopen(fd,'wb') as output:
        output.write(ENV.read_bytes());output.flush();os.fsync(output.fileno())
    if verifier.load_private_config(backup)!=config:raise ValueError('Backup mismatch')
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
        def fetch(url, authorization):
            result=verifier.request_curl(url,authorization)
            return result
        verifier.verify(config,SHA,live=False,fetch=fetch)
        phase='fbreader-link-mime'
        auth='Basic '+base64.b64encode((config['OPDS_USERNAME']+':'+config['OPDS_PASSWORD']).encode()).decode()
        status,headers,body=verifier.request_curl(config['PUBLIC_BASE_URL'].rstrip('/')+'/opds/searchfloor/completed?page=1',auth)
        if status!=200 or headers.get('content-type','').split(';')[0]!='application/atom+xml':raise ValueError('Completed feed')
        count=inspect_acquisition_links(body,config['PUBLIC_BASE_URL'])
        emit({'check':'fbreader-acquisition-links','valid':True,'status':status,'bytes':len(body),'books':count,'mime':'application/fb2+zip','bookDownloads':0})
        if ENV.read_bytes()!=backup.read_bytes():raise ValueError('Private config changed')
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
            if ENV.read_bytes()!=backup.read_bytes():raise ValueError('Private config changed')
        except Exception:
            passed=False
            raise
        finally:
            if switched and not passed:
                atomic_pointer(OLD);restore_config(backup)
                verifier.load_private_config()
                emit({'check':'rollback','pointerRestored':current.resolve()==ROOT/OLD,'privateConfigRestored':True,'baselineLeftStopped':True})
    emit({'check':'acceptance-summary','valid':True,'prototypeStopped':True,'readerAcceptance':'pending','bookDownloads':0,'privateConfigPreserved':ENV.read_bytes()==backup.read_bytes()})


if __name__=='__main__':
    try:main()
    except Exception as error:
        emit({'check':'acceptance-summary','valid':False,'phase':phase,'failure':type(error).__name__})
        raise SystemExit(1) from None
PY
