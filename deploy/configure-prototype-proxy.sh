#!/usr/bin/env bash
# Private config input only; run as the operator in an ordinary SSH terminal.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/configure-prototype-proxy.sh [--check]'
  echo 'Privately add independent OPDS proxy URL, preserving Basic and a 0600 backup.'
  echo 'No artifact install, pointer switch, source request or service start.'
  exit 0
fi
mode=${1:---configure}
[[ $# -le 1 && ( $mode == --configure || $mode == --check ) && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'STOP: run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
for unit in searchfloor-opds.service searchfloor-opds-prototype.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer; do
  [[ $(systemctl show "$unit" -p ActiveState --value) == inactive ]] || { echo "STOP: $unit must be inactive." >&2; exit 1; }
done
[[ $(systemctl show searchfloor-opds-deploy.timer -p UnitFileState --value) == disabled ]] || { echo 'STOP: production timer must be disabled.' >&2; exit 1; }
[[ $(ss -ltn 'sport = :8787' | wc -l) == 1 ]] || { echo 'STOP: port8787 is occupied.' >&2; exit 1; }
echo 'Use only the independent OPDS sub-user, never bot credentials.'
echo 'Paste an absolute HTTP(S) proxy URL; percent-encode reserved credential characters.'
echo 'Example format: http://USER:PASSWORD@HOST:PORT (input will be hidden).'
sudo -v
sudo /usr/bin/python3 - "$mode" <<'PY'
import getpass
import importlib.util
import os
import json
import sys
from pathlib import Path
import tempfile
import warnings
from urllib.parse import urlsplit

spec = importlib.util.spec_from_file_location('verifier', 'scripts/verify-existing-prototype.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
parse_systemd_env = verifier.parse_systemd_env
stage = 'configuration-check'


def read_proxy():
    # getpass opens its own input fd; the stream is only for prompt output.
    # Never fall back to visible input if terminal echo control fails.
    with warnings.catch_warnings(), open('/dev/tty', 'w') as tty:
        warnings.simplefilter('error', getpass.GetPassWarning)
        proxy = getpass.getpass('Independent OPDS proxy URL (hidden): ', stream=tty)
        confirmation = getpass.getpass('Repeat proxy URL (hidden): ', stream=tty)
    if proxy != confirmation: raise ValueError('Inputs differ')
    return proxy


def with_proxy(original, proxy):
    if not proxy or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in proxy):
        raise ValueError('Invalid proxy URL')
    parsed = urlsplit(proxy)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('Invalid proxy URL')
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError('Invalid proxy port')
    config = parse_systemd_env(original)
    if 'OPDS_SOURCE_PROXY_URL' in config:
        raise ValueError('Proxy already configured; inspect privately before changing')
    escaped = proxy.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
    result = original + ('' if original.endswith('\n') else '\n') + 'OPDS_SOURCE_PROXY_URL="' + escaped + '"\n'
    if parse_systemd_env(result) != dict(config, OPDS_SOURCE_PROXY_URL=proxy):
        raise ValueError('Configuration preservation failed')
    return result


def save_private(path, original, updated):
    fd, backup_name = tempfile.mkstemp(prefix='.prototype.env.before-proxy-', dir=path.parent)
    with os.fdopen(fd, 'w') as backup:
        backup.write(original)
        backup.flush()
        os.fsync(backup.fileno())
    fd, temporary_name = tempfile.mkstemp(prefix='.prototype.env.new-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as output:
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name): os.unlink(temporary_name)
    return Path(backup_name)


def check_private_config(path):
    config = verifier.load_private_config(path)
    proxy = config.get('OPDS_SOURCE_PROXY_URL')
    with_proxy('', proxy)  # Same URL validation, no mutation.
    backups = sorted(path.parent.glob('.prototype.env.before-proxy-*'), key=lambda p: p.stat().st_mtime_ns)
    if not backups: raise ValueError('Private backup missing')
    original = verifier.load_private_config(backups[-1])
    if config != dict(original, OPDS_SOURCE_PROXY_URL=proxy):
        raise ValueError('Original config changed')
    print(json.dumps({'check':'private-proxy-config','valid':True,'proxyPresent':True,'configPreserved':True,'backupCompared':True}))


def main():
    global stage
    if os.geteuid() != 0: raise ValueError('Root required')
    path = Path('/etc/searchfloor-opds/prototype.env')
    config = verifier.load_private_config(path)
    if path.lstat().st_gid != 0: raise ValueError('Root group required')
    if sys.argv[1:] == ['--check']:
        check_private_config(path)
        return
    if 'OPDS_SOURCE_PROXY_URL' in config:
        raise ValueError('Proxy already configured; inspect privately before changing')
    if any(not config.get(key) for key in ('PUBLIC_BASE_URL', 'PORT', 'CACHE_PATH', 'OPDS_USERNAME', 'OPDS_PASSWORD')):
        raise ValueError('Existing config incomplete')
    stage = 'hidden-terminal-input'
    proxy = read_proxy()
    # Validate before creating any backup or writing config.
    original = path.read_text()
    stage = 'proxy-validation'
    updated = with_proxy(original, proxy)
    stage = 'private-backup-and-save'
    backup = save_private(path, original, updated)
    stage = 'saved-config-check'
    verifier.load_private_config(path)
    print('Private OPDS proxy saved; Basic/base/port/cache preserved. Root-only backup: ' + str(backup))
    print('No source request, install, pointer switch or service start performed.')


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print('STOP: private setup failed at ' + stage + ' (' + type(error).__name__ + '). Inspect config/backup privately before retrying.')
        raise SystemExit(1) from None
PY
