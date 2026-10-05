#!/usr/bin/env bash
# Resume the last gate of a settled production rollout; no cutover/config writes.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/finish-production-timer.sh [prior checks.jsonl]'
  echo 'Checks settled production and observes one automatic timer no-op; sudo required.'
  exit 0
fi
[[ $# -le 1 && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'STOP: run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
prior=${1:-/home/ysi/opds/production-rollout-checks-B7Bjlo/checks.jsonl}
[[ -f "$prior" ]] || { echo 'STOP: prior sanitized evidence file is missing.' >&2; exit 1; }
evidence=$(mktemp -d /home/ysi/opds/production-timer-checks-XXXXXX)
echo "Sanitized evidence: $evidence/checks.jsonl"
sudo -v
sudo /usr/bin/python3 scripts/production-rollout.py --finish-timer "$prior" |
  python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
