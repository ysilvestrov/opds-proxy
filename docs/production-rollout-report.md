# Production rollout — operator continuation

Status: **terminal script prepared; production not activated by agent**.
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

Failed controlled rollout gates leave timer stopped/disabled. Before cutover,
prototype stays runnable. Pending activation/rollback is preserved, never
hand-edited. Failed first activation with idle/no settled baseline stops
production, verifies port free, then restores preserved prototype. A healthy
settled production is preserved with timer disabled if a later gate fails.
Prototype/private env are not changed; both services never intentionally overlap.

Outside-sandbox `sudo -n true` returned **a password is required**. Agent did not
change root config/infrastructure, production state/current, units or timer.
Root/env/effective privilege, actual production activation/60-second observation,
no-op/lock/timer evidence remain **pending operator script output**.

## Script checks

Shell syntax/help passed;35 offline Python tests passed. Coverage: private env
quoting without interpolation, proxy/placeholder guards, exact effective sudo
policy with broad/extra commands rejected, pending/settled recovery decisions,
actual competing flock excluded during a mocked fixed-unit attempt. Sequential
author review per no-subagent instructions; no independent/live root execution
claimed. Application/CI already verified on main; new operator helper tested
offline. Root spec unchanged: approved invariants are retained.
