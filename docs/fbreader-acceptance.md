# FBReader acceptance — pending owner test

Automated tests prove XML/HTTP/streaming behavior, not reader compatibility.
Platform/version and actual Basic + ZIP behavior have not been supplied/tested.
Production bootstrap is **NO-GO until this gate passes**; code and deployment
files can be prepared independently.

Use the separately configured HTTPS test endpoint `/opds` and its dedicated
Basic credentials, never credentials embedded in URLs. Listener is loopback;
remote testing requires an operator-approved HTTPS tunnel route or equivalent.
No public plaintext listener.

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
