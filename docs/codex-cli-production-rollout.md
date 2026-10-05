# Production rollout — server Claude/Codex brief

Read root `spec.md` first (SPEC-001, SOURCE-003, DEPLOY-001/002, OPS-001/002,
ACCEPT-001). Owner accepted FBReader list, metadata and download on c22ac2e
on 2026-10-05. This brief continues Tasks 7–8 of the reviewed plan.
It is an operator procedure, not evidence that production is installed/running.

## Scope and inputs

Use Git from `https://github.com/ysilvestrov/opds-proxy`; fetch `main` into
a clean OPDS checkout after the baseline PR is merged. Record its full SHA.
The existing prototype, port 8787 and Cloudflare route already work. Preserve
their Basic credentials and independent OPDS WebShare credentials privately.
No new Cloudflare resources, subscription changes, bot configuration, npm build
on the host, or VPS migration. Never print environment files/proxy URLs/tokens.
Return sanitized evidence through a Git branch `codex/production-rollout`,
without archives or secrets. Do not push directly to main or message other chats.

## Gates before changing the running service

1. Record bot health/NRestarts, OPDS unit/timer states, port ownership, free RAM,
   disk/inodes, Node 24.19/ABI 137, Ubuntu/glibc and installed helper/unit ownership.
   Reject unexpected host drift. Stop a running production timer before work.
   Do not rerun `bootstrap.sh --apply` over an existing installation.
2. Check exact-main-SHA push CI from workflow 374905819: all four jobs
   `test/typecheck/build/package` green. Only `opds-release-<full-SHA>` qualifies.
   Feature/prototype artifacts cannot seed production state. Use the production
   deployer's existing safe archive/checksum/manifest/native validation; no unsafe
   `tar` extraction or hand-written approval bypass. Compare root-owned installed
   scripts with reviewed main versions. If different, review and install only the
   changed OPDS infrastructure files with their existing owners/modes, using the
   already approved narrow bootstrap layout. Run syntax/unit validation first.
3. Prepare root-only mode0600 `/etc/searchfloor-opds/runtime.env` and `deploy.env`
   from templates. Privately preserve prototype PUBLIC_BASE_URL, Basic and
   OPDS_SOURCE_PROXY_URL; runtime cache must be the production cache path in its
   unit. Pin workflow ID. Deploy health credentials must match runtime Basic.
   Use a separate Actions/Contents-read GitHub token where required; never bot
   credentials. Reject placeholders, invalid/empty proxy URL and mismatched port.
   SOURCE-003: record current WebShare dashboard scope, billing cycle and remaining
   shared-plan **and** OPDS sub-user allowance before production. The 1 GB sub-user
   ceiling is accepted, but it is not a separate reserved pool. Previous main-account
   screenshots and ZIP byte counts do not prove the sub-user remaining allowance.
   Obtain only sanitized usage numbers from the owner if dashboard access is
   unavailable; no subscription/allowance increase or additional paid features.
   Keep private backups outside Git. Check runtime/deployer ownership and narrow
   sudoers rights without dumping secrets. Keep prototype runnable until cutover.
4. Run the verifier against the preserved, previously validated c22ac2e prototype
   release at `/opt/searchfloor-opds/prototype/releases/c22ac2e6edafeba1563d88363326b2bd19cbb097`.
   Check its identity and immutable file permissions first. It serves only as
   the isolated runtime fixture, never as a production candidate. Main CI also
   runs the same regression on its freshly built runtime. Production artifact
   acquisition/validation happens through the deploy unit in step 5.
   Do not launch `run-deploy.mjs` directly or fabricate settled state. Run:

   ```bash
   node scripts/verify-deploy-isolation.mjs --artifact-dir /opt/searchfloor-opds/prototype/releases/c22ac2e6edafeba1563d88363326b2bd19cbb097
   ```

   This launches a real runtime/native SQLite in a fresh temporary directory and
   on a dynamically chosen loopback port. It verifies successful activation,
   deliberate process failure, rollback, failed-SHA hold and no-op. It injects CI
   approval/locking and uses a short observer window; it does **not** replace
   production artifact trust, systemd/flock/privilege validation or the 60-second
   production observation. It makes no upstream requests and removes its own
   temporary files. Stop on failure. Record its JSON result and artifact SHA.

## Cutover and automatic deployment

5. When gates pass, stop `searchfloor-opds-prototype.service`; confirm port 8787
   free. Start only `searchfloor-opds-deploy.service` through systemd. Its fixed
   ExecStart takes flock and fetches an approved main artifact. Never run a second
   manual deploy concurrently. If root access requires an operator sudo prompt,
   report that exact blocker and wait; do not ask the owner to copy secret files.
6. Inspect sanitized journal, current symlink and deployment state. Confirm
   `phase=idle`, `settledSHA=<main-SHA>`, health identity/readiness, Basic rejection
   without credentials and authenticated static OPDS locally and over the
   existing HTTPS route. Confirm actual 15-second startup/60-second stable gate
   and unchanged bot health/NRestarts. Use genuine curl for public checks;
   do not bypass challenges or rotate proxies. One bounded completed-list probe
   is enough; owner has already confirmed device downloads.
7. Start the deploy unit again: same main must be a no-op without runtime restart.
   Test lock contention through the fixed unit/lock mechanism; record that two
   deployments cannot run concurrently. Measure runtime/deployer memory peak,
   cache, disk and bot status against spec budgets. Do not inject a deliberately
   broken candidate into production; failure exercise belongs to step 4.
8. Only after all preceding evidence passes:

   ```bash
   sudo systemctl enable searchfloor-opds.service
   sudo systemctl enable --now searchfloor-opds-deploy.timer
   ```

   Confirm enabled/active states and the next scheduled tick. Observe one timer
   tick and verify a no-op plus unchanged bot NRestarts. Main pushes after green
   CI now deploy through this timer; GitHub does not SSH into the host.

## Failure and report

On any failed gate leave timer disabled. Follow deployment state recovery before
touching current; never hand-edit a pending activation/rollback or invent a
healthy baseline. For failed first activation, stop production and verify port
free before restoring the preserved c22ac2e prototype and its private env. Never
run prototype and production together. Document exact state and remaining gate.

Commit a sanitized `docs/production-rollout-report.md`: main/CI/artifact identity,
isolated verifier output, installed infrastructure hashes, privilege/unit/lock
checks, actual successful deployment/no-op/timer evidence, local/HTTPS auth,
resource measurements and bot before/after. Update acceptance/plan evidence;
root spec changes only if an invariant actually changes. Claim production active
only after these operator results exist.
