#!/usr/bin/env bash
# Run the reviewed two-ID probe against installed code; no deployment/config writes.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help && $# == 1 ]]; then
  echo 'Usage: bash deploy/run-metadata-diagnostics.sh'
  echo 'Private operator terminal; sudo required; two IDs, four-minute probe budget.'
  exit 0
fi
[[ $# == 0 && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'Run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
evidence=$(mktemp -d /home/ysi/opds/metadata-diagnostics-checks-XXXXXX)
echo "Sanitized evidence: $evidence/checks.jsonl"
git show a5fb02116666940b2fd17c03b669dbfbda3b95fa:scripts/diagnostics/metadata.mjs > "$evidence/probe.mjs"
sudo -v
audit() {
  python3 - "$1" <<'PY' | python3 scripts/diagnostics/record-jsonl.py "$evidence/$1.jsonl"
import datetime,json,subprocess,sys
def show(unit):
    result=subprocess.run(['systemctl','show',unit,'-p','ActiveState','-p','MainPID','-p','NRestarts'],capture_output=True,text=True,check=True)
    return dict(line.split('=',1) for line in result.stdout.splitlines())
units={unit:show(unit) for unit in ['searchfloor-opds.service','warsaw-beer-bot.service']}
health=json.loads(subprocess.run(['curl','--silent','--fail','--max-time','10','http://127.0.0.1:8787/health'],capture_output=True,text=True,check=True).stdout)
valid=health.get('ready') is True and health.get('sha')=='a55334694d3eff8fcac6a489d965c5fe3de05ab3' and all(value.get('ActiveState')=='active' for value in units.values())
print(json.dumps({'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stage':sys.argv[1],'valid':valid,'sha':health.get('sha'),'units':units}))
if not valid: sys.exit(1)
PY
}
audit before
set +e
sudo /usr/bin/timeout --signal=TERM --kill-after=5s 250s /usr/bin/node \
  --env-file=/etc/searchfloor-opds/runtime.env "$evidence/probe.mjs" \
  2> "$evidence/private-stderr.log" |
  python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
result=("${PIPESTATUS[@]}")
set -e
audit after
rm -- "$evidence/probe.mjs"
[[ ${result[0]} == 0 && ${result[1]} == 0 ]] || { echo 'Probe failed; evidence preserved. Private stderr is not for Git/chat.' >&2; exit 1; }
