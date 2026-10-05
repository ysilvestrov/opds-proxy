# Proxy prototype resource and budget evidence

Status: bounded server session measured 2026-10-05; reader/provider-after gates pending. Local fixture tests are not capacity evidence.
Production and deploy timer remain off. Current host beside existing bot;
migration is a separate project. Authoritative requirements OPS-001/002,
SOURCE-003, ACCEPT-001 in root spec.md.

Server agent records UTC time, exact application SHA, before/during/after rows:

| Observation | Before | During one bounded session | After stop |
|---|---|---|---|
| RAM available / disk / inode headroom | Pending | Pending | Pending |
| OPDS RSS / CPU / MemoryPeak | Pending | Pending | Pending |
| OPDS SQLite + WAL + SHM bytes | Pending | Pending | Pending |
| New + prior retained immutable code bytes | Pending | Pending | Pending |
| Bot health / NRestarts | Pending | Pending | Pending |
| Prototype / production / deploy timer states | Pending | Pending | Pending |
| WebShare scope / billing cycle / shared remaining budget | Pending | Pending | Pending |
| Dedicated OPDS sub-user measured bytes | Pending | Pending | Pending |

Provider dashboard is billing authority.1GB ceiling is not reserved bandwidth;
usage screenshot5.41MB/projected14.69MB has unconfirmed scope and does not fill
this table. No hard app monthly cap, management API key, auto top-up or plan change.
Do not persist credentials, book/query text, or raw environment in evidence.

## Proxy prototype update preparation — 2026-10-05

Exact-SHA e57f0a6 artifact verification/staging and operator native-load check passed.
Activation was not attempted: outside-sandbox sudo requires an operator password;
independent protected proxy config and current shared-provider budget are unverified.
Baseline remains stopped, production timer disabled, bot healthy/NRestarts0.
New-artifact runtime, dedicated source/Download and device acceptance remain Pending.
Evidence and continuation stop point: `proxy-prototype-update-report.md`.

## Observed server session14:19UTC

See `proxy-prototype-acceptance-passed.jsonl` for raw allowlisted measurements
and `proxy-prototype-final-state.json` for independent agent readback.

| Measurement | After readiness | After one bounded full ZIP | After stop |
|---|---:|---:|---:|
| Process RSS KiB |83064|109728|No process|
| Cgroup MemoryCurrent B |32722944|57212928|Not set|
| Cgroup MemoryPeak B |33484800|58699776|Not set|
| CPUUsage ns |797411000|1706716000|Not set|
| DB/WAL/SHM B |12288/4152/32768|45056/20632/32768|45056/0/0|
| Available RAM B |6274371584|6245392384|6286921728|

Prior/new code logical bytes28855828/28859174; keep both immutable releases.
Process RSS and cgroup accounting differ; this short test is not peak capacity
proof. Shared-plan billing cycle24Sep–24Oct2026, main1GB/actual5.41MB before,
OPDS sub-user unused before (owner evidence). Dashboard usage after requested.
Payload bytes do not certify billed bandwidth. Prototype stopped; bot healthy,
NRestarts0 before/during/after; production timer disabled.

Provider main Actual Usage after5.88MB (prior5.41MB), display delta0.47MB;
includes any concurrent bot usage. Separate sub-user actual-after not supplied.
Dashboard record: proxy-prototype-provider-after.json. Temporary artifact staging
removed after verified installation; both immutable code releases remain.
