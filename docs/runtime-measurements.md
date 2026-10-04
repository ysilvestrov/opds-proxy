# Runtime measurements — not yet measured on Linux host

Design budgets: runtime MemoryHigh 256M / MemoryMax 384M / CPUQuota 50% /
TasksMax 64; deployer MemoryMax 768M / CPUQuota 100%. Snapshot server audit is
not proof of peak capacity. Do not report these limits as observed consumption.

Record date/window/release SHA/Node ABI, workload and these measurements on the
current host, preserving bot health/NRestarts before/after:

| Workload | RSS/MemoryPeak | CPU/latency | DB + WAL + SHM | Current + previous release | Result |
|---|---|---|---|---|---|
| Cold catalog/cache rebuild | Pending | Pending | Pending | Pending | Pending |
| Repeated search/pagination/cache hits | Pending | Pending | Pending | Pending | Pending |
| Largest permitted streamed transfer/disconnect | Pending | Pending | Pending | Pending | Pending |
| Successful release and 60s health window | Pending | Pending | Pending | Pending | Pending |
| Deliberate failed release and rollback | Pending | Pending | Pending | Pending | Pending |

Cache logical cap 128 MiB / 10,000 keys does not equal disk size; include SQLite
free pages and WAL in measurements against 256 MiB physical target. Checkpoint
and pruning are implemented. If target is exceeded, change/retest cache policy
and spec before relying on these capacity assumptions. No cache backups.
