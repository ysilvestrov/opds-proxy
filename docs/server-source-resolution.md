# Server source resolution — verified proxy candidate

Date: **2026-10-05**. Requirements: SOURCE-002, ARCH-001, AUTH-001,
DOWNLOAD-001/002, OPS-002, ACCEPT-001, COST-001.

## Decision

**The installed Node adapter works through the existing owner-approved proxy:**
HTTP 200, 20 parsed completed books, next=2. Use an independent OPDS HTTP(S)
proxy transport as the selected design; do not install a browser or replace the
parser. This is verified source access for one completed page, **not deployed
proxy integration or completed catalog/reader acceptance**.

Concrete next prerequisites are owner review of the root-spec proxy delta and
implementation plan, plus OPDS-only provider credentials/traffic allocation.
The diagnostic exception ends with this program; permanent startup must never
read bot env or reuse bot proxy credentials. No retained application changes,
service start, pointer switch, configuration change or credential generation
was performed.

## Checkout and local changes

Fetched latest feat/opds-v1 at `74f097f34f8126d8b6222caeabf1d100c5e61562`.
The dirty server checkout `/home/ysi/opds/opds-proxy-prototype` was preserved:
no reset/clean/stash/merge over its local files. Created a separate single-branch
clone `/home/ysi/opds/diagnostics-20261005` and delivery branch
`codex/server-source-diagnostics`. Copied the server helper/tests and its README
instructions into this branch, then fixed partial-evidence loss here only.
The original server helper is unchanged and remains an installer, not a resume
tool. **Do not run --apply again on the existing installation.**

Read AGENTS/root spec, server experiment program, local experiment report,
canonical prototype report, desktop diagnostic review, browser feasibility
stop rules and all diagnostic runner sources before executing.

## Finite matrix

Five direct source GETs, five proxy source GETs, one synthetic offline mock.
Sequential cases, no diagnostic retries/reloads, source headers exactly
`opds-proxy/0.1` / `text/html,application/zip`, HTML cap 2 MiB, 15-second HTTP
timeouts. All cases completed within those deadlines; runner flushed/fsynced
each JSONL row. No raw HTML, cookies, credentials or books persisted.

| Client | Direct | Existing proxy |
|---|---|---|
| Node 24 fetch | 403, CF-Mitigated challenge | 200; parser 20 books, next=2 |
| Installed actual Node SearchfloorClient | upstream403 -> SourceError503, 1 call | 200; parser 20 books, next=2, 1 call |
| Python 3.12 urllib | 200, 20 card markers, 151,535 B | 200, 20 card markers, 151,535 B |
| curl 8.5 HTTP/1.1 | 403, challenge | Source status not reliably recorded; 20 card markers in captured stream |
| curl 8.5 HTTP/2 | 403, challenge | Source status not reliably recorded; 20 card markers in captured stream |
| Offline mock403 | SourceError503, exactly 1 synthetic call | Not repeated |

Direct runs: **11:04:21–11:04:29 UTC**. Proxy runs: **11:04:58–11:05:09 UTC**.
See `source-experiments-server-http.jsonl` and
`source-experiments-server-proxy.jsonl` for timestamps and allowlisted headers.
Raw JSONL files are preserved as observed, including the curl metadata defect.

### Interpretation and curl diagnostic fix

Corresponding Node cases differ by routing; proxy200 supports a network/path
dependent access hypothesis. It does **not** prove a particular banned address
range/WAF rule, permanent access, or an entire-VPS-IP ban: direct urllib also
received 200 with the same stated source headers. HTTP implementations/protocol
details still differ; no fingerprint/UA spoofing was used to change those details.
Only the Node cases provide actual installed-parser evidence; urllib's card
markers alone do not certify catalog semantics.

Proxy curl rows incorrectly treated a nested HTTP/1.0 CONNECT 200 preamble as the
source response: server/content-type/CF-Ray were absent and the counted body
included subsequent headers. An offline transcript with two CONNECT preambles
and a final source403 reproduced **wrong status200**. Fixed the diagnostic parser
to skip all CONNECT/interim blocks; the regression now records source403,
challenge header, correct protocol and body bytes. No extra live curl requests
were issued to replace the finite matrix or reinterpret its captured metadata.

## Existing proxy settings and traffic limits

Reviewed bot design/plan identifies its existing Webshare rotating residential
service and known key `WEBSHARE_PROXY`. Only that connection setting was selected
from the available operator file `/home/ysi/warsaw-beer-bot/.env` by a streaming
in-memory loader. No entire env was printed/parsed into configuration; other bot
settings were ignored. Protected runtime `/etc/warsaw-beer-bot/.env` was
inaccessible; equality with the currently running bot's protected setting was
not independently certified. No alternative provider or purchased proxy used.

Exec-style wrapper put the selected value only in private process environment
`OPDS_DIAGNOSTIC_PROXY`. Node used its standard `--use-env-proxy`; urllib/curl
used only the same selected proxy environment. No URL/password was passed in
argv, stdout, evidence or Git. Direct runner cleared ambient proxies. No agent
rotation-on-denial, session/cookie transfer or stealth was introduced. The
existing provider may assign different exits for independent CONNECT sessions;
this is not proof of a specific source policy. No bot config/process changed.

Reproducible loader is `scripts/diagnostics/run-existing-proxy.py`; it refuses
root, selects only the known key and execs the bounded runner. It is **diagnostic
only**, not OPDS startup code. Do not rerun the matrix without a new hypothesis.

Provider public terms checked 2026-10-05:

- Rotating residential is metered per selected bandwidth, with HTTP/SOCKS support.
  [Webshare product terms](https://help.webshare.io/en/articles/15517620-what-are-the-rotating-residential-proxies).
- Bandwidth is shared across the plan, resets monthly and reaching the limit
  stops proxy service. Thus OPDS traffic could affect bot availability if a
  shared budget is exhausted. [Bandwidth limits](https://help.webshare.io/en/articles/8370524-how-does-the-bandwidth-limit-work).
- Public docs offer three included sub-users with independent credentials and
  bandwidth/thread limits. Actual free-slot availability is unknown; no sub-user
  was created. [Sub-user controls](https://help.webshare.io/en/articles/8448255-how-to-create-a-sub-user).
- Connections have session/idle timeouts configurable in provider settings; actual
  account values were not read. [Session limits](https://help.webshare.io/en/articles/8375624-what-are-the-proxy-session-and-proxy-idle-timeout-limits).

These are public product terms, **not** the actual account's plan/price/remaining
quota. No provider dashboard/API/billing credentials were read or requested.
Observed proxy HTML response payloads total approximately 0.76 MiB across five
cases (node-app payload not independently counted; estimate uses comparable
completed-page size). This excludes CONNECT/TLS overhead and provider accounting;
it is not a billing measurement. Continuing use requires a confirmed OPDS quota
and dedicated credentials under the existing plan; no silent paid upgrade.

## Browser phase and cleanup

Phase B was conditional. The actual Node adapter succeeded via approved proxy,
so a browser no longer answers the selected transport question; **not run**.
Inventory found no Chrome/Chromium/Firefox command. A preliminary user scope
probe returned `Failed to connect to bus: No medium found`; system scope probe
returned `Interactive authentication required`. No browser was downloaded,
installed or launched, no sandbox was disabled and no CDP port/profile/display
service was created. These sandbox observations do not establish absence of
possible operator-managed scopes on the host.

No process/profile cleanup needed. No artifacts or unrelated worktrees/branches
were deleted. The diagnostic clone and sanitized evidence remain for Git review.
Proxy children exited normally; their private environment was not persisted.
This is not production deployment, so post-deployment cleanup does not apply.

## Helper evidence repair and tests

Returned helper is now in Git with its safety tests. Every HTTP response/transport
failure emits a sanitized row before assertions; normal-user recorder creates
0600 JSONL and flushes/fsyncs each row. No query, response body, Authorization
or credentials are logged. It still stops only the prototype it attempted to
start on validation failure and never starts/enables production/timer.

Regression tests execute the actual embedded verifier with offline config/network
fixtures: live503 leaves 20 rows (health, 12 Basic, six static XML, failed live GET),
without fixture credentials. Recorder test preserves earlier rows if producer
fails and refuses an existing output file. Safety tests cover production/deployer/
enabled-timer/prototype/port collisions before sudo/network. Curl regression tests
exercise the real diagnostic script against offline CONNECT transcripts.

The successful summary also strips search/page query strings, covered by an
offline success regression. Python suite: **9 tests passed**. Shell,
embedded-Python and diagnostic Node syntax checks passed. No npm install/build/application
test run occurred on this live host; no application source changed. Real prototype
HTTP checks were not rerun because proxy startup/config is a separate reviewed
operator step and the original config/current/password must remain unchanged.

## Baseline, resources and remaining acceptance

Before at 11:03:52 UTC: RAM 8,127,746,048 B total / 6,229,102,592 B available,
root disk 35,581,083,648 B available, 2,091,469 free inodes. This is a snapshot,
not peak-capacity proof. After matrix, the machine-readable baseline records
memory/disk/inodes and unit/health state (`source-experiments-server-baseline.json`).

Before/after: bot active/running, NRestarts=0, loopback health200/ok=true;
prototype inactive/dead/static; production inactive/dead/disabled; deployer
inactive/dead/static; timer inactive/dead/disabled. No services restarted.
The original immutable application SHA stays
`16cc521448bbb792aa74594cf7c1c1def5ae16f9`.

Selected design and tests are detailed in root `spec.md` proposed delta and
`docs/superpowers/plans/2026-10-05-source-proxy.md`. After review: implement
scoped proxy transport without changing source budgets or streaming semantics,
issue a separately reviewed new exact-SHA artifact, use independent root-only
OPDS credentials, then validate existing prototype installation and FBReader.
Search/pagination beyond next metadata, one bounded streamed Download, cancellation,
RSS/cache measurements and protected empty-page fixture remain pending.
No administrator contact or PC-dependent collector is an active next step.
