#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help && $# == 1 ]]; then
  echo 'Usage: bash deploy/observe-reader-access.sh'
  echo 'Sudo for private auth checks; press Enter when ready for180s phone window.'
  exit 0
fi
[[ $# == 0 && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'Run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
evidence=$(mktemp -d /home/ysi/opds/access-log-observation-XXXXXX)
echo "Sanitized evidence: $evidence/checks.jsonl"
sudo -v
sudo /usr/bin/python3 scripts/diagnostics/reader-access.py 2> "$evidence/private-stderr.log" |
  python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
