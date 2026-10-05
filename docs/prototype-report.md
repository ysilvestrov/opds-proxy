# Private HTTPS prototype preparation report

Actual checks: **2026-10-04 22:17:48–22:19:25 UTC** on the current host.
Status: **artifact verified and staged; installation/startup/HTTPS blocked**.
Production activation is NO-GO. No installed or working HTTPS endpoint is claimed.

## Scope and checkout

Separate checkout: `/home/ysi/opds/opds-proxy-prototype`, branch `feat/opds-v1`,
instruction HEAD `a53812af538cc43e3f68d365f013dd79c1ae9d9a`.
Read `AGENTS.md`, complete `spec.md`, `docs/codex-cli-prototype.md`,
`deploy/README.md`, `docs/server-audit.md`, `docs/linux-ci-evidence.md`,
`docs/fbreader-acceptance.md` and the reviewed implementation plan.
Requirements: ARCH-001, AUTH-001, CONFIG-001, DEPLOY-001, OPS-002, ACCEPT-001.
No requirements or application behavior changed; `spec.md` needs no amendment.

Instruction HEAD is distinct from the pinned application SHA. Comparing
`scripts/`, `deploy/` and the workflow against the pinned SHA found only the
documented workflow-ID substitution in `deploy/deploy.env.example`.
Installed deploy.env does not exist here and was not created or edited.

## Read-only preflight

| Check | Actual result |
|---|---|
| OS / CPU | Ubuntu 24.04.4 LTS / x86_64, Node arch x64 |
| glibc | 2.39 |
| `/usr/bin/node` | v24.19.0, modules ABI 137 |
| `/usr/bin/python3` | 3.12.3 |
| RAM | 8,127,746,048 B total; 6,307,954,688 B available |
| Swap | 4,294,963,200 B total; 1,076,068,352 B used |
| Root filesystem | 35,807,309,824 B available; 54% used |
| Free inodes | 2,094,828; 57% used |
| Port 8787 | No TCP listener, before and after preparation |
| Production OPDS | not-found / inactive / dead |
| Prototype unit | not-found / inactive / dead |
| OPDS deploy service | not-found / inactive / dead |
| Production timer | not-found / inactive / dead; not enabled |
| Runtime/deploy accounts | `getent passwd` returned no account for either name |
| OPDS target directories | `/opt/searchfloor-opds`, `/etc/searchfloor-opds`, `/var/lib/searchfloor-opds`, `/var/lib/searchfloor-opds-deploy`: absent or inaccessible in sandbox |
| Cloudflared | active/running, NRestarts=0; no configuration/command-line/token read |
| Hostname DNS | A, AAAA and CNAME: NXDOMAIN via host resolver at 22:18:25 UTC |
| HTTPS probe | curl exit 6, could not resolve host; HTTP 000, no response |
| Tunnel mapping | Unverified: no dashboard/API access; usual local config paths absent or inaccessible |

NXDOMAIN does **not** establish that the remotely managed tunnel has no matching
route. Confirm route ownership and collisions in the dashboard before adding it.
No existing tunnel routes, including beer-api, were changed.
These resource snapshots do not establish peak capacity.

## Exact CI and artifact evidence

Metadata was re-read using the operator's existing `gh` access, without printing
credentials. Bot paths, secrets and credentials were not read. Separate
read-only credentials for the future deploy account remain unverified.

| Identity | Verified value |
|---|---|
| Repository | `ysilvestrov/opds-proxy` |
| Workflow | OPDS CI, `.github/workflows/ci.yml`, ID `374905819`, active |
| Run | [37238876789](https://github.com/ysilvestrov/opds-proxy/actions/runs/37238876789), attempt 1 |
| Origin | push / feat/opds-v1 / head_repository `ysilvestrov/opds-proxy` |
| Application SHA | `16cc521448bbb792aa74594cf7c1c1def5ae16f9` |
| Run state | completed / success |
| Required jobs | test, typecheck, build, package: each completed / success |
| Artifact | ID `11316800751`, `opds-prototype-16cc521448bbb792aa74594cf7c1c1def5ae16f9` |
| Expiry | expired=false; expires `2026-10-18T22:09:14Z` |
| Wrapper | 7,355,075 B |
| Wrapper SHA256 | `44b0d9421087466537e7e1d73379575a0725a15f021aed833478053f490ae1de` |
| release.tgz SHA256 | `e681894680fbc8fec0ab14b453dcce9526e856a28b5d37b06243829fcf90984c` |
| Manifest | exact SHA, Linux/x64, Node major 24, ABI `137`, glibc `2.39`, cache schema 1 |

Wrapper digest matches both GitHub metadata and the pinned evidence.
Reviewed `scripts/safe-extract.py` accepted the ZIP wrapper; external tar checksum
was verified **before** tar extraction. The same extractor accepted the tar.
Reviewed `compatibleManifest` returned **true** against the actual host.
No artifact code or native module was executed; no npm install/build was run.
CI native-load evidence remains distinct from an actual installed runtime check.

Owned staging directory (mode 0700):
`/home/ysi/opds/prototype-staging-16cc521`.
It contains `artifact.zip`, `wrapper/release.tgz`,
`wrapper/release.tgz.sha256`, and `extracted/`.
Extracted directory size: **28,855,828 B** (`du -sb`). It is staged, not immutable
installed code; it must be revalidated before a later privileged installation.
Only one candidate is staged; two-release usage has not been measured.

## Prepared infrastructure verification

All commands below actually ran and exited 0:

```sh
bash -n deploy/bootstrap.sh
bash -n deploy/restart-helper.sh
systemd-analyze verify deploy/*.service deploy/*.timer
visudo -cf deploy/sudoers
bash deploy/bootstrap.sh --dry-run
```

Systemd emitted a warning about the existing unrelated `48-hours-trip` account
name. Visudo reported sandbox ownership of `/etc/sudo.conf` as UID 65534, but
explicitly returned `deploy/sudoers: parsed OK`. Neither is evidence of installed
sudo rights. The dry-run describes independent accounts, OPDS paths and fixed
helpers; it starts/enables nothing and preserves existing env files.

Prototype unit was inspected: loopback application config, separate
code/cache/env, Restart=no, no Install section, MemoryHigh=256M,
MemoryMax=384M, CPUQuota=50%, TasksMax=64 and writable prototype-cache only.
Its Conflicts relation means production/port checks must precede any start,
otherwise systemd could stop an existing production unit.

## Protected reader fixture preparation

Static Atom acquisition documents are staged under
`/home/ysi/opds/prototype-staging-16cc521/reader-fixture/` (0700 directory,
0600 files). `page-1.xml` has zero entries and a next link to `page-2.xml`;
page 2 has a distinct title and no next. Both parsed as XML; entry/next counts
were checked. The proposed absolute path is `/reader-fixture/page-N.xml` under
the candidate HTTPS hostname. It is **not** an implemented application route.

These documents contain no acquisition links, credentials or fabricated complete
books, and do not touch any cache. Serving remains blocked: the pinned application
does not host this path. Before reader acceptance, arrange a separate protected
static fixture origin and an explicit path route, with dedicated Basic over HTTPS
on every fixture request. Do not publish these files without auth, mutate the
application/cache, or claim renderer/FBReader acceptance from XML parsing.

## Blockers and concrete operator continuation

1. **Root installation unavailable.** `sudo -n true` exited 1:
   `The "no new privileges" flag is set, which prevents sudo from running as root.`
   It also reported `/etc/sudo.conf` mapped to UID 65534. No escalation or bypass
   was attempted. Per the brief, operator installation must run outside this
   restricted CLI sandbox.
2. **Cloudflare route access unavailable.** DNS is NXDOMAIN and dashboard mapping
   cannot be inspected here. The owner must verify the hostname is unused and
   add only `opds.ysilvestrov-ai.uk` -> `http://127.0.0.1:8787` to the existing
   tunnel, preserving all existing routes. Basic must reach the origin; browser
   Access login cannot substitute for it. The fixture path requires a separately
   reviewed protected origin/path mapping before publishing it.
3. **Installed runtime/credentials absent.** The runtime account cannot load native
   SQLite until bootstrap is installed. Dedicated prototype credentials have not
   been generated because no root-only storage/retrieval is available here.
4. **Runtime and device evidence pending.** HTTPS 401/challenge/authenticated XML,
   health SHA, actual native/cache startup, RSS/CPU/cache+WAL and FBReader for
   Android 3.8.31 Basic forwarding/ZIP open/empty-page navigation are untested.

Operator commands for bootstrap from the prepared checkout:

```sh
cd /home/ysi/opds/opds-proxy-prototype
bash -n deploy/bootstrap.sh
bash -n deploy/restart-helper.sh
systemd-analyze verify deploy/*.service deploy/*.timer
visudo -cf deploy/sudoers
bash deploy/bootstrap.sh --dry-run
systemctl show searchfloor-opds.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer -p LoadState -p ActiveState -p UnitFileState
ss -ltn 'sport = :8787'
sudo bash deploy/bootstrap.sh --apply
```

Review the dry-run/files and recheck account/path collisions first; stop if any
production OPDS is running, deploy service/timer is active, or timer enabled.
Bootstrap installs infrastructure but starts/enables nothing. Re-run metadata,
digests, safe extraction and manifest compatibility checks before installing the
staged candidate. Using operator privileges, install **only** the verified
`extracted/` directory into the fresh
`/opt/searchfloor-opds/prototype/16cc521448bbb792aa74594cf7c1c1def5ae16f9`;
make its complete tree root-owned, directories 0755/files 0644, runtime-readable
and runtime-unwritable. Refuse collisions/symlinks; atomically rename a new
prototype/current symlink pointing to this exact directory. Do not modify
production current, releases, state, lock or PAUSED. Never execute artifact code
as root. Existing env files must remain preserved.

Edit only `/etc/searchfloor-opds/prototype.env` with protected operator tooling:
PUBLIC_BASE_URL=https://opds.ysilvestrov-ai.uk, PORT=8787,
CACHE_PATH=/var/lib/searchfloor-opds/prototype-cache/catalog.sqlite and fresh
dedicated OPDS_USERNAME/OPDS_PASSWORD. Keep file root:root/0600. Generate/store
secrets via protected file/stdin, never argv, URLs, shell history or logs. Give
the owner access via a trusted private root session/password manager; the report
contains no credentials. Leave runtime.env/deploy.env placeholders untouched.

After route review, root-only config and immutable installation, recheck port,
production/deploy/timer state and bot baseline, then start **only**:

```sh
sudo systemctl start searchfloor-opds-prototype.service
systemctl show searchfloor-opds-prototype.service -p ActiveState -p SubState -p NRestarts -p MemoryCurrent -p CPUUsageNSec
curl --max-time 10 http://127.0.0.1:8787/health
```

Do not enable prototype at boot. Require readiness SHA to equal the pinned SHA.
Check unauthenticated root/source/OpenSearch/search/download return 401 with
Basic challenge locally and via HTTPS. Read credentials using protected config
retrieval inside a checking process, and supply auth headers in memory; do not
use `curl -u` with passwords in argv. Parse authenticated root, source root and
OpenSearch XML, confirm MIME/absolute HTTPS links, then perform bounded completed
and search checks. Record RSS/CPU and prototype DB/WAL/SHM sizes and compare bot
health/NRestarts. Stop on Basic/MIME/startup/collision/resource concerns.

Only after these checks, give the owner the verified
`https://opds.ysilvestrov-ai.uk/opds` and secure credential retrieval. This is a
candidate URL today, **not a working endpoint**. Have the owner follow
`docs/fbreader-acceptance.md`; record actual device test date/results there.
Curl alone cannot pass Basic forwarding or ZIP opening.

After controlled testing completes (or a stop condition occurs):

```sh
sudo systemctl stop searchfloor-opds-prototype.service
systemctl show searchfloor-opds-prototype.service searchfloor-opds.service searchfloor-opds-deploy.timer -p ActiveState -p UnitFileState
```

Production and its timer must remain disabled. No promotion of prototype
artifact/state, main merge, production deploy or timer enable is authorized by
this report. Later production/rollback/two-release measurements remain separate.

## Bot before/after and unchanged host

| Observation | Before 22:17:48 UTC | After 22:19:25 UTC |
|---|---|---|
| warsaw-beer-bot.service | active / running | active / running |
| NRestarts | 0 | 0 |
| `127.0.0.1:3000/health` | HTTP 200, `{"ok":true}` | HTTP 200, `{"ok":true}` |
| OPDS production/prototype/deploy units | not-found / inactive | not-found / inactive |
| OPDS production timer | not-found / inactive, not enabled | not-found / inactive, not enabled |
| Listener 8787 | none | none |

No bot DB, secrets, release tree, state, locks or unit were read or modified.
Only permitted service state and minimal health were queried. No accounts,
systemd infrastructure, DNS, routes, packages, privileged paths or credentials
were installed/changed. Files created are the separate checkout, owned staging
artifact/extraction/fixture files and this report. No deployment succeeded, so
post-deployment cleanup does not apply; staged inputs remain for the operator.
