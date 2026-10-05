# Proxy prototype resource and budget evidence

Status: server measurement pending. Local fixture tests are not capacity evidence.
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
