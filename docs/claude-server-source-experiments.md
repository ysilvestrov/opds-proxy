# Server Claude: resolve Searchfloor source access

Owner-approved diagnostic continuation, 2026-10-05. Work autonomously through the
finite matrix and the applicable fix/verification path. Do not stop after each
command to ask the owner to relay files. The service must be entirely server-side;
PC-dependent collectors/import are rejected, source-admin contact was declined.

## Delivery via Git

Repository: https://github.com/ysilvestrov/opds-proxy ; branch feat/opds-v1.
Existing server checkout `/home/ysi/opds/opds-proxy-prototype` contains operator
changes. Preserve it and the already-installed prototype/config. Fetch/read the
updated branch without resetting/cleaning that checkout. If necessary use a fresh
single-branch diagnostic clone under `/home/ysi/opds/diagnostics-20261005`:

```sh
git clone --single-branch --branch feat/opds-v1 https://github.com/ysilvestrov/opds-proxy.git /home/ysi/opds/diagnostics-20261005
```

If destination exists, inspect/reuse safely instead of overwriting. Read root
AGENTS.md/spec.md, this brief, local-source-experiments-20261005.md,
prototype-report.md and source-diagnostics-review.md. Root spec is authoritative.
Use branch `codex/server-source-diagnostics` for new evidence/fixes; push it to the
same repository and report the commit/branch. Do not force-push or replace the
desktop feat branch. If authentication is unavailable, preserve the local commit
and report that exact blocker once; never print tokens or regenerate credentials.
No new standalone chat/project needs creating.

## Boundaries and baselines

Current production/deploy timer are disabled; installed manual prototype is stopped.
Pinned application SHA: 16cc521448bbb792aa74594cf7c1c1def5ae16f9.
Runtime code: `/opt/searchfloor-opds/prototype/current` (read-only).
Never run installer --apply again or alter its current/config/password.
No bot DB/state/locks/unit changes. Proxy connection settings are the only
owner-authorized diagnostic exception for secret use, kept in memory only. Record minimal bot health/NRestarts,
OPDS unit states and resource headroom before/after experiments. No Cloudflare
operations or paid services are part of this program.

SOURCE-002 remains: no stealth, fingerprint/UA spoofing, challenge solving,
clearance-cookie transfer, new/rotating proxies or login/subscription bypass.
The owner explicitly authorized one controlled comparison using the existing bot
proxy to investigate a possible server/datacenter address-range restriction.
This restriction is a hypothesis, not established fact.
Use genuine browser headers only in a real browser. A denial is an observation,
not permission to add evasion. Keep each case sequential, no retries/reloads,
15-second HTTP deadlines, 2 MiB HTML cap, no raw HTML/secrets/books in Git.

## Phase A — real-host HTTP matrix

Use system Node24/Python>=3.12 and installed curl; do not install/build application
packages. The diagnostic app case imports installed Linux dist/dependencies.
Run from the diagnostic checkout:

```sh
python3 scripts/diagnostics/run-source-experiments.py --dist /opt/searchfloor-opds/prototype/current/dist --out docs/source-experiments-server-http.jsonl
```

Five live cases maximum: Node fetch, actual Node app client, urllib, curl HTTP/1.1,
curl HTTP/2 when supported. One synthetic mock403 is offline. The runner flushes
and fsyncs sanitized results after every case, including intermediate failures.
Use a fresh output name if a previous file exists. No repeats without a new
hypothesis or a changed prerequisite.

Decision:
- If Node/app now succeeds, test one current search page and its pagination using
  the actual adapter; investigate whether the original denial was transient.
- If only curl succeeds, record protocol/header/client differences before choosing
  a transport change. Do not claim a working catalog from curl200 without parsing.
- If all real HTTP clients are denied, run Phase A2 using the existing proxy,
  then proceed once to Phase B if it still answers an unresolved hypothesis.
- Network/TLS/runtime errors must be distinguished from source403.

## Phase A2 — existing bot proxy, explicitly approved by owner

First discover from reviewed bot documentation which existing proxy is meant.
Do not invent a provider, purchase a subscription or reconfigure the bot. Use
already-available operator proxy connection settings. If necessary, selectively
load only known proxy keys from the existing protected configuration through an
in-memory loader: never cat/dump the entire env or log values. User approval
covers these connection settings solely for this diagnostic, not other secrets.
Do not persist them in the diagnostic checkout or modify the source file.

Set `OPDS_DIAGNOSTIC_PROXY` only in the private process environment from that
secure loader. It may include authentication. Do not type the URL into a command
line, transcript, git file or stdout. Use an exec-style wrapper that inherits the
private environment, then run:

```sh
python3 scripts/diagnostics/run-source-experiments.py --dist /opt/searchfloor-opds/prototype/current/dist --proxy-env OPDS_DIAGNOSTIC_PROXY --out docs/source-experiments-server-proxy.jsonl
```

The runner clears ambient proxy settings for direct cases and uses only the
selected proxy for comparison cases. HTTP(S) proxy uses Node24 --use-env-proxy,
urllib and curl with the same source headers. SOCKS5/5h uses curl only: do not
misreport unsupported Node SOCKS behavior as source denial. The proxy URL is
never a subprocess command argument or printed. Proxy mode makes <=5 source GETs
with existing bounds and no retries. No browser-through-proxy experiment.

Compare corresponding direct/proxy clients, status, challenge headers and parser
results. Proxy407/connect failure is a proxy/config problem, not Searchfloor403.
Direct403/proxy200 supports a network-dependent access hypothesis, not proof of a
particular banned range or WAF rule. If the actual Node adapter succeeds through
HTTP(S) proxy, prioritize a concrete proxy-transport design over browser installs.
Explain how to give production OPDS its own configuration/credentials without
reading bot secrets on startup, preserve streaming/cancellation and record the
existing proxy's service/traffic limits before any continuing use. Do not silently
turn a successful diagnostic into permanent bot-secret reuse.

## Phase B — ordinary browser on the same VPS

Read codex-cli-server-browser-feasibility.md for approved stop rules. Inventory
installed Chrome/Chromium and normal sandbox support. Use an installed browser
with fresh disposable profile; no persistent display service or public CDP port.
If none exists, prepare and, within the owner's approved diagnostic scope, use an
isolated official browser distribution in the diagnostic scratch directory only.
Do not apt/snap/global install, disable its sandbox, or change system security.
If ordinary startup requires unapproved host changes, record the exact prerequisite.

Impose a transient resource scope before launching: MemoryMax<=512MiB,
CPUQuota<=50% of one CPU, <=40-second whole-process-tree deadline. Verify available
systemd user scope or equivalent; do not run unbounded on this shared bot host.
Example command inside the verified scope:

```sh
python3 scripts/diagnostics/run-source-experiments.py --node /usr/bin/node --dist /opt/searchfloor-opds/prototype/current/dist --browser /verified/path/to/chrome --out docs/source-experiments-server-browser.jsonl
```

Avoid rerunning Phase A solely to reach the browser: for browser-only execution use
`node scripts/diagnostics/source-browser.mjs /verified/path/to/chrome`, capture its
single sanitized JSON row immediately into a fresh evidence file within the scope.
Outer timeout must terminate the entire scope if browser startup/navigation hangs.
Check cleanup and remove only the recorded task-owned profile after all processes
stop. Script intercepts main-document responses; 403/429/challenge aborts the
navigation before attempting a solution. No CAPTCHA/session handling experiments.

## Phase C — concrete resolution and acceptance

Do not confuse diagnosis with deployment. If the existing adapter works unchanged,
prepare an existing-installation manual startup/validation procedure, fix the
helper's lost partial-results evidence with regression coverage, and collect direct
per-request evidence. Preserve credentials in root-only env; never print them.
Check authenticated static feeds, completed/search/pagination and at most one
owner-authorized complete Download; stream with existing 20MiB/60s limits and
inspect ZIP validity without persisting the book. Stop the manual prototype on
failure; never enable production/timer. FBReader acceptance remains an owner step.

If a different genuine transport works, produce a concrete architecture delta in
root spec (SOURCE-002, DOWNLOAD-001/002, OPS-002, ACCEPT-001 as applicable) and a
reviewable implementation plan with stream/cancellation/session/resource tests.
Follow required Superpowers spec/plan review gates before retained application
changes. The successful browser catalog alone does not prove that acquisition can
stream without storing/buffering full books. No stealth-based adapter is acceptable.

If all tested direct server clients are denied, state that no working transport
has been demonstrated under the current constraints. Finish with the finite matrix,
exact remaining external dependency and a concrete decision; do not keep installing
more anti-bot libraries, guess an IP ban or claim that another VPS guarantees access.

## Definition of done for this server session

Commit/push sanitized JSONL, a concise docs/server-source-resolution.md explaining
case results, selected fix or proven blocker, before/after bot/units, resource and
cleanup evidence, tests and remaining reader steps. Include requirement IDs.
Return commit/branch and the concrete next action once. Do not request repeated
manual file exports; desktop can fetch/review the Git branch. Never commit env,
raw source HTML, cookies, profiles, HAR/traces or book content.
