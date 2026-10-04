#!/usr/bin/env bash
set -euo pipefail
[[ $# == 1 ]] || exit 64
case "$1" in
  restart) exec /usr/bin/systemctl restart searchfloor-opds.service ;;
  stop) exec /usr/bin/systemctl stop searchfloor-opds.service ;;
  reset-cache)
    state=$(/usr/bin/systemctl show searchfloor-opds.service -p ActiveState --value)
    [[ "$state" == inactive || "$state" == failed ]] || { echo 'Stop OPDS before cache reset' >&2; exit 1; }
    cache=/var/lib/searchfloor-opds/cache
    [[ -d "$cache" && ! -L "$cache" ]] || exit 1
    for name in catalog.sqlite catalog.sqlite-wal catalog.sqlite-shm; do
      path="$cache/$name"
      [[ ! -e "$path" || -f "$path" || -L "$path" ]] || exit 1
      /usr/bin/rm -f -- "$path"
    done ;;
  *) exit 64 ;;
esac
