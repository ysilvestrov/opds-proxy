#!/usr/bin/env bash
# Update only the private prototype, retaining independent proxy and Basic config.
set -euo pipefail
set +x
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: bash deploy/update-fbreader-prototype.sh'
  echo 'Stop prototype, stage verified FB2 MIME artifact, validate HTTPS, start for reader.'
  echo 'Failure leaves prototype stopped; existing proxy/Basic config is preserved.'
  exit 0
fi
[[ $# == 0 && $EUID != 0 && -t 0 && -t 1 ]] || { echo 'STOP: run without sudo in your private interactive terminal.' >&2; exit 1; }
base=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$base"
[[ $(readlink -f /opt/searchfloor-opds/prototype/current) == /opt/searchfloor-opds/prototype/e57f0a6d33799593afc594a8adefabfa46ee6341 ]] || { echo 'STOP: unexpected prototype baseline.' >&2; exit 1; }
for unit in searchfloor-opds.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer; do
  [[ $(systemctl show "$unit" -p ActiveState --value) == inactive ]] || { echo "STOP: $unit must be inactive." >&2; exit 1; }
done
[[ $(systemctl show searchfloor-opds-deploy.timer -p UnitFileState --value) == disabled ]] || { echo 'STOP: production timer must be disabled.' >&2; exit 1; }
python3 - <<'CHECK'
import json, subprocess
r=json.loads(subprocess.check_output(['gh','api','repos/ysilvestrov/opds-proxy/actions/runs/37331575252']))
assert (r['head_sha'],r['head_branch'],r['event'],r['status'],r['conclusion'])==('c22ac2e6edafeba1563d88363326b2bd19cbb097','feat/opds-v1','push','completed','success')
print('Pinned feature push CI: PASS')
CHECK
sudo -v
sudo /usr/bin/systemctl stop searchfloor-opds-prototype.service
trap 'sudo -n /usr/bin/systemctl stop searchfloor-opds-prototype.service >/dev/null 2>&1 || true' ERR
echo 'Prototype stopped; staging corrected acquisition MIME.'
bash deploy/stage-fbreader-prototype.sh
bash deploy/validate-fbreader-prototype.sh
sudo /usr/bin/systemctl start searchfloor-opds-prototype.service
if python3 - <<'CHECK'
import json,time,urllib.request
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
deadline=time.monotonic()+15
while time.monotonic()<deadline:
    try:
        with opener.open('http://127.0.0.1:8787/health',timeout=1) as response:
            health=json.loads(response.read(4096))
            if response.status==200 and health.get('ready') is True and health.get('sha')=='c22ac2e6edafeba1563d88363326b2bd19cbb097':
                print('Corrected prototype ready for FBReader: c22ac2e')
                raise SystemExit(0)
    except Exception:pass
    time.sleep(0.25)
raise SystemExit(1)
CHECK
then
  echo 'Refresh the catalog in FBReader; check Download and open one FB2 ZIP.'
else
  sudo /usr/bin/systemctl stop searchfloor-opds-prototype.service
  echo 'STOP: final readiness failed; prototype stopped. Sanitized evidence retained.' >&2
  exit 1
fi
