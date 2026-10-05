"""Owner-approved experiment only: load one proxy key, then exec the bounded runner.

No proxy values in argv/output/Git. Does not change bot configuration or services.
Run as the unprivileged operator, never as root (the runner imports artifact code).
"""
import argparse
import os
from pathlib import Path
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--out', required=True)
args = parser.parse_args()
if os.geteuid() == 0:
    raise SystemExit('Use the unprivileged operator; artifact code must not run as root')
value = None
try:
    with Path('/home/ysi/warsaw-beer-bot/.env').open() as stream:
        for line in stream:
            key, separator, tail = line.partition('=')
            if separator and key.strip() == 'WEBSHARE_PROXY':
                value = tail.strip()
                if len(value) > 1 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                break
except OSError:
    raise SystemExit('Existing operator proxy settings inaccessible; no substitute used')
if not value:
    raise SystemExit('Existing operator proxy setting absent; no substitute used')
if '://' not in value:
    value = 'http://' + value
os.environ['OPDS_DIAGNOSTIC_PROXY'] = value
runner = Path(__file__).with_name('run-source-experiments.py')
os.execv(sys.executable, [sys.executable, str(runner), '--dist',
                        '/opt/searchfloor-opds/prototype/current/dist',
                        '--proxy-env', 'OPDS_DIAGNOSTIC_PROXY', '--out', args.out])
