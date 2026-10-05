# FBReader acceptance — pending owner test

Latest operator result, 2026-10-05 08:50–08:51 UTC: prototype installed and
started, then stopped after live completed feed 503/upstream 403. Static checks
were reached/passed according to helper execution order, but no complete
per-request report exists. Device tests below remain Pending; do not ask the
owner to test a stopped catalog. See docs/codex-cli-source-diagnostics.md.
Earlier uninstalled endpoint statements below are historical preparation state.

Automated tests prove XML/HTTP/streaming behavior, not reader compatibility.
Target supplied by owner on 2026-10-04: **FBReader for Android, version 3.8.31**.
Actual Basic forwarding, ZIP opening and navigation have not been tested.
Production activation is **NO-GO until this gate passes**. One-time infrastructure
preparation and manual private prototype startup are allowed to obtain this
evidence; neither enables production or its deployment timer.

Use the separately configured HTTPS test endpoint `/opds` and its dedicated
Basic credentials, never credentials embedded in URLs. Listener is loopback;
remote testing requires an operator-approved HTTPS tunnel route or equivalent.
No public plaintext listener.

The HTTPS endpoint has not been deployed; no working catalog URL or credentials
are being claimed here. The operator must first provide a controlled private
prototype endpoint using the reviewed implementation and Linux/native checks.
Record the actual test date separately from the date the owner supplied version.

Server preparation evidence received 2026-10-05: `docs/prototype-report.md`.
Artifact is verified/staged; installation and HTTPS are blocked, so every device
result below remains Pending. Continue via `docs/codex-cli-prototype-continuation.md`.
The staged empty-page XML has no serving route yet; that fixture needs protected
serving before its device test. It must not be treated as an application endpoint.

For this target, test in order:
1. Add the supplied HTTPS URL ending in `/opds` as an external OPDS catalog.
   Enter the dedicated username/password when requested; keep them out of URLs.
2. Open Searchfloor, then completed books. Confirm Cyrillic title/author metadata.
3. Search for `Инициация`; compare against current source results, keeping only
   complete/downloadable books. The captured mixed-status evidence is historical,
   not a promise of the current number of search results.
4. Follow next where available; confirm the query remains the same. Exercise the
   empty-page-with-next case using a controlled fixture, not an unbounded crawl.
5. Download one listed completed book and open it. Record any separate auth prompt,
   unsupported-format message or failure to open the `.fb2.zip` file.
6. Cancel a transfer and retry with a fresh Download.

Report each check as pass/fail and include any displayed error text. The operator
may correlate sanitized endpoint/status logs to check acquisition auth; never
record Authorization values, credentials or book text.

Record OS/version/date and each result, without passwords/book content:

| Check | Result |
|---|---|
| Add catalog `/opds`, Basic prompt, source navigation | Pending |
| Completed books, Unicode metadata | Pending |
| Search mixed statuses: only complete/Download books | Pending |
| Next preserves query | Pending |
| Empty filtered page with next remains navigable | Pending; use controlled test fixture |
| Download sends Basic credentials separately | Pending |
| ZIP MIME `application/zip`, filename `.fb2.zip`, open FB2 | Pending |
| Interrupted download permits fresh GET | Pending |

If MIME needs adjustment, update OPDS-001 and its renderer tests from observed
evidence. If Basic fails, request one owner decision before any auth fallback.
