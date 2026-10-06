# Permanent OPDS access log — validation

Owner approved replacing temporary activation telemetry with permanent request
logging2026-10-06. Requirements OPS-001/AUTH-001/ARCH-001/ACCEPT-001.

- RED: three new real-Pino tests failed because no access events existed.
- GREEN: focused tests passed; added concurrency/aborted-signal coverage.
- Full Windows Node suite:98 passed,2 platform skips; build/typecheck exit0.
- No live upstream requests, secrets, packet captures or production changes.
- Records describe handler responses only. Aborted signal fixture does not
  establish adapter disconnect or full-body delivery behavior.
- Existing journal persistence, rotation/limits and deployed access events
  remain operator-pending; docs/access-log-rollout-handoff.md gives the steps.
- Phone cover request and META-01 artwork acceptance remain unverified.

Independent read-only review: no actionable findings/blockers. Reviewer inspected
spec/plan/code/tests and independently probed concurrent201/202/503 statuses and
aborted outcome. Its Vitest run hit sandbox EPERM before collection; the passing
full-suite result above is from the coordinator's escalated run.
Integration PR: https://github.com/ysilvestrov/opds-proxy/pull/7.
Exact-head Linux CI is pending. Initial head8f89b7f has zero check runs and no
Actions run observed; workflow374905819 is active, Actions enabled and PR
mergeable=true. The reason for the missing trigger is not established. Do not
merge based on an old green run or substitute local tests for required CI.
