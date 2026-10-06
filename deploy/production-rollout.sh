#!/usr/bin/env bash
# Operator procedure for docs/codex-cli-production-rollout.md, never bootstrap --apply.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/production-rollout.sh'
  echo 'Private interactive terminal; sudo prompt; separate GitHub read-token if missing.'
  echo 'Uses fixed systemd/flock deployer, validates production, then observes one timer tick.'
  exit 0
fi
[[ $# == 0 && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'STOP: run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
evidence=$(mktemp -d /home/ysi/opds/production-rollout-checks-XXXXXX)
echo "Sanitized evidence: $evidence/checks.jsonl"
python3 scripts/production-rollout.py --provider "$evidence/provider.json"
sudo -v
sudo /usr/bin/python3 scripts/production-rollout.py --apply "$evidence/provider.json" |
  python3 scripts/diagnostics/record-jsonl.py "$evidence/checks.jsonl"
