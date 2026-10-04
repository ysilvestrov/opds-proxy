# Current-host bootstrap brief for Codex CLI/operator

Work in `https://github.com/ysilvestrov/opds-proxy`, reviewed implementation
branch; read root `spec.md`, AGENTS.md, `deploy/README.md` and server-audit.md.
Production source: **https://searchfloor.org/**. No second source in v1.

This is an installation brief after operator approval, not authorization to
change the server from the desktop coding session. Server migration belongs
to another project. Never inspect/copy bot secrets or reuse its DB/locks/state.

First perform read-only checks and report blockers:
- Verify port 8787 and proposed hostname/tunnel route are free; preserve beer-api.
- Record Ubuntu/CPU/glibc, `/usr/bin/node` version/ABI, Python >=3.12, disk/inodes,
  current bot `/health` and NRestarts, baseline RAM/CPU including code-server.
- Review Bash syntax and `systemd-analyze verify` on prepared units. Inspect
  users/path collisions, ownership, exact helper actions and sudoers with visudo.
- Inspect pinned GitHub CI workflow ID, required jobs, main exact SHA and matching
  artifact; confirm separate read-token can retrieve it. Never print tokens.
- Verify no actual FBReader failure is unresolved. Controlled HTTPS prototype
  requires platform/version and private credentials outside URLs/logs.

Before writing, present exact `bootstrap.sh --dry-run` and operator steps from
deploy/README.md. After explicit installation authorization, apply only these
files/accounts/paths. Bootstrap enables/starts nothing. Configure independent
env files, new route, initial release and private client acceptance as specified.

Keep polling disabled until successful/failed isolated deploy/rollback evidence
and capacity measurements are recorded. Verify bot health/NRestarts unchanged
before/after every change. Report prepared/installed/tested separately; save
results without credentials or book content in the evidence docs.
