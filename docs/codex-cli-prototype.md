# Private HTTPS prototype — brief for server Codex CLI

Goal: obtain actual acceptance evidence for **FBReader for Android 3.8.31** on
the current Hetzner host beside Warsaw Beer Bot. Production activation and its
timer remain disabled. This is the controlled prototype approved by the owner,
not the future joint server migration.

Repository: **https://github.com/ysilvestrov/opds-proxy**.
Branch: **feat/opds-v1**. Source: **https://searchfloor.org/**.
Read `AGENTS.md`, `spec.md` (ACCEPT-001, AUTH-001, OPS-002, DEPLOY-001),
`deploy/README.md`, `docs/server-audit.md`, `docs/fbreader-acceptance.md`.

## 1. Read-only preflight

Record Ubuntu/CPU/glibc, `/usr/bin/node` version/ABI, Python >=3.12, RAM/disk/inodes,
free loopback port 8787 and bot `/health` + NRestarts. Recheck the proposed hostname
`opds.ysilvestrov-ai.uk` and existing tunnel routes. Do not read bot secrets,
print cloudflared token-bearing command lines, change beer-api or use bot paths.
Refuse startup if any production OPDS instance is already running or autodeploy
is enabled; coordinate explicitly instead of stopping an existing service.

Fetch the branch and pin its exact SHA. Verify this repository's **OPDS CI**
workflow `.github/workflows/ci.yml`, completed successful **push** run for that
exact branch/SHA, and jobs `test`, `typecheck`, `build`, `package`. Do not accept
an arbitrary green check, PR merge SHA, expired artifact or unrelated repository.
The prototype artifact name is **`opds-prototype-<sha>`**; production deployer
must never consume it. Record run ID/workflow ID/artifact ID/SHA without tokens.

Run `bash -n` on both scripts, `systemd-analyze verify` on prepared units,
`visudo -cf deploy/sudoers`, and `bash deploy/bootstrap.sh --dry-run`.
If sudo is unavailable in the CLI sandbox, report the exact operator commands;
do not bypass restrictions or claim installation succeeded.

## 2. Prepare independent infrastructure

After preflight and operator review, run the reviewed
`sudo bash deploy/bootstrap.sh --apply`. It installs accounts/units/paths but
starts/enables nothing. No npm ci/build on this server. Existing env files are
preserved; no bot credentials are copied.

Prototype-specific resources:

| Resource | Value |
|---|---|
| Unit | `searchfloor-opds-prototype.service` (manual only) |
| Account | `searchfloor-opds` |
| Immutable code | `/opt/searchfloor-opds/prototype/<sha>` |
| Prototype pointer | `/opt/searchfloor-opds/prototype/current` |
| Disposable cache | `/var/lib/searchfloor-opds/prototype-cache/catalog.sqlite` |
| Root-only config | `/etc/searchfloor-opds/prototype.env`, mode 0600 |
| Listener | `127.0.0.1:8787` |
| HTTPS route candidate | `opds.ysilvestrov-ai.uk` → `http://127.0.0.1:8787` |

Use a separate operator GitHub identity/read credential for artifact retrieval,
never bot tokens. Download the exact run's artifact to an owned staging directory.
Use reviewed `scripts/safe-extract.py` to validate/extract the wrapper and tar:
reject unexpected members, links, traversal, duplicates and expansion limits.
Verify external `release.tgz.sha256` before tar extraction; verify internal
`release.json` SHA, Linux/CPU/Node24/ABI/glibc/schema against host using
`compatibleManifest` from the reviewed `scripts/artifact.mjs`.

Install only the verified extracted directory as immutable prototype `<sha>`;
keep it readable by runtime and not writable by runtime. Atomically create its
own `prototype/current` pointer. Do not change production `current`, release
state, lock or PAUSED. Never import/execute artifact code as root. If separately
checking native SQLite load, use the unprivileged runtime account with a clean
environment; CI native loading plus successful unit/cache startup also provides
actual runtime evidence.

Edit only `prototype.env`: HTTPS PUBLIC_BASE_URL, port 8787, prototype-cache path,
fresh dedicated username/password. Generate/store credentials outside command
lines, URLs and logs; give the owner a secure retrieval method, not a plaintext
report. Leave deploy.env placeholders untouched: autodeploy is not being started.

## 3. Start the controlled test

Before starting, recheck that port is free and production OPDS/deploy timer are
inactive. Start **only** `sudo systemctl start searchfloor-opds-prototype.service`.
Do not enable it at boot. Verify local readiness SHA equals the artifact SHA,
root with no auth is 401, authenticated root/source/OpenSearch are valid XML,
and bot health/NRestarts are unchanged. Use protected config retrieval to supply
auth to checks; never print Authorization values or place passwords in arguments.

Create only the new approved Cloudflare hostname route after confirming it is
unused. Preserve existing routes. Basic over HTTPS is required; a Cloudflare
browser-login wall cannot replace it. If dashboard/API access is missing, report
the exact new hostname/origin action needed from the owner.

After HTTPS checks, return the verified URL ending in **`/opds`** and a secure
credential retrieval method. Have the owner run `docs/fbreader-acceptance.md`.
Do not declare Basic forwarding or ZIP opening passed from curl alone.
For the controlled empty-page-with-next case, prepare a separately protected
fixture catalog; do not add fake data to production cache or weaken completion
checks on acquisition. No broad crawl to hunt for this condition.

## 4. Evidence and stop conditions

Save sanitized preflight, run/artifact/SHA, actual unit state, HTTPS/401/XML and
RSS/cache measurements to `docs/prototype-report.md`; reader results belong in
`docs/fbreader-acceptance.md`. Record actual test date, not the version-supplied
date. Include every remaining manual blocker and bot before/after status.

Stop prototype on Basic/MIME failure, startup issue, unexpected route collision,
or resource/privilege concern. Discuss any auth fallback with owner; never expose
the catalog publicly. When testing is complete, stop the prototype unit and leave
timer/production disabled. Do not promote its artifact/state to production.
Main merge, main artifact, initial release, rollback evidence and timer enablement
are subsequent explicit stages of the reviewed plan.
