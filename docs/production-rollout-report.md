# Production rollout — operator continuation

Status: **operator production cutover passed; automatic timer acceptance pending**.
Requirements: SPEC-001, SOURCE-003, DEPLOY-001/002, OPS-001/002, ACCEPT-001.
Clean main checkout: `d66216c134a5a4c085de6f137359bea27abdc597`.
Results branch: `codex/production-rollout`; no direct main push.

## Actual preparation evidence

Exact main push workflow374905819/run37377050484/attempt1 passed all four jobs.
Artifact11372062331 is `opds-release-d66216c134a5a4c085de6f137359bea27abdc597`,
7358282bytes, API digest296b9a5e23cc93dbe6f0dbe9865378e2508649c320336b17bcdf7216235fd4ef,
expires2026-10-19T21:37:59Z. Metadata verified; acquisition/checksum/native
validation remains exclusively through the production systemd deployer. No
feature artifact seeds production. Receipt: `production-rollout-ci.json`.

Ubuntu24.04.4, Node24.19.0/ABI137/x64/glibc2.39; available RAM5772423168B,
disk34843594752B/inodes2082677. Bot200/ok/NRestarts0; c22ac2e prototype active,
ready on loopback8787. Production/deployer inactive, production disabled;
timer inactive/disabled. Readable root-owned installed scripts/helper/units
match reviewed main, with hashes/modes in `production-rollout-before.json`.
Sudoers/effective policy and private config require operator root verification.

Actual isolated verifier passed deployed → deliberate failure/rolled-back →
held failed SHA → healthy no-op. rollbackHealth=true; no source requests;
own temporary files removed. Receipt: `production-rollout-isolation.json`.
The brief names `prototype/releases/c22ac2e…`, which is absent. Used verified
root-owned immutable `prototype/c22ac2e…`, matching normative prototype layout
and the same exact manifest identity, without moving it or using it for production.
This test does not replace production systemd/flock/60-second observation.

Owner supplied main actual6.29MB/1GB and OPDS sub-user18.55KB/1GB. Shared pool;
projections are not actual remaining quota. Earlier cycle24Sep12:11–24Oct12:11
was not freshly confirmed in chat. Terminal script requests current numbers/cycle
confirmation and checks ample conservative margin from actual usage/limits.
Receipt: `production-rollout-provider.json`. No subscription/provider changes.

## Terminal entry point

```bash
bash /home/ysi/opds/production-rollout/deploy/production-rollout.sh
```

Use your private interactive terminal, without a sudo prefix. The script prompts
for sudo; if the OPDS deploy env lacks a token, it requests a separate fine-grained
GitHub Contents/Actions-read token with hidden input. Never bot credentials or
the CLI token. Actual read access is exercised; operator configures read-only scope.
Prototype Basic/base/proxy are retained privately; production cache is separate.
Existing production env is backed up outside Git, root-only0600.

Checks host/path ownership, exact effective sudo policy, main CI, source quota
and isolation before cutover. Installs only changed reviewed OPDS infrastructure
with existing required owners/modes; no bootstrap --apply/npm build. Headroom
guards1.5GiB RAM/2GiB disk/20000inodes are conservative rollout checks, not changed
application defaults. Uses only fixed systemd/flock deployer, never direct
run-deploy, fake state or manual production pointer edits. Verifies first
deployment/real60-second stable gate, local/HTTPS auth/static feeds, one completed
feed without book download, same-main no-op, real lock contention and memory/
cache/code/disk/bot observations. Enables production/timer only after those pass,
then observes one timer no-op without runtime restart. Allow roughly6–7minutes;
wait progress is printed.

Fresh sanitized evidence: `/home/ysi/opds/production-rollout-checks-*/checks.jsonl`.
Agent collects directly and returns through Git, no secret/archive relay.
Do not rerun after partial rollout: existing settled/pending production is
refused and retained for inspection/recovery.

## Failure and blocker

### Actual operator cutover, 2026-10-05 22:24–22:33 UTC

Receipt: `production-rollout-cutover.jsonl`, copied from the operator's sanitized
JSONL directly. Provider actual figures/cycle confirmed in the terminal. All
installed infrastructure/sudoers/unit bytes matched reviewed main; no installation
changes. Narrow effective sudo policy passed. Independent token CI access and
private production configuration passed; Basic/proxy preserved.

Fixed systemd/flock deployer installed exact main d66216c after safe artifact/native
validation and the actual 60-second observer; elapsed70.23s, deployer peak115810304B.
State idle/settledSHA=d66216c, production PID2903006/NRestarts0. Local/public
Basic401 and authenticated static feeds passed. One bounded completed feed:
200/12410bytes/20books, FB2 acquisition MIME; zero book downloads. Same-main
deployment was noop without runtime restart; actual fixed-unit lock contention
prevented concurrent deployment. Isolated rollback/held/noop regression passed.
Runtime cgroup peak59101184B; RSS105336kB; production code28859178B;
SQLite28672B/WAL32992B/SHM32768B. Bot PID2320493/NRestarts0/health200 unchanged.

The timer gate failed because `systemctl show LastTriggerUSecMonotonic` returns
a formatted duration after a trigger (observed on host timers as `5month … s`),
but the helper used `int()` on it. Zero before activation parsed successfully;
the first formatted trigger raised ValueError. Recovery disabled/stopped timer
and preserved healthy settled production. This was an operator verification bug,
not evidence of application failure. Independent post-failure checks confirmed
main readiness, production active/enabled with unchanged PID/NRestarts,
prototype inactive and timer inactive/disabled; bot health ok.

Fixed trigger detection compares changed nonzero duration strings, alongside a
new journal noop and unchanged runtime identity. Regression failed with the same
ValueError before the fix;38 offline tests now pass, including unchanged-trigger
rejection and pending-state resume refusal. Shell syntax/help/diff checks passed.
Original35 tests missed real systemd duration formatting. Targeted sequential
author review; no independent sub-agent review or successful live timer claim.
Requirements unchanged (DEPLOY-001/002, OPS-002, ACCEPT-001).

Continue only the remaining gate:

```bash
bash /home/ysi/opds/production-rollout/deploy/finish-production-timer.sh
```

Uses prior receipt, verifies settled main/current, unchanged production/bot
identity, installed main infrastructure, private config preservation, fresh CI
and local/HTTPS static acceptance; then enables and observes one timer noop.
No repeated cutover, direct deploy invocation, state writes, secret prompts,
upstream completed probe or book download. Failure leaves timer disabled and
preserves production. Allow up to6minutes; evidence is written under
`/home/ysi/opds/production-timer-checks-*/checks.jsonl`.
Do not rerun the original full rollout over this settled production.

Failed controlled rollout gates leave timer stopped/disabled. Before cutover,
prototype stays runnable. Pending activation/rollback is preserved, never
hand-edited. Failed first activation with idle/no settled baseline stops
production, verifies port free, then restores preserved prototype. A healthy
settled production is preserved with timer disabled if a later gate fails.
Prototype/private env are not changed; both services never intentionally overlap.

Outside-sandbox `sudo -n true` returned **a password is required**. Agent did not
change root config/infrastructure, production state/current, units or timer.
The earlier root-access blocker was resolved by the operator's terminal run above.
Root/env/effective privilege, actual activation/60-second observation and
no-op/lock evidence passed. **Automatic timer tick acceptance remains pending**.

### Timer restart stall, 2026-10-05 22:38–22:44 UTC

Second receipt: `production-timer-unscheduled.jsonl`. Fresh CI, private config,
unchanged production/bot and local/public static acceptance passed again.
Timer emitted infinity for its entire350s window; recovery preserved production
and disabled timer. The duration parser fix worked, but did not fix this separate
scheduling defect. Production PID2903006/NRestarts0 remained active.

Read-only host checks found systemd255.4, persisted OPDS timer stamp mtime
22:33:25.254434UTC, LastTriggerUSecMonotonic0, deploy-service active/inactive
monotonic timestamps0. The original timer used OnBootSec2min plus
OnUnitInactiveSec5min/Persistent=true. Systemd255 reloads the persisted realtime
stamp, skips an elapsed boot trigger when a prior trigger exists, and skips an
inactive-relative trigger whose base is zero. That explains the observed absence
of a future event; the specific operation that lost service timestamps was not
instrumented. Source: [systemd255 timer implementation](https://github.com/systemd/systemd/blob/v255/src/core/timer.c),
[timer directive definitions](https://github.com/systemd/systemd/blob/v255/man/systemd.timer.xml).

DEPLOY-001/spec0.4.9 and Task7 now require initial OnActiveSec2min, preserving
OnUnitInactiveSec5min and15s jitter. It gives every timer activation a fresh base,
including this restart; no boot-relative initial trigger remains. Continuation
reviews/accepts only the exact old timer SHA2565696a7e… or corrected bytes, backs
up only that unit privately/root0600, installs root0644 and daemon-reloads.
All other infrastructure/config/current/state remain unchanged. No stamp
deletion or direct deploy start is used to fake a timer tick.

The same `deploy/finish-production-timer.sh` command now applies this narrow
timer-only correction after all resume gates. Acceptance requires an actual
automatic journal noop, unchanged runtime/bot identity, and a finite subsequent
scheduled event. An elapsed/infinity timer fails promptly rather than silently
waiting350s. Unknown installed timer drift is rejected before writing.

42 offline Python tests passed, including initial activation-relative trigger,
reviewed-only timer replacement/private backup/idempotency, drift refusal,
unscheduled failure and duration handling; systemd unit verification, Bash
syntax/help and diff checks passed. Independent sequential author review only.
The root-free isolated systemd fixture could not run: no user systemd bus exists
on this host. Live timer success is still pending operator execution; offline
checks and source tracing are not a replacement. Agent has not installed this
timer or enabled it. Healthy production and stopped prototype remain in place.

## Script checks

Shell syntax/help passed;35 offline Python tests passed. Coverage: private env
quoting without interpolation, proxy/placeholder guards, exact effective sudo
policy with broad/extra commands rejected, pending/settled recovery decisions,
actual competing flock excluded during a mocked fixed-unit attempt. Sequential
author review per no-subagent instructions; no independent/live root execution
claimed. Application/CI already verified on main; new operator helper tested
offline. Root spec unchanged: approved invariants are retained.
