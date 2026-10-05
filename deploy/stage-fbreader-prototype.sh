#!/usr/bin/env bash
# Stage pinned FBReader MIME code and a synthetic acquisition check. Never switch current/start units.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/stage-fbreader-prototype.sh [--check]'
  echo 'Verify pinned CI, copy immutable code, test native module and synthetic acquisition MIME.'
  echo 'No current switch/service start. No source requests or configuration changes.'
  exit 0
fi
mode=${1:---apply}
[[ $# -le 1 && ( $mode == --apply || $mode == --check ) && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'STOP: run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
for unit in searchfloor-opds.service searchfloor-opds-prototype.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer; do
  [[ $(systemctl show "$unit" -p ActiveState --value) == inactive ]] || { echo "STOP: $unit must be inactive." >&2; exit 1; }
done
[[ $(systemctl show searchfloor-opds-deploy.timer -p UnitFileState --value) == disabled ]] || { echo 'STOP: production timer must be disabled.' >&2; exit 1; }
[[ $(ss -ltn 'sport = :8787' | wc -l) == 1 ]] || { echo 'STOP: port8787 occupied.' >&2; exit 1; }
python3 - <<'CHECK'
import datetime,json,subprocess
sha='c22ac2e6edafeba1563d88363326b2bd19cbb097'
def api(path): return json.loads(subprocess.check_output(['gh','api','repos/ysilvestrov/opds-proxy/'+path]))
r=api('actions/runs/37331575252');a=api('actions/artifacts/11354194358')
jobs=api('actions/runs/37331575252/jobs?per_page=100')['jobs']
assert (r['workflow_id'],r['head_sha'],r['head_branch'],r['event'],r['status'],r['conclusion'],r['head_repository']['full_name'])==(374905819,sha,'feat/opds-v1','push','completed','success','ysilvestrov/opds-proxy')
for name in ['test','typecheck','build','package']:
    matching=[j for j in jobs if j['name']==name]
    assert len(matching)==1 and matching[0]['status']=='completed' and matching[0]['conclusion']=='success'
assert a['workflow_run']['id']==r['id'] and a['workflow_run']['head_sha']==sha
assert a['name']=='opds-prototype-'+sha and not a['expired'] and a['size_in_bytes']==7361261
assert a['digest']=='sha256:fdce84ccea1a89672b2e7ae114c1e7bb93953f239e901917dd2d75d6a0c747a3'
assert datetime.datetime.fromisoformat(a['expires_at'].replace('Z','+00:00'))>datetime.datetime.now(datetime.timezone.utc)
print('Pinned feature CI/artifact identity and expiry: PASS')
CHECK
evidence=$(mktemp -d /home/ysi/opds/fbreader-stage-checks-XXXXXX)
echo "Sanitized staging checks: $evidence/checks.jsonl"
if [[ $mode == --apply ]]; then
  gh api repos/ysilvestrov/opds-proxy/actions/artifacts/11354194358/zip > "$evidence/artifact.zip"
fi
sudo -v
sudo /usr/bin/python3 - "$mode" "$evidence" <<'PY' | python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
import hashlib
import json
import os
from pathlib import Path
import subprocess
import signal
import tempfile
import sys
import pwd

SHA='c22ac2e6edafeba1563d88363326b2bd19cbb097'
BASELINE='e57f0a6d33799593afc594a8adefabfa46ee6341'
WRAPPER='fdce84ccea1a89672b2e7ae114c1e7bb93953f239e901917dd2d75d6a0c747a3'
TAR='02c6cf1b01ed98ac2467d79710817d47b9eef9d64e21e400a01b49dc599b3ace'
stage='guards'


class GuardFailure(ValueError):
    def __init__(self, reason, details=None):
        self.reason=reason
        self.details=details or {}


def validate_parent(parent, allowed_owners=(0,)):
    info=parent.lstat()
    if not parent.is_dir() or parent.is_symlink() or info.st_uid not in allowed_owners or info.st_mode & 0o022:
        raise GuardFailure('unsafe-code-parent',{'path':str(parent),'uid':info.st_uid,'gid':info.st_gid,'mode':oct(info.st_mode & 0o777)})


def verify_digest(path, expected):
    if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
        raise ValueError('Artifact checksum mismatch')


def run_runtime(program, environment):
    process=subprocess.Popen(['/usr/sbin/runuser','-u','searchfloor-opds','--','/usr/bin/node','--input-type=module','-'],
                             stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,
                             text=True,env=environment,start_new_session=True)
    try:
        output,_=process.communicate(program,timeout=20)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid,signal.SIGKILL)
        output,_=process.communicate()
    return subprocess.CompletedProcess(process.args,process.returncode,output)


def main():
    global stage
    if os.geteuid()!=0: raise ValueError('Root required')
    root=Path('/opt/searchfloor-opds/prototype')
    deploy_uid=pwd.getpwnam('searchfloor-deploy').pw_uid
    for parent in [Path('/opt'),Path('/opt/searchfloor-opds'),root]:
        stage='guard-parent'
        validate_parent(parent,(0,) if parent==Path('/opt') else (0,deploy_uid))
    stage='guard-current'
    current=root/'current'
    if not current.is_symlink() or current.resolve()!=root/BASELINE:
        raise GuardFailure('unexpected-current-pointer')
    stage='guard-baseline'
    if json.loads((current/'release.json').read_text())['sha']!=BASELINE:
        raise GuardFailure('unexpected-baseline-identity')
    stage='guard-candidate-directory'
    target=root/SHA
    if os.path.lexists(target): raise GuardFailure('candidate-already-exists')
    for unit in ['searchfloor-opds.service','searchfloor-opds-prototype.service','searchfloor-opds-deploy.service','searchfloor-opds-deploy.timer']:
        stage='guard-unit'
        if subprocess.check_output(['/usr/bin/systemctl','show',unit,'-p','ActiveState','--value'],text=True).strip()!='inactive':
            raise GuardFailure('unit-collision',{'unit':unit})
    stage='guard-timer'
    if subprocess.check_output(['/usr/bin/systemctl','show','searchfloor-opds-deploy.timer','-p','UnitFileState','--value'],text=True).strip()!='disabled':
        raise GuardFailure('timer-enabled')
    stage='guard-port'
    if len(subprocess.check_output(['/usr/bin/ss','-ltn','sport = :8787'],text=True).splitlines())!=1:
        raise GuardFailure('port-collision')
    source=Path(sys.argv[2])/'artifact.zip'
    if sys.argv[1]=='--check':
        print(json.dumps({'check':'staging-guards','valid':True,'prototypeStarted':False,'codeCopied':False,'sourceRequests':0}),flush=True)
        return
    stage='protected-extraction'
    # Copy/hash trusted bytes again under root before executing only stdlib extraction.
    with tempfile.TemporaryDirectory(prefix='.proxy-stage-',dir=root) as temporary:
        tmp=Path(temporary)
        archive=tmp/'artifact.zip';archive.write_bytes(source.read_bytes())
        if archive.stat().st_size!=7361261: raise ValueError('Wrapper size')
        verify_digest(archive,WRAPPER)
        subprocess.run(['/usr/bin/python3','scripts/safe-extract.py','zip',str(archive),str(tmp/'wrapper')],check=True)
        tar=tmp/'wrapper/release.tgz';verify_digest(tar,TAR)
        if (tmp/'wrapper/release.tgz.sha256').read_text().split()!=[TAR,'release.tgz']:
            raise ValueError('External checksum')
        subprocess.run(['/usr/bin/python3','scripts/safe-extract.py','tar',str(tar),str(tmp/'code')],check=True)
        manifest=json.loads((tmp/'code/release.json').read_text())
        if (manifest['sha'],manifest['platform'],manifest['arch'],manifest['nodeMajor'],manifest['nodeAbi'],manifest['cacheSchemaVersion'])!=(SHA,'linux','x64',24,'137',1):
            raise ValueError('Candidate manifest')
        for entry in [tmp/'code',*(tmp/'code').rglob('*')]:
            if entry.is_symlink(): raise ValueError('Unexpected code link')
            entry.chmod(0o755 if entry.is_dir() else 0o644)
        os.rename(tmp/'code',target)
    stage='runtime-user-native-check'
    program=r'''
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const directory='/opt/searchfloor-opds/prototype/c22ac2e6edafeba1563d88363326b2bd19cbb097';
const manifest=JSON.parse(readFileSync(directory+'/release.json','utf8'));
const glibc=process.report.getReport().header.glibcVersionRuntime.split('.').map(Number);
const built=manifest.glibcVersion.split('.').map(Number);
if(manifest.sha!=='c22ac2e6edafeba1563d88363326b2bd19cbb097'||process.arch!==manifest.arch||process.versions.modules!==manifest.nodeAbi||Number(process.versions.node.split('.')[0])!==manifest.nodeMajor||glibc[0]<built[0]||(glibc[0]===built[0]&&glibc[1]<built[1]))throw Error('Host mismatch');
const Database=createRequire(directory+'/package.json')('better-sqlite3');
const db=new Database(':memory:');
try {if(db.prepare('SELECT 1 AS ok').get().ok!==1)throw Error('Native load');}finally{db.close();}
'''
    result=run_runtime(program,{'PATH':'/usr/bin:/bin'})
    if result.returncode: raise ValueError('Runtime native check failed')
    print(json.dumps({'check':'immutable-proxy-code-staged','sha':SHA,'valid':True,'rootOwned':target.stat().st_uid==0,'runtimeUserNativeQuery':True,'currentUnchanged':current.resolve()==root/BASELINE,'configChanged':False,'prototypeStarted':False}),flush=True)
    stage='synthetic-acquisition-mime'
    probe=r'''
import {renderFeed} from 'file:///opt/searchfloor-opds/prototype/c22ac2e6edafeba1563d88363326b2bd19cbb097/dist/opds/feed.js';
const stamp='2026-10-05T00:00:00Z';
const xml=renderFeed({books:[{sourceName:'searchfloor',id:'7',title:'Synthetic fixture',authors:[],complete:true,sourceUrl:'https://example.invalid/7',downloadPath:'/book/7',observedAt:stamp}],nextPage:null,observedAt:stamp},{baseUrl:'https://example.invalid',sourceName:'searchfloor',query:null,page:1,updated:stamp,stale:false});
if(!xml.includes('rel="http://opds-spec.org/acquisition" href="https://example.invalid/opds/searchfloor/books/7/download.fb2.zip" type="application/fb2+zip"'))throw Error('Book MIME');
'''
    if run_runtime(probe,{'PATH':'/usr/bin:/bin'}).returncode:raise ValueError('Candidate acquisition MIME')
    print(json.dumps({'check':'fbreader-acquisition-mime','valid':True,'sourceRequests':0,'configChanged':False,'prototypeStarted':False}),flush=True)


if __name__=='__main__':
    try: main()
    except Exception as error:
        row={'check':'immutable-proxy-code-staged','valid':False,'stage':stage,'failure':type(error).__name__,'prototypeStarted':False}
        if isinstance(error,GuardFailure):row.update(reason=error.reason,details=error.details)
        print(json.dumps(row),flush=True)
        raise SystemExit(1) from None
PY
