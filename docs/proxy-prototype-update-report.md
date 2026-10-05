# Proxy prototype update — server acceptance passed

Latest outcome14:19UTC: private HTTPS feeds and one ZIP/FB2 passed on e57f0a6.
Prototype stopped, new current/config retained, bot healthy, production timer off.
Main dashboard actual usage after5.88MB recorded. Device/protected empty-page
and separate sub-user actual-after evidence remain pending. Earlier blockers
and failed attempts below are historical and resolved as described afterward.

2026-10-05. Requirements: DEPLOY-001, OPS-002, SOURCE-002/003,
CONFIG-001, AUTH-001, DOWNLOAD-001/002, ACCEPT-001.

Fetched feat/opds-v1 at `d13e6ee`; read AGENTS.md, root spec0.4.6,
approved source-proxy plan, exact-SHA CI evidence and the update procedure.
Work is on `codex/proxy-prototype-acceptance` in the clean operator checkout
`/home/ysi/opds/diagnostics-20261005`. Original dirty server checkout
`/home/ysi/opds/opds-proxy-prototype` and its operator files are preserved.

## Completed preparation

- Verified application SHA `e57f0a6d33799593afc594a8adefabfa46ee6341`,
  exact feature push run37311541114/workflow374905819, repository/branch/event,
  completed-success test/typecheck/build/package jobs, artifact11346670844,
  nonexpired retention, API digest and wrapper size before extraction.
- Wrapper SHA256 and external release.tgz checksum match CI evidence. Reviewed
  safe ZIP/tar extractor accepted both fresh directories. Manifest matches
  Linux/x64/Node24/ABI137/glibc2.39/schema1 and the actual host report.
- Staged native better-sqlite3 `SELECT 1` succeeded in an in-memory DB as the
  unprivileged operator. Runtime-user verification after root-owned copying
  has **not** occurred. No npm install/build on the host.
- 11 Python offline tests passed. Deployment shell/Python syntax passed.
- Recorded before/after bot health, restarts, OPDS units, resource headroom,
  baseline pointer/manifest, mapped metadata and existing unit definition.
  Unit has separate runtime user/cache, MemoryHigh256M/MemoryMax384M,
  CPUQuota50%, TasksMax64 and TimeoutStopSec25s.

Evidence: `proxy-prototype-update-artifact.json`,
`proxy-prototype-update-baseline.json`, `proxy-prototype-update-unit.txt`.
Private operator staging remains at the path in the artifact receipt, mode0700;
artifact/code contain no configuration or credentials. Its uninstalled logical
size and prior installed code size are recorded separately, not represented
as two installed releases or runtime capacity evidence.

## Exact blockers and stop point

Sandbox sudo reports `no new privileges` and mapped ownership. A permitted
outside-sandbox read-only `sudo -n` probe then returned **a password is required**.
Automatic approval did not reject that probe; operator sudo authentication is
unavailable. No password was requested, logged or supplied.

Therefore root:root0600 and the presence of independent `OPDS_SOURCE_PROXY_URL`
in protected `/etc/searchfloor-opds/prototype.env` remain unverified. We did not
read bot env or substitute its previously successful proxy. No env backup/edit,
root-owned copy, pointer switch, source GET or activation was attempted.

SOURCE-003 provider dashboard evidence is also missing: main/sub-user scope,
cycle boundaries, current shared remaining budget and dedicated OPDS baseline.
The earlier screenshot's unconfirmed scope and accepted1GB ceiling are not proof
that the shared plan currently covers one <=20MiB file plus bounded metadata.
No provider management/API credentials or settings were accessed/changed.

Continue only when an operator can perform the authorized privileged steps,
provide independent OPDS proxy credentials privately in its own protected env,
and confirm the dashboard budget evidence. Use the existing reviewed update
procedure and staged exact-SHA artifact; recheck expiry/digests/guards first.
Never send secrets in chat, Git, argv or reports. Do not rerun bootstrap/installer.

## Preserved final state and pending acceptance

Bot health200/ok=true, active/running, NRestarts0 before and after. Prototype,
production and deployer inactive; production timer inactive/disabled; port8787
free. Prototype/current still points to baseline
`16cc521448bbb792aa74594cf7c1c1def5ae16f9`. Old immutable code/config preserved.
Cloudflare route/tunnel, provider plan/sub-user and bot resources unchanged.

No live requests to Searchfloor, no book acquisition, no manual prototype start,
no rollback necessary. Baseline stays stopped (historical direct403 is unchanged).
No runtime RSS/CPU/MemoryPeak/cache measurement claimed for the new artifact.
Dedicated source GET, public/static/live search/pagination, one ZIP/FB2 or
cancellation branch, dashboard usage after and device acceptance remain pending.
Owner FBReader3.8.31/protected empty-page tests remain a separate gate.

No transient browser/process/secret file was created. Preserve staging/evidence
for continuation; there is no successful deployment or merged worktree to clean.
Sanitized preparation and the concrete blocker are delivered through Git only.

## Owner-requested private input helper

Owner confirmed credentials are not yet configured and requested a terminal
script to enter/copy them. `deploy/configure-prototype-proxy.sh` implements only
that private config step: hidden double input, safe URL validation, existing
Basic/base/port/cache preservation, fresh root-only backup and atomic env update.
It starts no service and copies no application artifact. Four new offline tests
cover config preservation, unsafe/existing proxy refusal, private backup/save
and noninteractive rejection. Full Python suite:15 passed; Bash/embedded-Python
syntax passed. The helper was not run against actual /etc in this session.
Operator sudo and dashboard budget remain prerequisites for activation.

Terminal helper corrections: bare filename path resolution fixed; real Linux
TTY reproduction showed r+ text open fails before credential input. Prompt stream
now opens write-only; getpass controls its own hidden input and visible fallback
is forbidden. Failure reports only stage/type.17 offline tests passed, including
a controlling-PTY double-input test proving fixture secret is not echoed.

Owner reports private proxy input completed. Agent read-only verification still
returns `sudo: a password is required` outside sandbox; root config verification
was not performed by the agent. Added terminal `--check`: validates protected
config and proxy URL and compares all prior settings to the newest private backup;
no writes/source requests/start.18 offline tests passed, including secret-free
output and refusal when prior Basic config differs. Provider budget gate remains.

## Private config operator verification — passed

Owner supplied successful `configure-prototype-proxy.sh --check` output:
valid=true, proxyPresent=true, configPreserved=true, backupCompared=true.
The helper enforces root-owned0600 config, root group and validates the private
proxy URL while comparing prior settings with its private backup. This is
operator-reported evidence, not an independent agent read. Sanitized record:
`proxy-prototype-private-config.json`. No credentials were transmitted.

Dedicated source GET is not yet performed. Current provider scope/cycle/shared
remaining budget and OPDS usage baseline were requested before continuing live
traffic. Agent sudo still requires operator authentication; protected copying,
source probe and activation will require the operator terminal.

## Provider baseline clarified by owner

Owner confirmed dashboard scope is main account:1.0GB limit, actual5.41MB;
cycle24Sep–24Oct2026 at12:11 (timezone unspecified). OPDS sub-user not used yet.
This reported actual headroom covers bounded metadata and one<=20MiB test ZIP;
projected usage/remaining are recorded as projections, not billed actuals.
Evidence: `proxy-prototype-provider-baseline.json`.

Prepared `deploy/stage-proxy-prototype.sh` for operator sudo terminal: rechecks
exact CI identity/expiry and root-owned baseline, rehashes protected artifact,
extracts fresh immutable code, verifies native module as runtime user, then does
exactly one dedicated source GET using the new source transport.20s process-group
bound/15s request/2MiB cap; no fallback/retry/current switch/service start.
Source failure restores protected pre-proxy config backup; candidate/evidence
remain. Operator JSONL recorder persists sanitized rows at the printed path.
This script has not executed on /opt or made source requests in the agent session.
20 offline tests and shell/embedded-Python/embedded-Node syntax checks passed.

## First operator staging attempt — guard mismatch corrected

The operator run failed before copying or source requests. Read-only metadata
outside sandbox established root /opt, but searchfloor-deploy ownership of
/opt/searchfloor-opds and prototype (UID993/GID984,0755), exactly as reviewed
bootstrap.sh specifies. Baseline code/current remain root-owned; candidate absent.
The helper had incorrectly required root for all parents. It now accepts only
root or the resolved dedicated deploy account on the two reviewed paths; /opt
stays root-only, symlink and group/world-write checks stay enforced. No host
chown/chmod/bootstrap rerun. Guard failures now include safe reason/details;
--check is read-only.22 offline tests passed. Evidence: proxy-stage-first-attempt.json.

## Dedicated OPDS source GET — passed

Operator executed reviewed staging helper. Fresh immutable application
e57f0a6d33799593afc594a8adefabfa46ee6341 is root-owned; runtime-user native
query passed; current/config unchanged and prototype not started. Dedicated
sub-user source GET returned200,151752 HTML bytes,20 parsed books,next2.
Sanitized JSONL read directly from operator evidence and committed as
`proxy-prototype-dedicated-source.jsonl`; no archive transfer.

Prepared `deploy/validate-proxy-prototype.sh` for one bounded operator session:
atomic prototype pointer switch, readiness/private feeds/completed/search/one
next page, one full ZIP acquisition in memory, resource snapshots, stop.
32MiB expanded FB2/64 archive-entry diagnostic caps supplement20MiB ZIP/60s
deadline. This exercises full-file validation, not server cancellation; local
cancellation integration remains separate evidence. Failure stops prototype
and restores pointer/pre-proxy config; no production/timer/bot changes.
26 offline tests passed, including actual temporary pointer/env rollback after
live-verifier failure. No activation/download has occurred in the agent session.

## First manual activation — local checks passed, inbound urllib rejected

Operator session13:59:39–13:59:42UTC activated exact e57f0a6 candidate. Readiness
and all local Basic/static XML/OpenSearch checks passed. First public /opds
unauthenticated urllib check got403, so no authenticated live feed or Download
was attempted. Prototype stopped; private pre-proxy env and baseline pointer
restored. Independent agent readback confirms old16cc521 pointer, stopped units,
disabled production timer and healthy bot/NRestarts0. The final-state row with
e57f0a6 is **before rollback**, not the final pointer: the following rollback
row and independent readback establish16cc521. Both immutable releases retained.
Evidence: `proxy-prototype-acceptance-first.jsonl`. No book bytes persisted.

Two finite own-host unauthenticated diagnostics after rollback: genuine urllib
received403 with Cloudflare1010; genuine system curl/default UA received502
consistent with the stopped origin. This same urllib1010 observation already
appears in cloudflare-route-report.md. It is inbound client/edge evidence, not
Searchfloor denial or proof that FBReader passes. No Cloudflare route/rules/tier
changed, no browser UA spoof or source request in these diagnostics.
Evidence: `proxy-prototype-inbound-diagnostics.jsonl`.

Added explicit `--transport curl` option to the read-only verifier and selected
system curl directly for future acceptance and acquisition checks, before any
request. Never automatic fallback/retry after403. Curl's actual default UA is
unchanged, ambient proxies/curlrc disabled, auth only stdin, caps/deadlines/no
redirects retained. Local real HTTP fixture tests check genuine curl identity,
non-argv auth, absent auth for401 and unknown-length response cap.27 tests passed.
Runtime resource snapshot now also occurs after readiness so failed public
checks retain real process RSS/CPU/peak evidence. Application src/artifact/SHA
unchanged. A next controlled attempt requires re-entering OPDS proxy privately
(the rollback removed it), then running validation; **do not repeat staging**.

## Server acceptance — PASS, 2026-10-05 14:19:11–14:19:20 UTC

Exact application e57f0a6d33799593afc594a8adefabfa46ee6341 passed readiness,
12 local/public unauthenticated401 checks, authenticated local/public root,
source XML and OpenSearch MIME/namespace checks, one completed/search page and
one completed next page. Search returned valid XML851B; the verifier proves
protocol validity, not nonempty mixed-status semantics or a particular query's
results. One listed authenticated HTTPS acquisition returned200,435050 ZIP bytes
and a single validated FB2 member; signature/CRC/expanded cap checked in memory.
No book bytes/name/text persisted. Full-file branch exercised; live cancellation
was not exercised by this same request. Local proxy cancellation tests are CI
evidence, not an additional live claim.

Operator evidence read directly from protected JSONL and committed as
`proxy-prototype-acceptance-passed.jsonl`. Independent agent final-state readback
`proxy-prototype-final-state.json` confirms current=e57f0a6, prototype/deployer/
production inactive, timer disabled, port8787 free, bot active/healthy/NRestarts0.
No rollback needed for the successful attempt. New private config retained.
No Cloudflare/provider settings or bot resources changed.

Snapshot during: process RSS109728KiB (107.16MiB), cgroup MemoryCurrent57212928B,
MemoryPeak58699776B (55.98MiB), CPUUsage1.706716s. RSS and cgroup accounting are
different measurements and must not be equated. Cache DB45056B/WAL20632B/SHM32768B
during,45056B DB with WAL/SHM0 after stop. Retained immutable code logical bytes:
old28855828/new28859174 (57715002 combined). These are one short-session
snapshots, not peak workload proof. RAM available remained above6.24GB; disk
available about35.46GB,2.08M free inodes. No resource failure observed.

Provider main/sub-user **actual** dashboard usage after was requested; HTTP/ZIP
payload counts cannot substitute for billing. FBReader3.8.31 auth/acquisition/open,
query/next and protected empty-page fixture remain owner acceptance. The manual
prototype is stopped at session end, with new current/config prepared for that
separate controlled device session. Production activation remains NO-GO until
reader/provider/deployment gates complete.

## Provider usage after and post-deployment cleanup

Owner supplied main-dashboard Actual Usage5.88MB,0.6% of1.0GB after the test;
prior5.41MB. Display delta0.47MB is a main-account observation and may include
bot traffic, not an independently attributed OPDS bill. Projected15.79MB and
remaining1008.21MB are projections, not actuals. Separate OPDS sub-user billed
usage after was not supplied; don't invent it from payload counts. Snapshot:
`proxy-prototype-provider-after.json`. Available main quota remains sufficient
for the controlled owner reader session; no plan or top-up changes.

Following successful deployment/runtime verification, removed only task-owned
private staging proxy-update-e57f0a6-w7ipksvh after digest/code identity checks.
Both immutable installed releases, root-only rollback backups, sanitized raw
operator evidence and unmerged/dirty checkouts/branches preserved. CI artifact
receipt's stage path is historical and no longer exists. Cleanup receipt:
`proxy-prototype-cleanup.json`. No merged worktree/local branch existed to delete.

Server program complete: verified artifact, independent proxy, protected HTTPS
feeds, one ZIP, stop/resource/bot evidence and successful rollback observation
from the prior failed session are all delivered via this Git branch. Production
activation remains deferred. The owner reader/protected fixture and separately
scoped sub-user usage-after observations are explicitly outstanding.
