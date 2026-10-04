# Implementation and independent review — 2026-10-04

Branch `feat/opds-v1`; base `cc65a78301452510d7c8f355d9fb6fa636d81b3c`.
Implementation: Tasks 0–5 locally; Tasks 7–8 prepared. No server mutation,
push, merge, deployed service or successful FBReader test is claimed.

Fresh Superpowers reviewer examined through commit `5449956`, read specification
and plan, independently passed 45 Vitest tests/typecheck. No Critical findings.
The author reproduced and fixed all three findings in one RED→GREEN pass:

| Finding | Effect / resolution | Verification |
|---|---|---|
| Immediate health after Type=simple restart | Ordinary startup race could reject healthy release; bounded 15s startup grace followed by continuous 60s health/static XML/NRestarts check | observe tests: delayed listening, timeout, late outage, restart |
| Failed releases never pruned | Failed candidates accumulate on shared disk; prune after persisted rollback and on idle unpaused ticks, preserving settled/previous | deploy tests: rollback retention and orphan cleanup |
| 404 uses filtered length, not empty evidence | Could cache a false empty search; explicit empty marker is required | client counterexample: 404 with excluded card/no marker |

The reviewer graded the last finding Minor; executor upgraded it to Important
because the user receives a fresh false empty result instead of stale fallback.
No unaddressed/deferred minor findings remain from this review. No second review
was dispatched; fix verification is the reproduced regressions plus full suite.

## Decisions recorded during implementation

- Treat search 404 as empty only with explicit marker: live source evidence;
  if this marker changes, parsing must be revisited rather than silently accepting 404.
- Correct pagination test fixture to captured page 2; preserve strict next>current:
  incorrect fixture semantics would require rechecking source evidence.
- Use Windows-native ledger bookkeeping instead of Bash skill helpers:
  records require manual consistency checks.
- Implement Basic protection with first runnable HTTP catalog, ahead of Task 5:
  actual FBReader acceptance may require revisiting auth with owner approval.
- Use Python >=3.12 stdlib for bounded archive extraction; audited host has 3.12:
  bootstrap blocks incompatible Python instead of installing deployer packages.
- Conservatively roll back interrupted activation without a settled record:
  a healthy candidate may need one extra restart and explicit rearm after crash.
- Clear disposable cache after stop on every rollback, even same schema:
  safe baseline costs cold-cache latency after rollback.

## Review boundaries and remaining gates

Actual FBReader Basic forwarding/ZIP opening/empty-page next requires device
acceptance on the owner's FBReader for Android 3.8.31 (version supplied 2026-10-04).
Linux installed sudo/systemd permissions, native artifact execution,
GitHub artifact access and host crash recovery require CI/operator evidence.
Production capacity and source variants beyond fixtures require measurements
and bounded live probes. These are accepted limits of local evidence, not waived
requirements; skipping them risks reader failure, failed deployment or poor
capacity assumptions. Production activation stays blocked until applicable
acceptance gates pass. See fbreader-acceptance.md, bootstrap-checklist.md,
runtime-measurements.md and deploy/README.md.
