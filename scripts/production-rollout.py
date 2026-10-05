"""OPS-002/DEPLOY-001/002: private operator cutover; only fixed OPDS units.

Never executes run-deploy directly, writes deployment state, downloads a release,
reads bot configuration or changes Cloudflare/provider resources.
"""
import base64
import datetime
import fcntl
import getpass
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import signal
import stat
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import warnings
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parents[1]
MAIN = 'd66216c134a5a4c085de6f137359bea27abdc597'
PROTOTYPE = 'c22ac2e6edafeba1563d88363326b2bd19cbb097'
RUN = 37377050484
WORKFLOW = 374905819
ARTIFACT = 11372062331
UNIT = 'searchfloor-opds.service'
DEPLOY = 'searchfloor-opds-deploy.service'
TIMER = 'searchfloor-opds-deploy.timer'
PROTO = 'searchfloor-opds-prototype.service'
ROOT = Path('/opt/searchfloor-opds')
ENV = Path('/etc/searchfloor-opds')
STATE = Path('/var/lib/searchfloor-opds-deploy/state/deployment.json')
LOCK = Path('/var/lib/searchfloor-opds-deploy/lock')
phase = 'preflight'
spec = importlib.util.spec_from_file_location('verifier', REPO/'scripts/verify-existing-prototype.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def emit(check, **values):
    print(json.dumps(dict(time=datetime.datetime.now(datetime.timezone.utc).isoformat(), check=check, **values)), flush=True)


def require(condition):
    if not condition:
        raise ValueError('Gate failed')


def encode_env(values):
    lines = []
    for key, value in values.items():
        require(re.fullmatch(r'[A-Z_][A-Z_0-9]*', key) and isinstance(value, str))
        require(not any(ord(c) < 32 or ord(c) == 127 for c in value))
        lines.append(key+'="'+value.replace('\\', '\\\\').replace('"', '\\"')+'"')
    return ('\n'.join(lines)+'\n').encode('utf8')


def validate_proxy(value):
    require(value and 'REPLACE' not in value and not any(c.isspace() for c in value))
    url = urllib.parse.urlsplit(value)
    require(url.scheme in ['http', 'https'] and url.hostname and url.path in ['', '/'] and not url.query and not url.fragment)
    url.port


def validate_privileges(text):
    exact = '(root) NOPASSWD: '+', '.join('/usr/local/sbin/searchfloor-opds-control '+action for action in ['restart', 'stop', 'reset-cache'])
    require(' '.join(text.split()) == exact)


def recovery_action(state):
    if state.get('phase') != 'idle':
        return 'preserve-pending'
    if state.get('settledSHA'):
        return 'preserve-production'
    return 'restore-prototype-after-stop'


def run(args, timeout=30, check=True):
    result = subprocess.run(args, capture_output=True, timeout=timeout, text=True)
    if check:
        require(result.returncode == 0)
    return result


def show(unit, fields=('ActiveState', 'SubState', 'NRestarts', 'MainPID', 'UnitFileState')):
    args = ['/usr/bin/systemctl', 'show', unit]
    for field in fields:
        args += ['-p', field]
    return dict(line.split('=', 1) for line in run(args).stdout.splitlines())


def control(action, unit):
    require(unit in [UNIT, DEPLOY, TIMER, PROTO])
    run(['/usr/bin/systemctl', action, unit], timeout=330)


def free_port():
    return len(run(['/usr/bin/ss', '-ltn', 'sport = :8787']).stdout.splitlines()) == 1


def state():
    if not STATE.exists():
        return {'phase': 'idle', 'settledSHA': None}
    require(STATE.is_file() and not STATE.is_symlink())
    value = json.loads(STATE.read_text())
    require(value.get('phase') in ['idle', 'activating', 'rollback'])
    for key in ['settledSHA','previousSHA','failedSHA','candidateSHA','baselineSHA']:
        require(value.get(key) is None or re.fullmatch('[a-f0-9]{40}', value[key]))
    return {key:item for key,item in value.items() if key in ['phase','settledSHA','previousSHA','failedSHA','candidateSHA','baselineSHA']}


def safe_file(path, uid=0, mode=None):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and (uid != 0 or info.st_gid == 0) and not info.st_mode & 0o022)
    if mode is not None:
        require(stat.S_IMODE(info.st_mode) == mode)
    return info


def atomic_file(path, data, mode):
    fd, temporary = tempfile.mkstemp(prefix='.rollout-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
            os.fchmod(output.fileno(), mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def api(path, token):
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request('https://api.github.com/repos/ysilvestrov/opds-proxy/'+path,
        headers={'Authorization':'Bearer '+token, 'User-Agent':'opds-proxy-deployer', 'Accept':'application/vnd.github+json'})
    with opener.open(request, timeout=15) as response:
        data = response.read(2*1024*1024+1)
        require(len(data) <= 2*1024*1024 and response.status == 200)
        return json.loads(data)


def ci_gate(token):
    require(api('git/ref/heads/main', token)['object']['sha'] == MAIN)
    r = api('actions/runs/'+str(RUN), token)
    require((r['workflow_id'], r['head_sha'], r['head_branch'], r['event'], r['status'], r['conclusion'], r['head_repository']['full_name']) ==
        (WORKFLOW, MAIN, 'main', 'push', 'completed', 'success', 'ysilvestrov/opds-proxy'))
    jobs = api('actions/runs/'+str(RUN)+'/jobs?per_page=100', token)['jobs']
    for name in ['test', 'typecheck', 'build', 'package']:
        matches = [j for j in jobs if j['name'] == name]
        require(len(matches) == 1 and matches[0]['status'] == 'completed' and matches[0]['conclusion'] == 'success')
    a = api('actions/artifacts/'+str(ARTIFACT), token)
    require(a['name'] == 'opds-release-'+MAIN and a['workflow_run']['id'] == RUN and a['workflow_run']['head_sha'] == MAIN and not a['expired'])
    require(a['digest'] == 'sha256:296b9a5e23cc93dbe6f0dbe9865378e2508649c320336b17bcdf7216235fd4ef')
    require(datetime.datetime.fromisoformat(a['expires_at'].replace('Z', '+00:00')) > datetime.datetime.now(datetime.timezone.utc))
    emit('main-ci', valid=True, sha=MAIN, run=RUN, artifact=ARTIFACT)


def bot_health():
    status, _, body = verifier.request_curl('http://127.0.0.1:3000/health', None, limit=4096)
    value = show('warsaw-beer-bot.service')
    require(status == 200 and json.loads(body).get('ok') is True and value['ActiveState'] == 'active')
    emit('bot-health', valid=True, status=status, **value)
    return value


def resources(label):
    values = {}
    for unit in [UNIT, DEPLOY]:
        info = show(unit, ('ActiveState', 'MainPID', 'MemoryCurrent', 'MemoryPeak', 'CPUUsageNSec', 'NRestarts'))
        pid = int(info.get('MainPID', '0'))
        try:
            info['VmRSS'] = next(line.split(':',1)[1].strip() for line in Path('/proc/'+str(pid)+'/status').read_text().splitlines() if line.startswith('VmRSS:')) if pid else None
        except (OSError, StopIteration):
            info['VmRSS'] = None
        values[unit] = info
    cache = Path('/var/lib/searchfloor-opds/cache')
    fs = os.statvfs('/')
    available = next(int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
    if label == 'before-cutover':
        require(available >= 1536*1024*1024 and fs.f_bavail*fs.f_frsize >= 2*1024*1024*1024 and fs.f_favail >= 20000)
    emit('resources', label=label, units=values, cacheBytes={p.name:p.stat().st_size for p in cache.glob('catalog.sqlite*') if p.is_file()},
         diskAvailableBytes=fs.f_bavail*fs.f_frsize, freeInodes=fs.f_favail,
         ramAvailableBytes=available,
         codeLogicalBytes={p.name:sum(x.stat().st_size for x in p.rglob('*') if x.is_file()) for p in (ROOT/'releases').iterdir() if p.is_dir() and re.fullmatch('[a-f0-9]{40}', p.name)})


def journal_results(since):
    raw = run(['/usr/bin/journalctl', '-u', DEPLOY, '--since', '@'+str(since), '-o', 'json', '--no-pager']).stdout
    results = []
    for line in raw.splitlines():
        try:
            message = json.loads(json.loads(line).get('MESSAGE', ''))
            if message.get('event') == 'deploy_result' and message.get('result') in ['deployed', 'noop', 'held', 'rolled-back']:
                results.append(message['result'])
        except (ValueError, AttributeError):
            pass
    return results


def deploy_run(expected):
    started = time.time()
    process = subprocess.Popen(['/usr/bin/systemctl', 'start', DEPLOY], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    peak = 0
    try:
        while process.poll() is None:
            require(time.time()-started < 330)
            value = show(DEPLOY, ('MemoryPeak',)).get('MemoryPeak', '')
            if value.isdigit():
                peak = max(peak, int(value))
            if int(time.time()-started) % 30 == 0:
                emit('deploy-progress', elapsedSeconds=int(time.time()-started))
            time.sleep(1)
        require(process.returncode == 0)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
    results = journal_results(started)
    require(results and results[-1] == expected)
    require(state().get('phase') == 'idle' and state().get('settledSHA') == MAIN)
    require((ROOT/'current').is_symlink() and (ROOT/'current').resolve() == ROOT/'releases'/MAIN)
    require(peak <= 768*1024*1024)
    elapsed = time.time()-started
    if expected == 'deployed':
        require(elapsed >= 60 and peak > 0)
    emit('fixed-unit-deployment', valid=True, result=expected, elapsedSeconds=elapsed, deployerPeakBytes=peak,
         startupBudgetSeconds=15, stableObservationSeconds=60, state=state())


def infrastructure():
    run(['/usr/bin/bash', '-n', str(REPO/'deploy/restart-helper.sh')])
    run(['/usr/sbin/visudo', '-cf', str(REPO/'deploy/sudoers')])
    run(['/usr/bin/systemd-analyze', 'verify', *[str(REPO/'deploy'/name) for name in [UNIT, DEPLOY, TIMER, PROTO]]])
    mapping = [('scripts/'+name, Path('/usr/local/lib/searchfloor-opds')/name, 0o644) for name in ['autodeploy.mjs','artifact.mjs','observe.mjs','run-deploy.mjs','safe-extract.py']]
    mapping += [('deploy/restart-helper.sh', Path('/usr/local/sbin/searchfloor-opds-control'), 0o755), ('deploy/sudoers',Path('/etc/sudoers.d/searchfloor-opds'),0o440)]
    mapping += [('deploy/'+unit, Path('/etc/systemd/system')/unit, 0o644) for unit in [UNIT, DEPLOY, TIMER, PROTO]]
    backup = Path(tempfile.mkdtemp(prefix='.rollout-backup-', dir=ENV))
    changed = []
    for source, target, mode in mapping:
        safe_file(target, mode=mode)
        wanted = (REPO/source).read_bytes()
        current = target.read_bytes()
        if wanted != current:
            atomic_file(backup/target.name, current, 0o600)
            atomic_file(target, wanted, mode)
            changed.append(str(target))
        emit('infrastructure-file', path=str(target), uid=0, mode=oct(mode), sha256=hashlib.sha256(wanted).hexdigest(), changed=wanted!=current)
    if changed:
        run(['/usr/bin/systemctl', 'daemon-reload'])
    policy = run(['/usr/sbin/runuser', '-u', 'searchfloor-deploy', '--', '/usr/bin/sudo', '-n', '-l']).stdout
    require('may run the following commands on' in policy)
    commands = policy.split('may run the following commands on',1)[1].split(':',1)[1]
    validate_privileges(commands)
    emit('effective-privileges', valid=True, fixedActions=['restart','stop','reset-cache'])
    return backup


def prepare_config(backup):
    prototype = verifier.load_private_config(ENV/'prototype.env')
    require(prototype.get('PORT', '8787') == '8787')
    require(prototype.get('PUBLIC_BASE_URL','').startswith('https://'))
    for key in ['OPDS_USERNAME', 'OPDS_PASSWORD']:
        require(prototype.get(key) and 'REPLACE' not in prototype[key])
    validate_proxy(prototype.get('OPDS_SOURCE_PROXY_URL', ''))
    runtime = {key:prototype[key] for key in ['PUBLIC_BASE_URL','OPDS_USERNAME','OPDS_PASSWORD','OPDS_SOURCE_PROXY_URL']}
    runtime.update(PORT='8787', CACHE_PATH='/var/lib/searchfloor-opds/cache/catalog.sqlite')
    deploy = verifier.load_private_config(ENV/'deploy.env') if (ENV/'deploy.env').exists() else {}
    token = deploy.get('OPDS_GITHUB_TOKEN', '')
    if not token or 'REPLACE' in token:
        warnings.simplefilter('error', getpass.GetPassWarning)
        with open('/dev/tty', 'w') as terminal:
            token = getpass.getpass('Separate GitHub Contents/Actions-read token (hidden; never bot token): ', stream=terminal)
    require(token and not any(c.isspace() for c in token))
    ci_gate(token)
    deploy = {'OPDS_WORKFLOW_ID':str(WORKFLOW), 'OPDS_GITHUB_TOKEN':token, 'OPDS_USERNAME':runtime['OPDS_USERNAME'], 'OPDS_PASSWORD':runtime['OPDS_PASSWORD']}
    for name, values in [('runtime.env',runtime), ('deploy.env',deploy)]:
        path = ENV/name
        if path.exists():
            safe_file(path, mode=0o600)
            atomic_file(backup/name, path.read_bytes(), 0o600)
        atomic_file(path, encode_env(values), 0o600)
        require(verifier.load_private_config(path) == values)
    emit('private-production-config', valid=True, proxyPreserved=True, basicPreserved=True, workflow=WORKFLOW, cachePath=runtime['CACHE_PATH'])
    return runtime, token, (ENV/'prototype.env').read_bytes()


def lock_check():
    fd = os.open(LOCK, os.O_RDWR | os.O_NOFOLLOW)
    try:
        require(os.fstat(fd).st_uid == pwd.getpwnam('searchfloor-deploy').pw_uid)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        before = state()
        identity = show(UNIT)
        result = run(['/usr/bin/systemctl','start',DEPLOY], timeout=30, check=False)
        require(result.returncode != 0 and state() == before and show(UNIT) == identity)
    finally:
        os.close(fd)
    control('reset-failed', DEPLOY)
    emit('fixed-unit-lock-contention', valid=True, concurrentDeploymentPrevented=True)


def timer_tick(identity):
    previous = int(show(TIMER, ('LastTriggerUSecMonotonic',)).get('LastTriggerUSecMonotonic','0') or '0')
    started = time.time()
    control('enable', UNIT)
    run(['/usr/bin/systemctl', 'enable', '--now', TIMER])
    tick = False
    while time.time()-started < 350:
        current = show(TIMER, ('LastTriggerUSecMonotonic','NextElapseUSecMonotonic','ActiveState','UnitFileState'))
        if int(current.get('LastTriggerUSecMonotonic','0')) > previous:
            tick = True
        if tick and show(DEPLOY)['ActiveState'] == 'inactive' and journal_results(started):
            break
        if int(time.time()-started) % 30 == 0:
            emit('timer-wait', elapsedSeconds=int(time.time()-started), nextTickMonotonic=current.get('NextElapseUSecMonotonic'))
        time.sleep(2)
    require(tick and journal_results(started)[-1] == 'noop' and show(UNIT)['MainPID'] == identity['MainPID'] and show(UNIT)['NRestarts'] == identity['NRestarts'])
    require(current['ActiveState'] == 'active' and current['UnitFileState'] == 'enabled' and show(UNIT)['UnitFileState'] == 'enabled')
    require(state().get('phase') == 'idle' and state().get('settledSHA') == MAIN)
    emit('timer-tick', valid=True, result='noop', timer=current, runtimeRestarted=False)


def apply(provider_file):
    global phase
    require(os.geteuid() == 0)
    provider = json.loads(Path(provider_file).read_text())
    require(provider.get('operatorConfirmed') is True)
    require(set(provider) == {'operatorConfirmed','mainLimit','mainActualUsageMB','opdsLimit','opdsActualUsageKB','cycleStart','cycleEnd','cycleTimezone','sharedPool','remainingBudgetAssessment'})
    require(provider['mainLimit'] == provider['opdsLimit'] == '1 GB' and provider['sharedPool'] is True)
    for field in ['mainActualUsageMB','opdsActualUsageKB']:
        require(isinstance(provider[field], str) and re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', provider[field]))
    require(0 <= float(provider['mainActualUsageMB'])*1024*1024 < 1_000_000_000-32*1024*1024)
    require(0 <= float(provider['opdsActualUsageKB'])*1024 < 1_000_000_000-32*1024*1024)
    require(datetime.datetime.fromisoformat(provider['cycleStart']) <= datetime.datetime.now() < datetime.datetime.fromisoformat(provider['cycleEnd']))
    emit('provider-budget', operatorConfirmed=True, mainActualUsageMB=provider['mainActualUsageMB'], opdsActualUsageKB=provider['opdsActualUsageKB'],
         mainLimit='1 GB', opdsLimit='1 GB', cycleStart=provider['cycleStart'], cycleEnd=provider['cycleEnd'], sharedPool=True)
    before = bot_health()
    cutover = False
    try:
        phase = 'host-gates'
        if show(TIMER)['ActiveState'] == 'active':
            control('stop', TIMER)
        control('disable', TIMER)
        for unit in [UNIT, DEPLOY]:
            require(show(unit)['ActiveState'] == 'inactive')
        require(show(UNIT)['UnitFileState'] == 'disabled')
        require(state().get('phase') == 'idle' and state().get('settledSHA') is None and not os.path.lexists(ROOT/'current'))
        node = json.loads(run(['/usr/bin/node','-p','JSON.stringify({node:process.versions.node,abi:process.versions.modules,arch:process.arch,glibc:process.report.getReport().header.glibcVersionRuntime})']).stdout)
        require(node == {'node':'24.19.0','abi':'137','arch':'x64','glibc':'2.39'})
        require('VERSION_ID="24.04"' in Path('/etc/os-release').read_text())
        for account in ['searchfloor-opds','searchfloor-deploy']:
            require(pwd.getpwnam(account).pw_shell == '/usr/sbin/nologin')
        paths = [(ROOT,'searchfloor-deploy',0o755),(ROOT/'staging','searchfloor-deploy',0o700),
                 (ROOT/'releases','searchfloor-deploy',0o755),(ROOT/'prototype','searchfloor-deploy',0o755),
                 (Path('/var/lib/searchfloor-opds/cache'),'searchfloor-opds',0o700),
                 (STATE.parent,'searchfloor-deploy',0o700),
                 (STATE.parent.parent,'searchfloor-deploy',0o750),
                 (Path('/usr/local/lib/searchfloor-opds'),'root',0o755)]
        for path, account, mode in paths:
            info = path.lstat()
            require(stat.S_ISDIR(info.st_mode) and info.st_uid == pwd.getpwnam(account).pw_uid and stat.S_IMODE(info.st_mode) == mode)
        directory = ENV.lstat()
        require(stat.S_ISDIR(directory.st_mode) and directory.st_uid == 0 and stat.S_IMODE(directory.st_mode) == 0o700)
        fixture = ROOT/'prototype'/PROTOTYPE
        require((ROOT/'prototype/current').is_symlink() and (ROOT/'prototype/current').resolve() == fixture)
        require(json.loads((fixture/'release.json').read_text())['sha'] == PROTOTYPE)
        for entry in [fixture, *fixture.rglob('*')]:
            info = entry.lstat()
            require(info.st_uid == 0 and not info.st_mode & 0o022 and not entry.is_symlink())
        phase = 'infrastructure-and-privileges'
        backup = infrastructure()
        phase = 'private-config-and-ci'
        config, token, prototype_bytes = prepare_config(backup)
        phase = 'isolated-verifier'
        result = json.loads(run(['/usr/bin/node',str(REPO/'scripts/verify-deploy-isolation.mjs'),'--artifact-dir',str(fixture)], timeout=60).stdout)
        require(result == {'successfulRelease':'deployed','failedRelease':'rolled-back','failedRetry':'held','rollbackHealth':True,'noop':'noop'})
        emit('isolated-verifier', valid=True, artifactSha=PROTOTYPE, **result)
        ci_gate(token)
        require(bot_health() == before and (ENV/'prototype.env').read_bytes() == prototype_bytes)
        resources('before-cutover')
        phase = 'first-deployment'
        control('stop', PROTO)
        cutover = True
        require(free_port())
        deploy_run('deployed')
        phase = 'production-http'
        verifier.verify(config, MAIN, live=False, fetch=verifier.request_curl)
        auth = 'Basic '+base64.b64encode((config['OPDS_USERNAME']+':'+config['OPDS_PASSWORD']).encode()).decode()
        status, _, body = verifier.request_curl(config['PUBLIC_BASE_URL'].rstrip('/')+'/opds/searchfloor/completed?page=1', auth)
        require(status == 200)
        feed = ET.fromstring(body)
        entries = feed.findall('{http://www.w3.org/2005/Atom}entry')
        require(entries and feed.tag == '{http://www.w3.org/2005/Atom}feed')
        for entry in entries:
            links = [l for l in entry.findall('{http://www.w3.org/2005/Atom}link') if l.get('rel') == 'http://opds-spec.org/acquisition']
            require(len(links) == 1 and links[0].get('type') == 'application/fb2+zip')
        emit('one-completed-feed', valid=True, status=status, bytes=len(body), books=len(entries), bookDownloads=0)
        identity = show(UNIT)
        phase = 'same-main-noop'
        deploy_run('noop')
        require(show(UNIT) == identity)
        phase = 'lock-contention'
        lock_check()
        require(bot_health() == before)
        resources('production')
        peak = show(UNIT, ('MemoryPeak',)).get('MemoryPeak','')
        require(peak.isdigit() and int(peak) <= 384*1024*1024)
        phase = 'timer-tick'
        timer_tick(identity)
        require(bot_health() == before and (ENV/'prototype.env').read_bytes() == prototype_bytes)
        resources('after-timer')
        emit('production-summary', valid=True, mainSha=MAIN, state=state(), units={u:show(u) for u in [UNIT, DEPLOY, TIMER, PROTO]})
    except BaseException:
        control('stop', TIMER)
        control('disable', TIMER)
        if cutover:
            current = state()
            action = recovery_action(current)
            if action == 'restore-prototype-after-stop':
                control('stop', UNIT)
                require(free_port())
                control('start', PROTO)
            emit('recovery', action=action, state=current, timerDisabled=True)
        raise


def provider_prompt(path):
    print('Confirm current WebShare actual figures; no secrets requested.')
    main = input('Main Actual Usage in MB [6.29]: ').strip() or '6.29'
    sub = input('OPDS sub-user Bandwidth Used in KB [18.55]: ').strip() or '18.55'
    start = input('Current billing cycle start [2026-09-24 12:11]: ').strip() or '2026-09-24 12:11'
    end = input('Current billing cycle end [2026-10-24 12:11]: ').strip() or '2026-10-24 12:11'
    require(re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', main) and re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', sub))
    require(0 <= float(main)*1024*1024 < 1_000_000_000-32*1024*1024 and 0 <= float(sub)*1024 < 1_000_000_000-32*1024*1024)
    now = datetime.datetime.now()
    require(datetime.datetime.fromisoformat(start) <= now < datetime.datetime.fromisoformat(end))
    row = {'operatorConfirmed':True,'mainLimit':'1 GB','mainActualUsageMB':main,'opdsLimit':'1 GB','opdsActualUsageKB':sub,'cycleStart':start,'cycleEnd':end,'cycleTimezone':'provider display; not independently supplied','sharedPool':True,'remainingBudgetAssessment':'limits minus actual usage comfortably exceed 32 MiB; not projected values'}
    Path(path).write_text(json.dumps(row)+'\n')
    os.chmod(path, 0o600)


if __name__ == '__main__':
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--provider':
            provider_prompt(sys.argv[2])
        elif len(sys.argv) == 3 and sys.argv[1] == '--apply':
            def interrupted(*_):
                raise InterruptedError('Operator interrupted')
            for incoming in [signal.SIGTERM, signal.SIGHUP]:
                signal.signal(incoming, interrupted)
            apply(sys.argv[2])
        else:
            raise ValueError('Arguments')
    except BaseException as error:
        emit('production-summary', valid=False, phase=phase, failure=type(error).__name__, credentialsPrinted=False)
        raise SystemExit(1) from None
