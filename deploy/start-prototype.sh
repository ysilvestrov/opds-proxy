#!/usr/bin/env bash
# Run as the operator (not root) in a normal SSH terminal. Never enable production.
set -euo pipefail
set +x
umask 077
mode=${1:---check}
if [[ "$mode" == --help ]]; then
  echo 'Usage: bash deploy/start-prototype.sh [--check|--apply]'
  echo '--check: verify safety, exact CI/artifact and syntax; no sudo or startup.'
  echo '--apply: prompt for sudo, install independent infrastructure and start prototype.'
  exit 0
fi
[[ $# -le 1 && ( "$mode" == --check || "$mode" == --apply ) ]] || { echo 'STOP: invalid arguments' >&2; exit 64; }
die() { echo "STOP: $*" >&2; exit 1; }
[[ $EUID != 0 ]] || die 'Run as the normal operator, without sudo in front of this script.'
base=$(cd -- "${BASH_SOURCE[0]%/*}/.." && pwd)
cd "$base"
sha=16cc521448bbb792aa74594cf7c1c1def5ae16f9
unit=searchfloor-opds-prototype.service
production_guard() {
  local service state enabled
  for service in searchfloor-opds.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer; do
    state=$(systemctl show "$service" -p ActiveState --value) || die "Cannot inspect $service"
    [[ "$state" == inactive || "$state" == failed ]] || die "$service is $state"
  done
  enabled=$(systemctl show searchfloor-opds-deploy.timer -p UnitFileState --value) || die 'Cannot inspect timer enablement'
  case "$enabled" in ''|disabled|masked|static) ;; *) die "Production timer is $enabled" ;; esac
}
guard() {
  local state
  production_guard
  state=$(systemctl show "$unit" -p ActiveState --value) || die 'Cannot inspect prototype'
  [[ "$state" == inactive || "$state" == failed ]] || die "$unit is $state"
  # Includes IPv4/IPv6 and wildcard listeners, not just loopback.
  [[ $(ss -ltn 'sport = :8787' | wc -l) == 1 ]] || die 'Port 8787 is occupied'
}
guard
for tool in gh python3 node curl systemd-analyze visudo sudo; do command -v "$tool" >/dev/null || die "Missing $tool"; done
/usr/bin/python3 -c 'import sys; assert sys.version_info >= (3,12)'
[[ $(/usr/bin/node -p 'process.versions.node.split(".")[0]') == 24 ]] || die 'Node 24 required'
[[ $(uname -s) == Linux ]] || die 'Linux required'
bash -n deploy/bootstrap.sh
bash -n deploy/restart-helper.sh
systemd-analyze verify deploy/*.service deploy/*.timer
visudo -cf deploy/sudoers
bash deploy/bootstrap.sh --dry-run
stage=$(mktemp -d /home/ysi/opds/prototype-staging-16cc521/terminal-XXXXXX)
echo "Protected staging and sanitized evidence: $stage"
started=no
finish() {
  local code=$?
  if [[ $code != 0 && "$started" == yes ]]; then
    echo 'Validation failed; stopping only the prototype.' >&2
    sudo /usr/bin/systemctl stop "$unit" || echo 'STOP: operator must stop prototype manually' >&2
  fi
  if [[ $code != 0 ]]; then
    echo "Stopped with exit $code; staging preserved: $stage" >&2
    if [[ "$mode" == --apply ]]; then
      systemctl show "$unit" searchfloor-opds.service searchfloor-opds-deploy.timer -p Id -p LoadState -p ActiveState -p UnitFileState > "$stage/failed-state.txt" || true
      python3 - "$code" "$stage" <<'PY' || echo 'Could not append failure to prototype-report.md' >&2
import datetime,sys
from pathlib import Path
stage=Path(sys.argv[2])
with Path('docs/prototype-report.md').open('a') as f:
    f.write('\n## Failed operator terminal run — '+datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n\n')
    f.write('Exit '+sys.argv[1]+'. Installation may be partial; inspect before rerunning. No acceptance is claimed.\n')
    f.write('Protected evidence: `'+str(stage)+'`.\n\n')
    if (stage/'failed-state.txt').exists():
        f.write('```text\n'+(stage/'failed-state.txt').read_text()+'```\n')
PY
    fi
  fi
}
trap finish EXIT
gh api repos/ysilvestrov/opds-proxy/actions/workflows/374905819 > "$stage/workflow.json"
gh api repos/ysilvestrov/opds-proxy/actions/runs/37238876789 > "$stage/run.json"
gh api --paginate repos/ysilvestrov/opds-proxy/actions/runs/37238876789/jobs > "$stage/jobs.json"
gh api repos/ysilvestrov/opds-proxy/actions/artifacts/11316800751 > "$stage/artifact.json"
python3 - "$stage" "$sha" <<'PY'
import json,sys
from pathlib import Path
from datetime import datetime,timezone
p=Path(sys.argv[1]); sha=sys.argv[2]
load=lambda f: json.loads((p/f).read_text())
w,r,a=load('workflow.json'),load('run.json'),load('artifact.json')
assert (w['id'],w['name'],w['path'],w['state'])==(374905819,'OPDS CI','.github/workflows/ci.yml','active')
assert (r['id'],r['workflow_id'],r['head_sha'],r['head_branch'],r['event'],r['status'],r['conclusion'],r['head_repository']['full_name'])==(37238876789,374905819,sha,'feat/opds-v1','push','completed','success','ysilvestrov/opds-proxy')
# gh pagination emits adjacent JSON objects.
raw=(p/'jobs.json').read_text(); jobs=[]; decoder=json.JSONDecoder()
while raw.strip():
    obj,end=decoder.raw_decode(raw.lstrip()); jobs.extend(obj['jobs']); raw=raw.lstrip()[end:]
for name in ('test','typecheck','build','package'):
    matches=[j for j in jobs if j['name']==name]
    assert len(matches)==1 and matches[0]['status']=='completed' and matches[0]['conclusion']=='success',name
assert a['id']==11316800751 and a['name']=='opds-prototype-'+sha and not a['expired']
assert datetime.fromisoformat(a['expires_at'].replace('Z','+00:00'))>datetime.now(timezone.utc)
assert a['workflow_run']['id']==r['id'] and a['workflow_run']['head_sha']==sha and a['workflow_run']['head_branch']=='feat/opds-v1'
assert a['size_in_bytes']==7355075 and a['digest']=='sha256:44b0d9421087466537e7e1d73379575a0725a15f021aed833478053f490ae1de'
print('Exact workflow/run/jobs/artifact identity and expiry: PASS')
PY
gh api repos/ysilvestrov/opds-proxy/actions/artifacts/11316800751/zip > "$stage/artifact.zip"
python3 - "$stage/artifact.zip" <<'PY'
import hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]); assert p.stat().st_size==7355075
assert hashlib.sha256(p.read_bytes()).hexdigest()=='44b0d9421087466537e7e1d73379575a0725a15f021aed833478053f490ae1de'
PY
python3 scripts/safe-extract.py zip "$stage/artifact.zip" "$stage/wrapper"
python3 - "$stage/wrapper" <<'PY'
import hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]); expected='e681894680fbc8fec0ab14b453dcce9526e856a28b5d37b06243829fcf90984c'
assert (p/'release.tgz.sha256').read_text().split()==[expected,'release.tgz']
assert hashlib.sha256((p/'release.tgz').read_bytes()).hexdigest()==expected
PY
python3 scripts/safe-extract.py tar "$stage/wrapper/release.tgz" "$stage/extracted"
OPDS_TERMINAL_STAGE="$stage" /usr/bin/node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
import {compatibleManifest} from './scripts/artifact.mjs';
const m=JSON.parse(readFileSync(process.env.OPDS_TERMINAL_STAGE+'/extracted/release.json','utf8'));
const host={arch:process.arch,nodeAbi:process.versions.modules,glibcVersion:process.report.getReport().header.glibcVersionRuntime};
if(!compatibleManifest(m,'16cc521448bbb792aa74594cf7c1c1def5ae16f9',host))throw Error('Incompatible host manifest');
console.log('Wrapper/tar checksums, safe extraction and host manifest: PASS');
JS
systemctl show warsaw-beer-bot.service -p ActiveState -p SubState -p NRestarts > "$stage/bot-before.txt"
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/health > "$stage/bot-health-before.json"
python3 - "$stage/bot-health-before.json" <<'PY'
import json,sys
assert json.load(open(sys.argv[1])).get('ok') is True
PY
if [[ "$mode" == --check ]]; then echo 'CHECK PASSED. No sudo/install/start performed. Run again with --apply in your terminal.'; exit 0; fi
[[ -t 0 && -t 1 ]] || die '--apply needs an interactive private terminal'
sudo -v
guard
sudo /usr/bin/bash "$base/deploy/bootstrap.sh" --apply
# Root executes only reviewed infrastructure/stdlib code, never application code.
sudo /usr/bin/python3 - "$base" "$stage" "$sha" <<'PY'
import hashlib,json,os,secrets,stat,subprocess,sys,tempfile
from pathlib import Path
base,stage,sha=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3]
root=Path('/opt/searchfloor-opds/prototype'); target=root/sha; current=root/'current'
for p in [Path('/opt'),Path('/opt/searchfloor-opds'),root,Path('/etc/searchfloor-opds')]:
    assert p.is_dir() and not p.is_symlink(),f'Unsafe parent: {p}'
assert not os.path.lexists(target) and not os.path.lexists(current),'Prototype installation/current collision; inspect manually'
env=Path('/etc/searchfloor-opds/prototype.env')
assert env.is_file() and not env.is_symlink() and env.stat().st_uid==0 and stat.S_IMODE(env.stat().st_mode)==0o600
template=(base/'deploy/prototype.env.example').read_text()
existing=env.read_text()
if existing!=template:
    values=dict(line.split('=',1) for line in existing.splitlines() if line and not line.startswith('#'))
    assert values.get('PUBLIC_BASE_URL')=='https://opds.ysilvestrov-ai.uk' and values.get('PORT')=='8787'
    assert values.get('CACHE_PATH')=='/var/lib/searchfloor-opds/prototype-cache/catalog.sqlite'
    assert values.get('OPDS_USERNAME') and values.get('OPDS_PASSWORD') and not any('REPLACE_' in v for v in values.values())
# Re-copy and hash archive under a root-owned temporary directory before extraction.
with tempfile.TemporaryDirectory(prefix='.install-',dir=root) as tmp:
    tmp=Path(tmp); archive=tmp/'artifact.zip'
    archive.write_bytes((stage/'artifact.zip').read_bytes())
    assert hashlib.sha256(archive.read_bytes()).hexdigest()=='44b0d9421087466537e7e1d73379575a0725a15f021aed833478053f490ae1de'
    subprocess.run(['/usr/bin/python3',str(base/'scripts/safe-extract.py'),'zip',str(archive),str(tmp/'wrapper')],check=True)
    tar=tmp/'wrapper/release.tgz'; digest=hashlib.sha256(tar.read_bytes()).hexdigest()
    assert digest=='e681894680fbc8fec0ab14b453dcce9526e856a28b5d37b06243829fcf90984c'
    assert (tmp/'wrapper/release.tgz.sha256').read_text().split()==[digest,'release.tgz']
    subprocess.run(['/usr/bin/python3',str(base/'scripts/safe-extract.py'),'tar',str(tar),str(tmp/'code')],check=True)
    assert json.loads((tmp/'code/release.json').read_text())['sha']==sha
    os.rename(tmp/'code',target)
    link=tmp/'current'; link.symlink_to(target); os.rename(link,current)
if existing==template:
    content=('PUBLIC_BASE_URL=https://opds.ysilvestrov-ai.uk\nPORT=8787\n'
             'CACHE_PATH=/var/lib/searchfloor-opds/prototype-cache/catalog.sqlite\n'
             'OPDS_USERNAME=opds-prototype\nOPDS_PASSWORD='+secrets.token_urlsafe(36)+'\n')
    fd,name=tempfile.mkstemp(prefix='.prototype-',dir=env.parent)
    try:
        with os.fdopen(fd,'w') as f: f.write(content)
        os.chmod(name,0o600); os.replace(name,env)
    finally:
        if os.path.exists(name): os.unlink(name)
print('Root-owned immutable code/current installed; prototype.env prepared or preserved. Credentials not printed.')
PY
guard
started=yes
sudo /usr/bin/systemctl start "$unit"
sudo /usr/bin/python3 - <<'PY' | /usr/bin/python3 scripts/diagnostics/record-jsonl.py "$stage/http-checks.jsonl"
import base64,json,subprocess,time,xml.etree.ElementTree as ET
from urllib.parse import urlsplit
from pathlib import Path
sha='16cc521448bbb792aa74594cf7c1c1def5ae16f9'
values=dict(line.split('=',1) for line in Path('/etc/searchfloor-opds/prototype.env').read_text().splitlines() if line and not line.startswith('#'))
auth=base64.b64encode((values['OPDS_USERNAME']+':'+values['OPDS_PASSWORD']).encode()).decode()
def get(url,authenticated=False):
    config='header = "Authorization: Basic '+auth+'"\n' if authenticated else ''
    r=subprocess.run(['/usr/bin/curl','--silent','--show-error','--max-time','30','--dump-header','-','--config','-','--url',url],input=config.encode(),capture_output=True)
    endpoint=urlsplit(url)
    evidence={'time':time.time(),'origin':endpoint.scheme+'://'+endpoint.netloc,'path':endpoint.path,'authenticated':authenticated,'transportExitCode':r.returncode}
    if r.returncode!=0:
        print(json.dumps(evidence),flush=True)
    assert r.returncode==0,'HTTP transport failed (details suppressed)'
    raw=r.stdout
    # Drop proxy/interim blocks, if present.
    while True:
        head,body=raw.split(b'\r\n\r\n',1)
        if body.startswith(b'HTTP/'): raw=body; continue
        break
    lines=head.decode('latin1').splitlines(); status=int(lines[0].split()[1])
    headers=dict(line.split(':',1) for line in lines[1:] if ':' in line)
    headers={k.lower():v.strip() for k,v in headers.items()}
    evidence.update(status=status,mime=headers.get('content-type'),basicChallenge=headers.get('www-authenticate','').lower().startswith('basic'))
    print(json.dumps(evidence),flush=True)
    return status,headers,body
deadline=time.monotonic()+15
while True:
    try:
        status,_,body=get('http://127.0.0.1:8787/health')
        health=json.loads(body)
        if status==200 and health.get('ready') is True and health.get('sha')==sha: break
    except Exception: pass
    assert time.monotonic()<deadline,'Exact-SHA readiness failed'
    time.sleep(0.5)
checks=[]
for origin in ['http://127.0.0.1:8787','https://opds.ysilvestrov-ai.uk']:
    for path in ['/opds','/opds/searchfloor','/opds/searchfloor/opensearch.xml','/opds/searchfloor/completed','/opds/searchfloor/search?q=test','/opds/searchfloor/books/1/download.fb2.zip']:
        status,headers,_=get(origin+path)
        assert status==401 and headers.get('www-authenticate','').lower().startswith('basic'),f'Basic check failed: {origin}{path}, HTTP {status}'
        checks.append({'origin':origin,'path':urlsplit(path).path,'unauthenticated':401})
    for path,mime in [('/opds','application/atom+xml'),('/opds/searchfloor','application/atom+xml'),('/opds/searchfloor/opensearch.xml','application/opensearchdescription+xml')]:
        status,headers,body=get(origin+path,True)
        assert status==200 and headers.get('content-type','').startswith(mime),f'XML/MIME check failed: {origin}{path}, HTTP {status}'
        root=ET.fromstring(body)
        for element in root.iter():
            href=element.get('href') or (element.get('template') if element.tag.endswith('Url') else None)
            if href: assert href.startswith('https://opds.ysilvestrov-ai.uk/'),'Wrong absolute link'
        checks.append({'origin':origin,'path':path,'authenticated':200,'xml':True,'mime':mime})
# Two bounded live requests through HTTPS; no next-page crawl or book GET.
for path in ['/opds/searchfloor/completed?page=1','/opds/searchfloor/search?q=%D0%98%D0%BD%D0%B8%D1%86%D0%B8%D0%B0%D1%86%D0%B8%D1%8F&page=1']:
    status,headers,body=get('https://opds.ysilvestrov-ai.uk'+path,True)
    assert status==200 and headers.get('content-type','').startswith('application/atom+xml'),f'Live catalog failed: HTTP {status}'
    root=ET.fromstring(body)
    checks.append({'path':urlsplit(path).path,'authenticated':200,'entries':len(root.findall('{http://www.w3.org/2005/Atom}entry'))})
print(json.dumps({'sha':sha,'checks':checks}))
PY
systemctl show warsaw-beer-bot.service -p ActiveState -p SubState -p NRestarts > "$stage/bot-after.txt"
cmp "$stage/bot-before.txt" "$stage/bot-after.txt" || die 'Bot state/NRestarts changed'
production_guard
[[ $(systemctl show "$unit" -p ActiveState --value) == active ]] || die 'Prototype is no longer active'
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/health > "$stage/bot-health-after.json"
python3 - "$stage/bot-health-after.json" <<'PY'
import json,sys
assert json.load(open(sys.argv[1])).get('ok') is True
PY
systemctl show "$unit" -p ActiveState -p SubState -p NRestarts -p MemoryCurrent -p CPUUsageNSec > "$stage/runtime.txt"
sudo /usr/bin/python3 - <<'PY' > "$stage/rss.json"
import json,subprocess
from pathlib import Path
pid=int(subprocess.check_output(['/usr/bin/systemctl','show','searchfloor-opds-prototype.service','-p','MainPID','--value']))
assert pid>0,'Prototype has no MainPID'
rss=next(line.split(':',1)[1].strip() for line in Path(f'/proc/{pid}/status').read_text().splitlines() if line.startswith('VmRSS:'))
print(json.dumps({'pid':pid,'VmRSS':rss}))
PY
sudo /usr/bin/python3 - <<'PY' > "$stage/cache.json"
import json
from pathlib import Path
p=Path('/var/lib/searchfloor-opds/prototype-cache')
print(json.dumps({name:(p/name).stat().st_size if (p/name).exists() else 0 for name in ['catalog.sqlite','catalog.sqlite-wal','catalog.sqlite-shm']}))
PY
python3 - "$stage" <<'PY'
import datetime,json,sys
from pathlib import Path
p=Path(sys.argv[1])
with Path('docs/prototype-report.md').open('a') as f:
    f.write('\n## Operator terminal run — '+datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n\n')
    f.write('Pinned prototype installed and running manually. HTTP/Basic/XML checks passed.\n')
    f.write('Evidence directory: `'+str(p)+'`. FBReader/ZIP open and protected fixture remain Pending.\n\n')
    for name in ['bot-before.txt','bot-after.txt','runtime.txt','rss.json','cache.json','http-checks.jsonl']:
        f.write(name+'\n```text\n'+(p/name).read_text().strip()+'\n```\n\n')
PY
echo 'HTTPS prototype ready: https://opds.ysilvestrov-ai.uk/opds'
echo 'Credentials: retrieve /etc/searchfloor-opds/prototype.env via sudo in your private terminal; never paste into logs/chat.'
echo 'Reader acceptance remains pending. Prototype is left running for your device test, with no boot enablement.'
echo 'When finished: sudo systemctl stop searchfloor-opds-prototype.service'
echo 'Production/timer were not started or enabled; Cloudflare routes were not changed.'
