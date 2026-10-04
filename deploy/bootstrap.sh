#!/usr/bin/env bash
# Installs reviewed infrastructure; never activates a unit or changes the tunnel.
set -euo pipefail
mode=${1:---dry-run}
[[ $# -le 1 && ( "$mode" == --apply || "$mode" == --dry-run ) ]] || exit 64
base=$(cd -- "${BASH_SOURCE[0]%/*}/.." && pwd)
if [[ "$mode" == --dry-run ]]; then
  printf '%s\n' \
    'Create independent nologin accounts: searchfloor-opds, searchfloor-deploy.' \
    'Runtime writable: /var/lib/searchfloor-opds/cache.' \
    'Deploy writable: /opt/searchfloor-opds/{staging,releases,current}, /var/lib/searchfloor-opds-deploy/{state,lock}.' \
    'Root-owned: /etc/searchfloor-opds, /usr/local/lib/searchfloor-opds,' \
    ' /usr/local/sbin/searchfloor-opds-control, /etc/sudoers.d/searchfloor-opds,' \
    ' /etc/systemd/system/searchfloor-opds*.{service,timer}.' \
    'Preserve existing environment files. New templates require operator edits.' \
    'No unit start/enable, no route, no bot changes, no build/npm install.'
  exit 0
fi
[[ $EUID == 0 ]] || { echo 'Operator root required for --apply' >&2; exit 1; }
[[ $(/usr/bin/node -p 'process.versions.node.split(".")[0]') == 24 ]] || exit 1
/usr/bin/python3 -c 'import sys; assert sys.version_info >= (3,12)'
for parent in /opt /var/lib /etc /usr/local/lib /usr/local/sbin /etc/sudoers.d /etc/systemd/system; do
  [[ -d "$parent" && ! -L "$parent" ]] || { echo 'Unsafe parent' >&2; exit 1; }
done
for account in searchfloor-opds searchfloor-deploy; do
  if ! /usr/bin/id "$account" &>/dev/null; then
    /usr/sbin/useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$account"
  else
    [[ $(/usr/bin/getent passwd "$account" | /usr/bin/cut -d: -f7) == /usr/sbin/nologin ]] || exit 1
  fi
done
directory() { [[ ! -L "$1" ]] || exit 1; /usr/bin/install -d -m "$2" -o "$3" -g "$3" "$1"; }
directory /opt/searchfloor-opds 0755 searchfloor-deploy
directory /opt/searchfloor-opds/staging 0700 searchfloor-deploy
directory /opt/searchfloor-opds/releases 0755 searchfloor-deploy
directory /var/lib/searchfloor-opds 0755 root
directory /var/lib/searchfloor-opds/cache 0700 searchfloor-opds
directory /var/lib/searchfloor-opds-deploy 0750 searchfloor-deploy
directory /var/lib/searchfloor-opds-deploy/state 0700 searchfloor-deploy
directory /etc/searchfloor-opds 0700 root
directory /usr/local/lib/searchfloor-opds 0755 root
for name in autodeploy.mjs artifact.mjs observe.mjs run-deploy.mjs safe-extract.py; do
  [[ ! -L "/usr/local/lib/searchfloor-opds/$name" ]] || exit 1
  /usr/bin/install -m 0644 -o root -g root "$base/scripts/$name" "/usr/local/lib/searchfloor-opds/$name"
done
[[ ! -L /usr/local/sbin/searchfloor-opds-control ]] || exit 1
/usr/bin/install -m 0755 -o root -g root "$base/deploy/restart-helper.sh" /usr/local/sbin/searchfloor-opds-control
/usr/sbin/visudo -cf "$base/deploy/sudoers"
[[ ! -L /etc/sudoers.d/searchfloor-opds ]] || exit 1
/usr/bin/install -m 0440 -o root -g root "$base/deploy/sudoers" /etc/sudoers.d/searchfloor-opds
for unit in searchfloor-opds.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer; do
  [[ ! -L "/etc/systemd/system/$unit" ]] || exit 1
  /usr/bin/install -m 0644 -o root -g root "$base/deploy/$unit" "/etc/systemd/system/$unit"
done
for envfile in runtime.env deploy.env; do
  path="/etc/searchfloor-opds/$envfile"
  [[ ! -L "$path" ]] || exit 1
  if [[ ! -e "$path" ]]; then
    /usr/bin/install -m 0600 -o root -g root "$base/deploy/$envfile.example" "$path"
  fi
done
/usr/bin/systemctl daemon-reload
echo 'Prepared only. Edit env files, verify acceptance/route/artifact, then operator starts first release.'
