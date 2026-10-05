#!/usr/bin/env bash
# Stage pinned code and one dedicated source GET. Never switch current/start units.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/stage-proxy-prototype.sh [--check]'
  echo 'Verify pinned CI, copy immutable code, test native module and one source GET.'
  echo 'No current switch/service start. Source failure restores pre-proxy env backup.'
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
sha='e57f0a6d33799593afc594a8adefabfa46ee6341'
def api(path): return json.loads(subprocess.check_output(['gh','api','repos/ysilvestrov/opds-proxy/'+path]))
r=api('actions/runs/37311541114');a=api('actions/artifacts/11346670844')
jobs=api('actions/runs/37311541114/jobs?per_page=100')['jobs']
assert (r['workflow_id'],r['head_sha'],r['head_branch'],r['event'],r['status'],r['conclusion'],r['head_repository']['full_name'])==(374905819,sha,'feat/opds-v1','push','completed','success','ysilvestrov/opds-proxy')
for name in ['test','typecheck','build','package']:
    matching=[j for j in jobs if j['name']==name]
    assert len(matching)==1 and matching[0]['status']=='completed' and matching[0]['conclusion']=='success'
assert a['workflow_run']['id']==r['id'] and a['workflow_run']['head_sha']==sha
assert a['name']=='opds-prototype-'+sha and not a['expired'] and a['size_in_bytes']==7360797
assert a['digest']=='sha256:0c43c34457c1b583413fded05cb1aedd77d080f52ead21e333f40f102eac255b'
assert datetime.datetime.fromisoformat(a['expires_at'].replace('Z','+00:00'))>datetime.datetime.now(datetime.timezone.utc)
print('Pinned feature CI/artifact identity and expiry: PASS')
CHECK
evidence=$(mktemp -d /home/ysi/opds/proxy-stage-checks-XXXXXX)
echo "Sanitized staging checks: $evidence/checks.jsonl"
sudo -v
sudo /usr/bin/python3 - "$mode" <<'PY' | python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
import hashlib
import json
import os
from pathlib import Path
import subprocess
import signal
import tempfile
import sys
import pwd

SHA='e57f0a6d33799593afc594a8adefabfa46ee6341'
BASELINE='16cc521448bbb792aa74594cf7c1c1def5ae16f9'
WRAPPER='0c43c34457c1b583413fded05cb1aedd77d080f52ead21e333f40f102eac255b'
TAR='980a6fd419aab2bc914cf208f8492b12301e7972b1487cfbed56ddfe8a011870'
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
    stage='guard-receipt'
    receipt=json.loads(Path('docs/proxy-prototype-update-artifact.json').read_text())
    if receipt['applicationSha']!=SHA: raise ValueError('Receipt identity')
    source=Path(receipt['stage'])/'artifact.zip'
    if sys.argv[1:]==['--check']:
        print(json.dumps({'check':'staging-guards','valid':True,'prototypeStarted':False,'codeCopied':False,'sourceRequests':0}),flush=True)
        return
    stage='protected-extraction'
    # Copy/hash trusted bytes again under root before executing only stdlib extraction.
    with tempfile.TemporaryDirectory(prefix='.proxy-stage-',dir=root) as temporary:
        tmp=Path(temporary)
        archive=tmp/'artifact.zip';archive.write_bytes(source.read_bytes())
        if archive.stat().st_size!=7360797: raise ValueError('Wrapper size')
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
const directory='/opt/searchfloor-opds/prototype/e57f0a6d33799593afc594a8adefabfa46ee6341';
const manifest=JSON.parse(readFileSync(directory+'/release.json','utf8'));
const glibc=process.report.getReport().header.glibcVersionRuntime.split('.').map(Number);
const built=manifest.glibcVersion.split('.').map(Number);
if(manifest.sha!=='e57f0a6d33799593afc594a8adefabfa46ee6341'||process.arch!==manifest.arch||process.versions.modules!==manifest.nodeAbi||Number(process.versions.node.split('.')[0])!==manifest.nodeMajor||glibc[0]<built[0]||(glibc[0]===built[0]&&glibc[1]<built[1]))throw Error('Host mismatch');
const Database=createRequire(directory+'/package.json')('better-sqlite3');
const db=new Database(':memory:');
try {if(db.prepare('SELECT 1 AS ok').get().ok!==1)throw Error('Native load');}finally{db.close();}
'''
    result=run_runtime(program,{'PATH':'/usr/bin:/bin'})
    if result.returncode: raise ValueError('Runtime native check failed')
    print(json.dumps({'check':'immutable-proxy-code-staged','sha':SHA,'valid':True,'rootOwned':target.stat().st_uid==0,'runtimeUserNativeQuery':True,'currentUnchanged':current.resolve()==root/BASELINE,'configChanged':False,'prototypeStarted':False}),flush=True)
    stage='dedicated-source-get'
    import importlib.util
    spec=importlib.util.spec_from_file_location('verifier','scripts/verify-existing-prototype.py')
    verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)
    env_path=Path('/etc/searchfloor-opds/prototype.env')
    config=verifier.load_private_config(env_path)
    if not config.get('OPDS_SOURCE_PROXY_URL'): raise ValueError('Independent proxy required')
    backups=sorted(env_path.parent.glob('.prototype.env.before-proxy-*'),key=lambda p:p.stat().st_mtime_ns)
    if not backups: raise ValueError('Private rollback backup missing')
    backup=backups[-1]
    prior=verifier.load_private_config(backup)
    if config!=dict(prior,OPDS_SOURCE_PROXY_URL=config['OPDS_SOURCE_PROXY_URL']):
        raise ValueError('Rollback config mismatch')
    probe=r'''
let transport;
let row={check:'dedicated-source-get',valid:false};
try {
 const root=new URL('file://'+process.env.OPDS_PROBE_DIR+'/dist/');
 const {loadConfig}=await import(new URL('config.js',root));
 const {createSourceTransport}=await import(new URL('sources/transport.js',root));
 const {readLimited}=await import(new URL('sources/searchfloor/client.js',root));
 const {parsePage}=await import(new URL('sources/searchfloor/parse.js',root));
 transport=createSourceTransport(loadConfig().OPDS_SOURCE_PROXY_URL);
 const signal=AbortSignal.timeout(15000);
 const response=await transport.fetch('https://searchfloor.org/?status=is_finished&page=1',
  {signal,redirect:'manual',headers:{'User-Agent':'opds-proxy/0.1',Accept:'text/html,application/zip'}});
 row.status=response.status;
 const bytes=await readLimited(response,2*1024*1024,signal);row.bytes=bytes.length;
 if(response.status!==200)throw Error('Status');
 const page=parsePage(new TextDecoder().decode(bytes),1,new Date().toISOString());
 Object.assign(row,{books:page.books.length,nextPage:page.nextPage,valid:true});
}catch{row.failure='source';process.exitCode=1;}
finally{console.log(JSON.stringify(row));await transport?.close();}
'''
    try:
        result=run_runtime(probe,dict(config,PATH='/usr/bin:/bin',OPDS_PROBE_DIR=str(target)))
        # Only forward our allowlisted JSON row, never stderr or unexpected stdout.
        rows=[json.loads(line) for line in result.stdout.splitlines()]
        if len(rows)!=1 or rows[0].get('check')!='dedicated-source-get': raise ValueError('Probe output')
        row={key:value for key,value in rows[0].items() if key in ['check','status','bytes','books','nextPage','valid','failure']}
        print(json.dumps(row),flush=True)
        if result.returncode or row.get('valid') is not True: raise ValueError('Source failed')
    except Exception:
        fd,name=tempfile.mkstemp(prefix='.prototype.env.restore-',dir=env_path.parent)
        try:
            with os.fdopen(fd,'wb') as output:
                output.write(backup.read_bytes());output.flush();os.fsync(output.fileno())
            os.replace(name,env_path)
        finally:
            if os.path.exists(name):os.unlink(name)
        print(json.dumps({'check':'pre-proxy-config-restored','valid':True,'prototypeStarted':False}),flush=True)
        raise


if __name__=='__main__':
    try: main()
    except Exception as error:
        row={'check':'immutable-proxy-code-staged','valid':False,'stage':stage,'failure':type(error).__name__,'prototypeStarted':False}
        if isinstance(error,GuardFailure):row.update(reason=error.reason,details=error.details)
        print(json.dumps(row),flush=True)
        raise SystemExit(1) from None
PY
