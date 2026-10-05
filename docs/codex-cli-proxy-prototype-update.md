# Existing prototype: independent source proxy update

For the server agent (Claude or Codex CLI). Owner approved spec0.4.5 and this
implementation plan. Complete the bounded server work in one session; deliver
sanitized evidence through Git, without archives shuttled through the owner.
Read AGENTS.md, spec.md, source-proxy plan and this procedure first.
Production activation, timer enablement and joint migration are outside this task.

## Inputs and checks

Repository: https://github.com/ysilvestrov/opds-proxy ; branch `feat/opds-v1`.
Fetch into a fresh operator-owned checkout under `/home/ysi/opds/` if necessary;
preserve `/home/ysi/opds/opds-proxy-prototype` and all its operator changes.
Read the artifact identity table in `docs/source-proxy-ci-evidence.md`.
Use its **application SHA**, not the later documentation commit or branch HEAD.
Require the exact push run: repository above, workflow374905819, branch feat/opds-v1,
event push, completed/success; test/typecheck/build/package all success.
Check expiry and API digest before download. Do not use a PR artifact as production.

Baseline installed application:
`16cc521448bbb792aa74594cf7c1c1def5ae16f9`.
Paths: `/opt/searchfloor-opds/prototype/{SHA,current}`,
`/etc/searchfloor-opds/prototype.env` (root:root0600),
`/var/lib/searchfloor-opds/prototype-cache`.
Do not rerun installer/bootstrap `--apply`. Never read bot env or reuse its proxy.
Existing standalone OPDS credentials from the owner must be entered privately;
if not available on the host, stop before config/activation and identify that input.

Record before/after bot health (`http://127.0.0.1:3000/health`) and NRestarts,
free RAM/disk/inodes and OPDS unit states. Read no bot DB/secrets/state.
Require prototype, production and deployer inactive, timer inactive/disabled,
and no8787 listener. Refuse an unexpected pointer or code identity; do not reset it.
Record current pointer/manifest, unit definition and root ownership locally.
Cloudflare tunnel/route and WebShare plan settings are already configured;
change neither. No management API key or paid upgrades/top-ups.

## Stage and preserve rollback

Use GitHub authentication already available to the operator, only in memory;
do not print tokens or put them in command arguments. Download artifact wrapper
to a fresh private operator staging directory, check its API SHA256,
then run `python3 scripts/safe-extract.py zip WRAPPER FRESH_WRAPPER_DIR`.
Check `release.tgz` against its external checksum, then
`python3 scripts/safe-extract.py tar RELEASE_TGZ FRESH_CODE_DIR`.
Reject unsafe paths/types/links/expanded size with the supplied extractor.
Validate release.json SHA/platform/linux/x64/Node24/ABI137/glibc<=host/schema1
with `compatibleManifest` from scripts/artifact.mjs and actual host report.
Run the in-memory better-sqlite3 query using `/usr/bin/node` against staged
node_modules. Never npm install/build on this host.

Privately back up prototype.env in a fresh root-only0600 file outside Git, and
record old pointer (expected baseline above). Preserve old immutable code.
Privileged copy staged code into a **new**, nonexisting
`/opt/searchfloor-opds/prototype/NEW_SHA`, root-owned directories0755/files0644.
Verify copied manifest/native module again as `searchfloor-opds` user.
Do not replace existing SHA directories or modify production current/state.
Use `sudoedit /etc/searchfloor-opds/prototype.env` for private proxy input.
Retain PUBLIC_BASE_URL/PORT/CACHE_PATH/OPDS_USERNAME/OPDS_PASSWORD unchanged;
add only `OPDS_SOURCE_PROXY_URL` for independent OPDS sub-user. Keep root:root0600.
Use absolute HTTP(S) URL, path empty or `/`, no query/fragment; percent-encode
reserved credential characters. Never put the value in argv, shell history or Git.
No endpoint/userinfo in journal, evidence or reports.

## One dedicated-credentials source GET before activation

Record provider dashboard scope (main/sub-user), cycle boundaries, shared-plan
remaining budget and OPDS usage baseline privately. The1GB sub-user ceiling
draws from the shared plan and does not reserve bandwidth. Stop if the remaining
budget cannot cover one <=20MiB test file plus bounded metadata. No auto top-up.

Execute one source GET with the **new staged artifact's** createSourceTransport,
fixed URL `https://searchfloor.org/?status=is_finished&page=1`, normal adapter
User-Agent/Accept, manual redirects, AbortSignal.timeout(15000), readLimited2MiB.
Use root-only OPDS config loaded in memory; never export proxy on the whole shell.
Do not call client.list here (its5xx retry could turn one GET into two).
Import `loadConfig`, `createSourceTransport`, `readLimited` and `parsePage` from
NEW_SHA/dist; root verifier's `load_private_config` is available for safe retrieval.
Parse on200 only. Emit one JSONL row: check/status/bytes/books/nextPage/valid;
emit sanitized failure before exit and always close dispatcher in finally.
Use an operator-owned recorder pipeline (`set -o pipefail`) for durable0600 output.
No direct fallback, retry, challenge solving or proxy rotation. On403/407/error,
preserve evidence, restore private env backup and stop; do not activate prototype.
Success via the old bot proxy is not evidence for this sub-user.

## Activate and validate the manual prototype

After the dedicated GET succeeds, recheck collisions. Atomically switch only
prototype/current to NEW_SHA with a fresh sibling symlink + `mv -T`; refuse an
unexpected existing temporary entry. Start only
`sudo systemctl start searchfloor-opds-prototype.service`; enable nothing.
Confirm health SHA exactly matches artifact within15s. On failure, stop prototype
and execute rollback below. Retain sanitized journal events, without config dump.

From reviewed checkout:

```sh
set -o pipefail
sudo python3 scripts/verify-existing-prototype.py --expect-sha NEW_SHA --live |
  python3 scripts/diagnostics/record-jsonl.py FRESH_PRIVATE_EVIDENCE.jsonl
```

Replace placeholders with the pinned SHA and fresh operator path; no credentials
in arguments. Verifier checks installed and health SHA, local/public401 Basic,
authenticated root/source/OpenSearch XML and MIME; one completed/search page,
at most one completed next page. It keeps previous rows on live503 and ignores
ambient proxy environment. It changes no files/services and downloads no books.
Any failure stops further live requests and prototype; earlier rows stay intact.

Use a listed completed ID from the feed for **one** authenticated acquisition GET
via `https://opds.ysilvestrov-ai.uk/opds/searchfloor/books/ID/download.fb2.zip`.
Read Basic from private OPDS env inside Python, never `curl -u`/auth argv.
Apply a60s total deadline and20MiB ZIP cap; validate MIME/PK signature and one
FB2 member in memory, with an additional bounded decompression limit. Do not save
book bytes/names/text. Emit status/ZIP bytes/FB2-present/valid and cancellation
result only, flushed before assertions. Do not retry a failed acquisition.
Cancellation integration is covered locally; server confirmation may use the
same GET by cancelling after validated prefix **instead of** full-file validation.
Record which branch was actually exercised; do not claim both from one request.

Measure RSS/CPU/MemoryPeak, cache+WAL+SHM bytes, two retained code-directory sizes,
provider usage before/after and bot health/NRestarts. Owner completes FBReader
Android3.8.31 tests in docs/fbreader-acceptance.md, including protected empty-page
fixture. Stage that fixture only according to existing reader plan; do not add a
public/unauthenticated route. A passing curl check does not prove device acceptance.
Stop prototype when the session ends; production/timer remain inactive/disabled.

## Rollback and evidence delivery

On any startup/auth/source/resource failure: stop prototype; restore the prior
prototype/current atomically to the recorded immutable baseline and privately
restore root-only env backup (including unchanged Basic fields). Verify pointer,
manifest,0600 permissions, port8787 free, production/timer off and bot healthy.
Old baseline had direct403: leave it **stopped**, do not claim service restored.
Do not delete old/new evidence or code, reset bot resources, clear production cache
or touch deployer locks/state. No bootstrap or server npm commands on rollback.

Put sanitized acceptance rows/resource/provider scope evidence and updated reports
on a new `codex/proxy-prototype-acceptance` branch in this repository. Preserve
desktop feat branch; no force-push. Commit no env, credential/userinfo, books or
private backup. Report branch/commit and actual success/failure once. If Git push
is blocked, keep the local commit and report the exact blocker; do not request
another archive transfer. Owner's reader test remains a separate factual gate.
