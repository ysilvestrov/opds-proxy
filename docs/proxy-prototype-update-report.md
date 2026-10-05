# Proxy prototype update — blocked before private configuration

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
