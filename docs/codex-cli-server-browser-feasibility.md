# Proposed server-browser feasibility probe

Prepared 2026-10-05. **Design/probe proposal, not executed.** This is a spike:
answer whether an ordinary unmodified server browser gets the actual catalog
without encountering a challenge. No retained application code or deployment.
Owner requires a purely server-side service and declined source-admin contact.
Approval of this probe does not approve installing a browser or changing runtime.

## Context

Checkout: `/home/ysi/opds/opds-proxy-prototype` on the current Hetzner host.
Source: `https://searchfloor.org/`.
Single proposed navigation: `https://searchfloor.org/?page=1&status=is_finished`.
Read AGENTS.md, root spec.md (ARCH-001, SOURCE-002, AUTH-001, OPS-002,
ACCEPT-001, COST-001), prototype-report.md and source-contract.md first.
Latest desktop spec is 0.4.2; do not overwrite server-local helper/report changes
when synchronizing. The prototype is installed and stopped; do not reinstall it.

VPS Node request returned 403 / CF-Mitigated: challenge; one desktop request with
identical headers returned 200. This does not identify the matching rule or prove
that a browser on the VPS will work. Cloudflare documents automated browsers and
Playwright as unsupported for solving production challenges:
https://developers.cloudflare.com/cloudflare-challenges/reference/supported-browsers/

## 1. Read-only inventory and isolation plan

Do this before installing/running anything. Record only version/availability:
installed Chromium/Chrome/Firefox executable, available automation library and
whether a browser can run with its normal sandbox as a non-root operator.
Inspect relevant paths, not the whole disk; do not run npx download/install.
If missing, report the gap and prepare a concrete isolated installation/resource
plan for review. No apt/snap/global npm installation, persistent display service,
new systemd infrastructure, opening ports or --no-sandbox in this probe.

Record bot minimal health/NRestarts and OPDS/prototype/deployer/timer states.
Do not read env/credentials, bot data or change any units/config/tunnel.
Existing code-server MemoryPeak was ~5.9 GiB on a 7.6 GiB host; the earlier
6 GiB available snapshot is not current peak headroom. Browser resource usage
must be bounded before launch: propose a disposable, non-root isolated scope,
MemoryMax <=512 MiB, CPUQuota <=50% of one CPU, wall deadline <=30 seconds and
single browser/tab. Verify how the operator can impose these bounds; if unavailable,
stop and return the concrete missing prerequisite rather than run unbounded.
User-profile/temp files must be fresh, task-owned and removed after exit; do not
access or reuse existing personal/server browser sessions.

## 2. Proposed one-navigation test (after probe/isolation approval)

Use ordinary installed Chromium with JavaScript and its genuine default headers;
no User-Agent override, stealth, fingerprint patches, proxy, IP change, challenge
solver, clearance-cookie import/export or human challenge interaction. Record
browser version, headed/headless mode and exact launch arguments excluding secrets.
Run in the proposed isolated scope; never relax sandbox/security flags to make
Chromium start. If normal browser cannot start, report failure and stop.

One top-level navigation, navigation deadline <=15 seconds, no application retries
or reload. Observe the first main-document status and allowlisted response headers
(server/content-type/cf-ray/cf-mitigated/retry-after). If it reports a challenge,
403/429 or login wall, stop navigation/close the browser immediately; do not wait
for or attempt to complete a challenge. Do not treat a solved challenge as success.
Subresource requests from an ordinary page are expected: count requests/bytes and
record only aggregate totals. This diagnostic is not the current SOURCE-002 fetch
implementation and is not evidence of satisfying its production limits.

If the main document is 200 with no challenge, inspect at most 16 KiB for known
challenge/login markers and use existing known DOM selectors for aggregate card,
completed-card and Download-link counts. Do not print/save HTML, cookies, browser
storage, screenshots, page title/author text, traces/HAR or request-header dumps.
Do not visit search/next/book routes or download a book in this step. Close the
browser/scope and remove only the exact task-owned profile/temp directory.
Record minimal unit/bot baseline again after the probe.

## 3. Return evidence, not a claimed fix

Write `docs/server-browser-feasibility-report.md`: UTC time, tooling/mode,
resource isolation/actual usage, main response status/allowlisted headers,
marker booleans/aggregate selector counts, cleanup, before/after unit/health
and limitations. If browser is unavailable or isolation needs operator action,
return the installation/scope proposal and do not claim a live test.

Outcome interpretation:
- Actual catalog 200: browser-backed source transport becomes a candidate.
  Still validate source search/pagination and a streamed Download with no full
  buffering/stored book, controlled session handling and resource budgets.
  Root spec and a reviewed implementation plan must precede retained code.
- Challenge/denial: this browser approach is not demonstrated; stop, do not add
  evasion. Return evidence and discuss another permitted server architecture.
- Startup/isolation failure: feasibility remains unknown, not an upstream denial.

No Cloudflare operations or subscriptions are needed for this diagnostic.
Production/prototype/deploy timer remain off; bot remains independent.
