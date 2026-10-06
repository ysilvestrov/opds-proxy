"""AUTH-001/OPS-002: interactive single-user Basic credential rotation only."""
import base64
import fcntl
import getpass
import importlib.util
import json
import os
from pathlib import Path
import signal
import stat
import sys
import tempfile
import time

spec = importlib.util.spec_from_file_location('infrastructure', Path(__file__).with_name('production-rollout.py'))
infra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(infra)
ENV = Path('/etc/searchfloor-opds')
LOCK = infra.LOCK
UNIT, DEPLOY, TIMER = infra.UNIT, infra.DEPLOY, infra.TIMER
OWNER = 0
control = infra.control

def atomic_file(path,data,mode):
    infra.atomic_file(path,data,mode)
    descriptor = os.open(path.parent,os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(descriptor)
    finally: os.close(descriptor)

class RotationError(Exception):
    pass

def require(value):
    if not value: raise RotationError('Credential rotation gate failed')

def validate_credentials(username, password):
    for value, maximum in [(username,128),(password,1024)]:
        require(isinstance(value,str) and value and len(value.encode('utf-16-le'))//2 <= maximum)
        require(not any(ord(c) < 32 or ord(c) == 127 for c in value))
    require(':' not in username)

def preflight():
    require(infra.show(UNIT)['ActiveState'] == 'active')
    require(infra.show(DEPLOY)['ActiveState'] == 'inactive')
    require(infra.show(infra.PROTO)['ActiveState'] == 'inactive')
    state = infra.state()
    sha = state.get('settledSHA')
    require(state.get('phase') == 'idle' and sha and infra.re.fullmatch('[a-f0-9]{40}',sha))
    require((infra.ROOT/'current').is_symlink() and (infra.ROOT/'current').resolve() == infra.ROOT/'releases'/sha)
    timer = infra.show(TIMER)
    require(timer['ActiveState'] in ['active','inactive'] and timer['UnitFileState'] in ['enabled','disabled'])
    return sha,timer

def check_health(config, sha):
    deadline = time.monotonic()+15
    while True:
        try:
            status,_,body = infra.verifier.request_curl('http://127.0.0.1:8787/health','',timeout=2)
            health = json.loads(body)
            if status == 200 and health.get('ready') and health.get('sha') == sha: break
        except Exception: pass
        require(time.monotonic() < deadline)
        time.sleep(0.25)
    # Static only: verifies Basic/private feeds locally and over existing HTTPS.
    infra.verifier.verify(config,sha,live=False,fetch=infra.verifier.request_curl)

def check_revoked(config):
    auth = 'Basic '+base64.b64encode((config['OPDS_USERNAME']+':'+config['OPDS_PASSWORD']).encode()).decode()
    for base in ['http://127.0.0.1:8787',config['PUBLIC_BASE_URL'].rstrip('/')]:
        status,_,_ = infra.verifier.request_curl(base+'/opds',auth)
        require(status == 401)

def restore_timer(timer):
    control('enable' if timer['UnitFileState'] == 'enabled' else 'disable',TIMER)
    if timer['ActiveState'] == 'active': control('start',TIMER)

def rotate(username,password):
    validate_credentials(username,password)
    info = ENV.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == OWNER and stat.S_IMODE(info.st_mode) == 0o700)
    info = LOCK.lstat()
    require(stat.S_ISREG(info.st_mode))
    with LOCK.open('r+') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise RotationError('Deployment busy; retry later') from None
        try:
            require(not os.path.lexists(ENV/'credentials-rotation-pending'))
            sha,timer = preflight()
            originals,configs = {},{}
            for name in ['runtime.env','deploy.env']:
                path = ENV/name
                infra.safe_file(path,uid=OWNER,mode=0o600)
                originals[name] = path.read_bytes()
                configs[name] = infra.verifier.parse_systemd_env(originals[name].decode('utf8'))
            old = configs['runtime.env'].copy()
            require(old.get('PORT','8787') == '8787')
            require(all(old.get(k) and old[k] == configs['deploy.env'].get(k) for k in ['OPDS_USERNAME','OPDS_PASSWORD']))
            if (username,password) == (old['OPDS_USERNAME'],old['OPDS_PASSWORD']): return {'changed':False}
            encoded = {}
            for name,config in configs.items():
                config.update(OPDS_USERNAME=username,OPDS_PASSWORD=password)
                encoded[name] = infra.encode_env(config)
                require(infra.verifier.parse_systemd_env(encoded[name].decode('utf8')) == config)
            backup = Path(tempfile.mkdtemp(prefix='.credentials-backup-',dir=ENV))
            for name,data in originals.items(): atomic_file(backup/name,data,0o600)
            atomic_file(backup/'recovery.json',json.dumps({'sha':sha,'timer':timer}).encode(),0o600)
            marker = ENV/'credentials-rotation-pending'
            paused = False
            touched = False
            try:
                # Persistently disable until success/verified rollback; interruption
                # cannot let a rebooted timer deploy with partially updated files.
                paused = True
                control('stop',TIMER)
                control('disable',TIMER)
                atomic_file(marker, (str(backup)+'\n').encode(),0o600)
                touched = True
                control('stop',UNIT)
                for name,data in encoded.items(): atomic_file(ENV/name,data,0o600)
                control('start',UNIT)
                check_health(configs['runtime.env'],sha)
                check_revoked(old)
                restore_timer(timer)
                marker.unlink()
                return {'changed':True,'sha':sha,'timerRestored':True}
            except BaseException:
                recovered = not touched
                if touched:
                    try:
                        control('stop',UNIT)
                        for name,data in originals.items(): atomic_file(ENV/name,data,0o600)
                        control('start',UNIT)
                        check_health(old,sha)
                        recovered = True
                    except BaseException:
                        # Leave pending marker/private backup and disabled timer.
                        recovered = False
                if recovered and paused:
                    try:
                        restore_timer(timer)
                        marker.unlink(missing_ok=True)
                    except BaseException: recovered = False
                if not recovered:
                    try: control('stop',TIMER); control('disable',TIMER)
                    except BaseException: pass
                    if touched:
                        try: atomic_file(marker,(str(backup)+'\n').encode(),0o600)
                        except BaseException: pass
                raise RotationError('Change failed; verified rollback completed' if recovered else
                                    'Recovery needs operator; timer kept disabled; private backup retained') from None
        finally: fcntl.flock(lock,fcntl.LOCK_UN)

def main():
    if sys.argv[1:] == ['--help']:
        print('Usage: bash deploy/change-opds-credentials.sh (private interactive terminal)')
        return
    require(not sys.argv[1:] and os.geteuid() == 0 and sys.stdin.isatty() and sys.stdout.isatty())
    username = input('New OPDS username: ')
    password = getpass.getpass('New OPDS password: ')
    confirmation = getpass.getpass('Repeat OPDS password: ')
    require(password == confirmation)
    validate_credentials(username,password)
    # Check preflight again inside the lock before touching configuration.
    print(json.dumps(rotate(username,password)))

if __name__ == '__main__':
    try:
        signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
        main()
    except BaseException as error:
        if isinstance(error,RotationError): print(str(error),file=sys.stderr)
        else: print('Credential change failed; inspect private recovery state. No credentials printed.',file=sys.stderr)
        sys.exit(1)
