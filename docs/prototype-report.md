# Desktop comparative diagnostic — 2026-10-05 09:26 UTC

Owner declined contacting the source administrator and requested another path.
Exactly one matching Node GET was made from the desktop PC to
`https://searchfloor.org/?page=1&status=is_finished`, using the existing
`opds-proxy/0.1` User-Agent and `text/html,application/zip` Accept header,
15-second timeout and manual redirects. No cookies, retries, proxies, alternate
UA, challenge solving or book download. Response inspection was capped at 16 KiB;
no raw HTML was stored or printed.

At `2026-10-05T09:26:36.401Z`: HTTP **200**, server `cloudflare`, content-type
`text/html; charset=utf-8`, CF-Ray `a45b62b7ee28b9e4-PRG`, cf-mitigated/retry-after
null. Inspected 16,384 bytes; all four diagnostic markers (1010, 1015,
challenge title, explicit access denied) false.

This shows the same ordinary client can receive HTTP 200 from the desktop while
the earlier VPS request received a challenge. It does not prove valid complete
HTML, successful parsing, downloads, stable future access or the specific rule
responsible for the VPS challenge. No new server unit/health checks were made.

Owner subsequently rejected local deployment: the solution must run entirely
on the server. ARCH-001 records this invariant. A server-browser feasibility
probe is a proposed next step, not an implemented/approved production transport. The administrator request
remains an unsent draft; contacting them is not an active next step.

---

# Private HTTPS prototype preparation report

## Latest source diagnostic — 2026-10-05 09:07–09:10 UTC

Executed `docs/codex-cli-source-diagnostics.md` as **diagnosis only**. Read
AGENTS/spec/source contract, the prior operator trace/evidence and the complete
actual terminal helper. No helper/application/artifact or infrastructure changes.
SOURCE-002, CACHE-002, AUTH-001, ARCH-001 and ACCEPT-001 remain unchanged;
COST-001 from the latest reviewed remote specification was also respected:
no Cloudflare operations or paid resources were requested.

Exactly **one** upstream request was made from this host with the brief's Node
code: system `/usr/bin/node`, 15-second timeout, manual redirects, exact URL
`https://searchfloor.org/?page=1&status=is_finished`, User-Agent `opds-proxy/0.1`
and Accept `text/html,application/zip`. No retries, cookies, proxy, browser-UA
substitution, book download or challenge solving. At most 16,384 response bytes
were inspected in memory; raw HTML was neither persisted nor printed.

Sanitized result (only the approved header allowlist and marker booleans):

```json
{
  "date": "2026-10-05T09:08:00.785Z",
  "status": 403,
  "headers": {
    "server": "cloudflare",
    "content-type": "text/html; charset=UTF-8",
    "cf-ray": "a45b47809a219ea9-CDG",
    "cf-mitigated": "challenge",
    "retry-after": null
  },
  "inspectedBytes": 5513,
  "markers": {
    "error1010": false,
    "error1015": false,
    "challengeTitle": true,
    "explicitAccessDenied": false
  }
}
```

No Location header was present. This is fresh evidence of a Cloudflare challenge
on the **upstream source**; it does not establish the specific rule, why this
client/host matched it, or permanent denial of all automated access. The exact
policy remains **unknown**. The response is not 200 and does not establish recovery.
Changing our inbound OPDS tunnel/WAF cannot resolve protection on searchfloor.org.

Trace interpretation is unchanged: operator helper reached the first live
completed assertion only after exact-SHA health, all 12 unauthenticated Basic
checks and 6 authenticated static XML/MIME/link checks across local/HTTPS origins.
These successes are **inferred from execution order and the reported assertion**,
not preserved per-request evidence. The stored `http-checks.json` is zero bytes;
the helper buffers all results until its final print. Its existing safety tests
cover collisions/help, not persistence of partial HTTP results. Helper and tests
were inspected and returned unchanged, not fixed in this diagnostic step.

| Unit/health | Before 09:07:28 UTC | After 09:10:02 UTC |
|---|---|---|
| Prototype | inactive/dead, static, NRestarts=0 | unchanged |
| Production OPDS | inactive/dead, disabled, NRestarts=0 | unchanged |
| Deploy service | inactive/dead, static, NRestarts=0 | unchanged |
| Production timer | inactive/dead, disabled | unchanged |
| Bot | active/running, NRestarts=0 | unchanged |
| Bot loopback health | HTTP 200, `{"ok":true}` | HTTP 200, `{"ok":true}` |

No prototype/production/timer restart, bootstrap, reinstall, env/credential read,
credential regeneration, bot resource access or Cloudflare operation occurred.
Remaining gates: approved source access, reliable per-request evidence on resumed
validation of the **existing** installation, bounded live catalog/search tests,
runtime RSS/CPU/cache measurements, protected empty-page fixture and actual
FBReader Basic acquisition/ZIP opening. No catalog acceptance is claimed.

Prepared owner-review draft: `docs/source-access-request.md`. It asks Searchfloor
to inspect the timestamp/CF-Ray and specify permitted API/client/allowlist access
and limits. **Not sent**. No UA spoofing, proxy/IP changes or challenge bypass
is proposed as a fix. After authorized access is restored, separately arrange
manual prototype startup and validation without running installer --apply again.

Desktop handoff: `/home/ysi/opds/source-diagnostics-handoff-20261005.tar.gz` with
a companion `.sha256`. It contains exact helper/tests, deployment README, this
report, the diagnostic brief, access-request draft, sanitized response/unit/health
evidence and a review patch relative to fetched `origin/feat/opds-v1`
`66f6d4785bc1341b84f6c6cb86eac365b3d5d9a1`. No publishing/PR change was made.
Helper SHA256 before/after: `c78b12caf4cc1ad4537da9102ad2ccd01bb135ef0c9c2dd03abb68324105dc69`.
Tests SHA256 before/after: `34240ae47ae545757ea66aaf103f5b44020bcdc1195cc743c8ca880ecaaf7877`.
The bundle excludes env files, credentials, bot data, raw source HTML and release
archives. Review the patch before applying it to a desktop checkout with its own
changes; no automatic patch application or merge is implied.

## Latest operator result — 2026-10-05 08:50–08:51 UTC

Infrastructure and pinned prototype code/current/config **were installed by the
operator** using `deploy/start-prototype.sh --apply`. The prototype started and
was subsequently stopped by the failure trap. Current blocker: **Searchfloor
denies the matching Node request with HTTP 403; live catalog returns 503**.
The earlier uninstalled/DNS-blocked statuses below are historical.

Operator evidence: `prototype-staging-16cc521/terminal-6iQPyU` and the failed-run
entry at the end of this report. Operator terminal output confirms successful
bootstrap, root-owned immutable installation and protected prototype.env
preparation/preservation. Config/credentials were not read in this investigation.
Sandbox maps host ownership to nobody/nogroup, so ownership was not independently
certified from the sandbox's stat output.

Sanitized prototype journal for 08:49–08:51 UTC contains only:
`listening` with exact SHA `16cc521448bbb792aa74594cf7c1c1def5ae16f9` and port 8787,
one `request_failed` with status 503, then `stopped`. No startup or native-module
error was observed. Reaching readiness confirms native SQLite/cache startup.

The operator verifier reached the first live completed feed assertion. Its
execution order establishes that exact-SHA health, unauthenticated Basic 401
checks for root/source/OpenSearch/completed/search/download and authenticated
root/source/OpenSearch XML/MIME/absolute-link checks passed both locally and
through HTTPS before the live request failed. This is supported by the supplied
trace location; individual passed checks were not persisted because the verifier
prints its JSON only after completing all checks. `http-checks.json` is empty,
so there is no independent per-request status record and no full acceptance claim.
Search/download/reader tests, RSS/CPU/cache sizes and ZIP opening remain Pending.

Read-only diagnosis at **08:51:35 UTC** reproduced one bounded upstream GET:
`https://searchfloor.org/?page=1&status=is_finished`, system Node 24 fetch,
manual redirects, 15-second timeout, User-Agent `opds-proxy/0.1` and
Accept `text/html,application/zip` (exact client headers). Response:
**403**, MIME `text/html; charset=UTF-8`, no Location or Retry-After.
Body was cancelled, not stored or printed. No further source requests, retries,
header/user-agent substitutions, proxy changes or challenge bypass were attempted.
The exact upstream policy producing 403 is unknown; WAF/IP/geographic/client rules
have not been established. This is evidence of denial, not proof of any one rule.

Causal path: `SearchfloorClient.request` rejects HTTP 403 with
`SourceError("Source denied request")`; its default status is 503.
With no usable cached page, Catalog propagates it; HTTP API returns 503 and the
terminal helper's live-feed assertion fails, triggering prototype stop.
Relevant code: `src/sources/searchfloor/client.ts`, `src/catalog.ts`,
`src/api/app.ts`, `deploy/start-prototype.sh`. SOURCE-002 requires denial without
bypass; CACHE-002 allows 503 without usable cache. No source/application fix or
artifact substitution is justified by this evidence.

Current actual state: prototype inactive/dead, NRestarts=0, static; production
inactive/dead and disabled; timer inactive/dead and disabled. Bot remains
active/running, NRestarts=0; loopback health HTTP 200, `{"ok":true}`.
No credentials, bot resources, Cloudflare routes/settings, application code or
installed units were changed during diagnosis. The prototype was not restarted.

**Do not rerun --apply:** prototype code/current already exist and the installer
deliberately refuses that collision. Resolve authorized upstream access first,
then resume validation of the existing installation without reinstalling or
regenerating credentials. An owner/source-side access decision is needed before
the live catalog can be accepted; do not weaken Basic or expose it publicly.

Operator helper prepared: `deploy/start-prototype.sh`. Run as the normal user
in a private SSH terminal with `bash deploy/start-prototype.sh --apply`.
It prompts for sudo inside the script, revalidates the pinned artifact, prepares
prototype-only code/config, starts the manual unit and performs protected HTTP
checks. Success/failure appends actual evidence here. No apply was run by Codex.
The helper's `--check` ran successfully against the actual GitHub artifact on
2026-10-05; no sudo/install/start occurred. Bash and embedded Python syntax checks
passed, as did the Python suite (5 tests including refusal of production/deploy/
timer/prototype/port collisions before network or sudo). This proves preparation
and safety guards, not actual privileged installation or HTTPS runtime acceptance.

## Current continuation status — 2026-10-05

Actual continuation checks: **08:15:19–08:16:44 UTC**.
Status: **exact artifact revalidated; bootstrap blocked by sudo authentication**.
DNS now resolves and HTTPS responds, but the prototype remains uninstalled and
the endpoint returns **502**, not a working private catalog. Production and its
timer remain inactive/not installed. FBReader acceptance remains Pending.

Read the user-provided `docs/codex-cli-prototype-continuation.md`, existing
instructions/specification, original prototype brief and this report. Fetched
`origin/feat/opds-v1`: latest instruction commit
`66f6d4785bc1341b84f6c6cb86eac365b3d5d9a1`. Read its continuation brief,
`docs/cloudflare-route-report.md` and specification changes via `git show`/diff.
The latest specification is 0.4.1 and adds COST-001; no Cloudflare configuration,
paid features or subscriptions were changed during this continuation.
Local HEAD remains `a53812af538cc43e3f68d365f013dd79c1ae9d9a`; the existing
untracked continuation brief and report were preserved without checkout/merge
overwrites. Remote changes to operator scripts/units/workflow: none.
The **application** remains pinned to `16cc521448bbb792aa74594cf7c1c1def5ae16f9`.

### Fresh safety and route observations

| Check | Before, 08:15:19 UTC | After, 08:16:44 UTC |
|---|---|---|
| Bot service | active/running, NRestarts=0 | active/running, NRestarts=0 |
| Bot loopback `/health` | HTTP 200, `{"ok":true}` | HTTP 200, `{"ok":true}` |
| Production OPDS | not-found/inactive/dead | not-found/inactive/dead |
| Prototype unit | not-found/inactive/dead | not-found/inactive/dead |
| OPDS deploy service | not-found/inactive/dead | not-found/inactive/dead |
| OPDS timer | not-found/inactive/dead; not enabled | not-found/inactive/dead; not enabled |
| Port 8787 | No TCP listener | No TCP listener |

Cloudflared was active/running with NRestarts=0. DNS A responses were
`172.67.162.84` and `104.21.33.116`; HTTPS GET `/opds` returned HTTP **502**.
TLS verification was left enabled, redirects were not followed, and no edge
protection/client-signature settings were altered.
Read the latest recorded Cloudflare API evidence: existing healthy `hetzner-vps`
tunnel, configuration version 4, exact OPDS mapping to
`http://127.0.0.1:8787`, existing beer-api/code routes preserved, Free Website.
This continuation verifies DNS/HTTP externally; it does not independently
re-read the dashboard/API configuration. **Do not recreate the existing route.**
The earlier NXDOMAIN/route-creation instructions below are historical and
superseded by this continuation and the route report.

### Fresh artifact and preparation checks

Re-read GitHub workflow/run/jobs/artifact metadata. Same repository, workflow
`374905819`, successful completed push run `37238876789`, exact branch/SHA and
all four successful jobs. Artifact `11316800751` has the exact pinned name,
7,355,075-byte wrapper, expected GitHub digest and expired=false; expiry remains
`2026-10-18T22:09:14Z`. No new/latest application artifact was substituted.

Re-hashed both local archives: wrapper
`44b0d9421087466537e7e1d73379575a0725a15f021aed833478053f490ae1de`, tar
`e681894680fbc8fec0ab14b453dcce9526e856a28b5d37b06243829fcf90984c`.
External checksum file exactly identified `release.tgz`. Used the reviewed
safe extractor again into fresh owned staging:

```text
/home/ysi/opds/prototype-staging-16cc521/recheck-20261005-6L94hu/wrapper
/home/ysi/opds/prototype-staging-16cc521/recheck-20261005-6L94hu/extracted
```

Verified the fresh wrapper's external tar checksum before safe tar extraction.
Manifest compatibility returned true: exact application SHA, Linux/x64,
Node major 24, ABI 137, glibc 2.39, cache schema 1. Host `/usr/bin/node` remains
v24.19.0/ABI 137/glibc 2.39; Python remains 3.12.3.
Compared every relative directory/file and file SHA256 in the earlier extracted
tree against the fresh one: identical, with no symlinks or special entries.
No artifact code/native module was executed and no npm install/build ran.

Re-ran both `bash -n` checks, `systemd-analyze verify`, `visudo -cf deploy/sudoers`
and bootstrap dry-run: all exited 0. The same unrelated account-name and sandbox
sudo.conf ownership warnings appeared; sudoers explicitly parsed OK.

### Privileged installation attempt and remaining operator action

The continuation explicitly authorizes the platform's ordinary privileged-command
approval mechanism. Used it for this exact prepared action, with noninteractive
sudo to avoid requesting/logging a password:

```sh
sudo -n bash /home/ysi/opds/opds-proxy-prototype/deploy/bootstrap.sh --apply
```

The privileged tool call ran; **sudo exited 1: `sudo: a password is required`**.
This was a sudo authentication failure, not an automatic approval-review
rejection. Bootstrap did not execute or install anything. No attempt was made
to bypass sudo, alter sandbox protections, obtain the password in chat, or use
bot privileges/credentials. This replaces the prior no-new-privileges diagnosis
for the latest attempt: the ordinary privileged mechanism reached sudo, which
requires operator authentication for this command.

The concrete next step is an authenticated normal operator SSH session:

```sh
cd /home/ysi/opds/opds-proxy-prototype
systemctl show searchfloor-opds.service searchfloor-opds-prototype.service searchfloor-opds-deploy.service searchfloor-opds-deploy.timer -p LoadState -p ActiveState -p UnitFileState
ss -ltn 'sport = :8787'
bash deploy/bootstrap.sh --dry-run
sudo bash deploy/bootstrap.sh --apply
```

Enter the sudo password only in that session's protected interactive prompt.
Stop on production/deploy/timer activity, enabled timer or port/path collisions.
Do not start/enable any production unit or timer. Then continue the immutable
installation/config/start/verification procedure recorded below and in the
continuation brief, revalidating the artifact and host at the time of install.
Use the freshly extracted candidate above; preserve existing env files and
configure only prototype.env with dedicated credentials stored root:root/0600.

Dependent steps remain blocked: immutable `/opt` installation, prototype/current,
root-only credential generation/retrieval, runtime account/native/cache startup,
manual systemd start, local/HTTPS 401 Basic challenge and authenticated XML,
bounded completed/search probes and RSS/CPU/cache+WAL/SHM measurements.
No functional catalog URL or credentials can be issued yet. No Searchfloor
requests or book downloads were made during this continuation.

The controlled reader fixture still has no protected serving origin/route;
the continuation explicitly leaves it separate from main prototype startup.
It was not published or added to any cache. Full ACCEPT-001 remains Pending;
record actual owner/device results in `docs/fbreader-acceptance.md` later.

No bot resources, Cloudflare/DNS settings, units/accounts, production pointers,
state/locks, environment files or system packages changed. The only new files
are the fresh owned extraction, plus the updated report; fetching updated Git
remote metadata. No successful deployment or merged worktree cleanup occurred.

## Historical preparation — 2026-10-04

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

## Failed operator terminal run — 2026-10-05T08:50:32.096077+00:00

Exit 1. Installation may be partial; inspect before rerunning. No acceptance is claimed.
Protected evidence: `/home/ysi/opds/prototype-staging-16cc521/terminal-6iQPyU`.

```text
Id=searchfloor-opds-prototype.service
LoadState=loaded
ActiveState=inactive
UnitFileState=static

Id=searchfloor-opds.service
LoadState=loaded
ActiveState=inactive
UnitFileState=disabled

Id=searchfloor-opds-deploy.timer
LoadState=loaded
ActiveState=inactive
UnitFileState=disabled
```
