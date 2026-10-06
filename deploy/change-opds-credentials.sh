#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help && $# == 1 ]]; then
  echo 'Usage: bash deploy/change-opds-credentials.sh'
  echo 'Private interactive username/password update; no credentials in arguments.'
  exit 0
fi
[[ $# == 0 && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'Run without sudo in a private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
sudo -v
sudo /usr/bin/python3 scripts/change-opds-credentials.py
