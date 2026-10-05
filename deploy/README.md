# Operator installation and release procedure

Prepared files, **not installed**. Follow `../spec.md` (DEPLOY-001/002,
OPS-001/002, ACCEPT-001). Current Hetzner host only; server migration is excluded.
Do not touch bot paths/secrets/units/tunnel route. Actual FBReader acceptance
is a production activation gate; arrange a controlled HTTPS prototype first.
Use `../docs/codex-cli-prototype.md` for that stage. Feature-branch CI creates
`opds-prototype-<sha>`; only main produces `opds-release-<sha>` accepted by the
production deployer. The manual prototype has separate code/cache/config and
unit `searchfloor-opds-prototype.service`; do not enable its boot startup or the
production timer during acceptance.

For the approved pinned candidate, run the terminal helper as your normal operator
account in a private SSH terminal (do not put sudo before the whole script):

**Fresh installation only.** The already-installed server prototype is preserved;
do not rerun `--apply` there. Source-proxy integration and an existing-installation
verifier require the review described in `docs/server-source-resolution.md`.

```sh
bash deploy/start-prototype.sh --check
bash deploy/start-prototype.sh --apply
```

The helper verifies exact GitHub workflow/run/artifact identity and both digests,
safe-extracts fresh staging, checks host compatibility and refuses service/port
collisions. Apply prompts through ordinary sudo, invokes the reviewed bootstrap,
installs only prototype code/current, and generates a dedicated password in
root:root/0600 prototype.env when it still matches the untouched template.
An existing configured env is preserved; existing prototype code/current is a
collision requiring operator inspection. The helper never changes Cloudflare
routes or starts/enables production/timer. HTTP failure stops only the prototype
it attempted to start. Successful checks append sanitized evidence to
`docs/prototype-report.md` and leave the prototype running for device acceptance.
Per-request rows are flushed/fsynced to protected `http-checks.jsonl` before
assertions, retaining earlier checks on failure and excluding query strings.
Retrieve credentials only in your private terminal using
`sudo cat /etc/searchfloor-opds/prototype.env`; never paste them into logs/chat.
After your reader test, run `sudo systemctl stop searchfloor-opds-prototype.service`.
The fixture route and actual FBReader/ZIP acceptance remain separate pending steps.

## Before installation

Inspect `bootstrap.sh --dry-run`, units, helper and sudoers. Confirm Ubuntu
24.04 x64/glibc >= artifact version, Node 24.19.0/ABI, Python >=3.12, free port
8787, user/path collisions and bot health/NRestarts. Re-audit peak capacity.
Bootstrap syntax was checked using Bash 5.2 on Windows; Linux unit/native and
privilege checks remain mandatory. CI runs these checks on Ubuntu 24.04.

Pin the numeric workflow ID returned for this repository's
`.github/workflows/ci.yml`; verify its `test/typecheck/build/package` jobs.
Create separate fine-grained repository token with Actions/Contents read only.
Do not use bot credentials. Artifacts are ready Node production dependencies;
the host never runs npm ci or build. A production archive is produced after main
push and all three required check jobs pass. The approved feature branch also
produces a separately named prototype archive after those checks. PR CI does
not deploy or publish a production archive.

## One-time operator actions

1. From the reviewed checkout run `bash deploy/bootstrap.sh --dry-run`.
2. After approval run `sudo bash deploy/bootstrap.sh --apply`. It creates
   accounts/directories and installs root-owned infrastructure; starts/enables
   nothing. Existing env files are preserved. Re-running updates reviewed
   infrastructure explicitly; app deploys cannot update it.
3. Edit root-only `/etc/searchfloor-opds/runtime.env` and `deploy.env` from
   provided templates. Generate a strong separate password. Credentials copied
   into the deploy env are used only for local static XML health. Pin workflow
   ID; reject placeholder configuration. Keep environment files mode 0600.
4. Inspect `sudo -l -U searchfloor-deploy`, systemd units and file ownership.
   Runtime can write only its cache. Deploy can restart/stop/reset cache using
   the fixed helper; it cannot edit helper/sudoers/installed deployer.
5. Explicitly create a new Cloudflare Tunnel route after confirming hostname
   `opds.ysilvestrov-ai.uk` is free: origin `http://127.0.0.1:8787`. Preserve
   beer-api route. The Cloudflare browser-login gate is not a Basic replacement.
6. When reader prototype gate and Linux checks pass, run the initial deploy:
   `sudo systemctl start searchfloor-opds-deploy.service`. Inspect journal,
   `/health`, authenticated `/opds`, client tests and bot health/NRestarts.
7. Enable runtime start on boot **after** a current release exists:
   `sudo systemctl enable searchfloor-opds.service`.
8. Only after isolated successful/failed release tests and measurements enable
   polling: `sudo systemctl enable --now searchfloor-opds-deploy.timer`.

Do not execute a Windows-built native artifact on Linux. Deployer validates
workflow/run origin, exact SHA, required jobs, wrapper members, external checksum,
archive paths/types/expanded size, CPU/glibc/ABI/schema and native SQLite load.
It checks main again before activation, persists recovery state, atomically
switches current, restarts only OPDS, allows up to 15 seconds to become ready,
then observes local health/static XML plus NRestarts continuously for 60 seconds.
A changed main defers activation. No source request
is involved in readiness.

## Pause, recovery and rollback

Disable timer or create `/var/lib/searchfloor-opds-deploy/state/PAUSED` to pause
new releases; an already-persisted activation/rollback still recovers next tick.
No concurrent manual deploy: use the unit (its ExecStart holds flock), never
invoke `run-deploy.mjs` directly. Crash releases the OS lock.

Runtime-failed and permanently invalid artifact SHAs are held until a new main
SHA or explicit operator rearm. Prefer a fixed new commit. For an explicit
rearm, stop timer, take the **same flock**, inspect state and clear only
`failedSHA`; preserve settled/previous/phase. Never rearm a pending recovery.
Network/API requests use at most three attempts per tick with 1s/2s backoff.

Rollback stops OPDS, removes only fixed cache/WAL/SHM paths and switches back to
previous settled code. Cache is disposable; no backup restore. It verifies
baseline health too; unsuccessful rollback keeps recovery phase for next tick.
Failed first release is stopped and current removed; no false healthy baseline.
Current and previous settled releases are retained, staging is cleaned.
Failed releases are pruned after persisted recovery; idle unpaused ticks also
remove orphaned releases/staging under the lock, preserving settled/previous.

For deliberate operator rollback: pause timer, take the deploy lock, inspect
state/current/previousSHA, use the fixed stop and reset-cache helper, atomically
restore the previous release link, restart/verify it and update deployment state
under the lock. Keep `PAUSED` until ready to resume. Do not hand-edit current
while timer can race you. Bot remains independent.

## Evidence still needed

Actual workflow ID/CI run, artifact download from deploy account, native ABI
check, installed unit/sudo rights, HTTPS/FBReader acceptance, healthy and failed
release in isolated test environment, production route, RSS/CPU/cache/two-release
measurements. Prepared scripts and mock tests are not substitutes.
