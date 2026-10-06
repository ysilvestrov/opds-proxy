# AUTH-02 — repeated password prompts: investigation

Date: 2026-10-06. Status: owner-selected credentials and FBReader login accepted.
Server/device evidence: `docs/change-opds-credentials-report.md`, eaf3837.
Owner approved bounded design; root spec AUTH-002 and docs/change-opds-credentials.md
describe the implementation. Operator changed the Basic pair; the protocol
remains unchanged. Restart prompts remain accepted, not reported as eliminated.
Root `spec.md` AUTH-001, CONFIG-001, OPS-001/002 and ACCEPT-001 govern
the investigation. This document is evidence, not a second specification.

## Confirmed project evidence

The owner reports repeated password entry in FBReader Android3.8.31.
The owner confirmed prompts occur **only after restarting FBReader**, not during
catalog navigation/acquisition. Successful baseline list/metadata/download is
accepted. The owner accepts this behavior provisionally and wants to choose
an OPDS username/password practical to type on the phone instead of the generated
credentials. This is a credential usability request, not a decision to introduce
additional users or a different authentication protocol.

Four bounded unauthenticated production probes of
`https://opds.ysilvestrov-ai.uk` returned the following on 2026-10-06:

| Path | Status | WWW-Authenticate | Location |
|---|---|---|---|
| /opds | 401 | Basic realm="OPDS", charset="UTF-8" | absent |
| /opds/ | 401 | Basic realm="OPDS", charset="UTF-8" | absent |
| /opds/searchfloor | 401 | Basic realm="OPDS", charset="UTF-8" | absent |
| /opds/searchfloor/opensearch.xml | 401 | Basic realm="OPDS", charset="UTF-8" | absent |

No credentials were used; no Searchfloor requests or book downloads occurred.
These probes check the initial public challenge only. They do not establish
authenticated device request behavior or every potential redirect.

Code inspection: `src/api/auth.ts` emits one fixed realm on all protected
paths. `src/opds/feed.ts` and `search.ts` use the configured PUBLIC_BASE_URL
for navigation/search/acquisition; source HTML alternate links are external.
The app defines no OPDS redirects or expiring authentication sessions.
Existing logs do not record a full request/auth-presence sequence, so they
cannot distinguish omitted credentials from credentials rejected by the origin.
No local adb was found in PATH; Android3.8.31 is not locally reproduced.

## Primary reader reference — limited applicability

Official FBReaderJ public source, commit
`e83aec9f94084aa59d39e33876bdb6fdc275c95e` (2017-06-11):
[ZLNetworkManager.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/zlibrary/core/network/ZLNetworkManager.java),
[AuthenticationActivity.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/android/fbreader/network/AuthenticationActivity.java).

In that old implementation, Basic/Digest credentials are cached in an in-memory
map keyed by host/port/auth scheme/realm. Only the username is written into a
persistent option during this flow. A final unauthorized response can remove
the in-memory credentials for its scope. This makes process-lifetime caching
a plausible explanation for prompts after restarting, but is **not** evidence
of the same code or behavior in proprietary Android3.8.31. Do not claim a
version-specific root cause from this reference alone.

## Next discriminating experiment

The owner clarification narrows the symptom to restart persistence. There is no
evidence requiring a server challenge change. Proposed next step: a private
interactive operator workflow to customize the existing single user's Basic
credentials, preserving runtime/deployer credential agreement, proxy/token
configuration and deployment serialization. Short bounded design approval is
granted on 2026-10-06; the tested operator command was subsequently executed
and the owner accepted device login (see the final report linked above).

After the owner identifies the trigger, record a short device sequence:
initial login → navigate → return to catalog → acquire → reopen → force-stop
and reopen. Record only which step prompts and whether username remains filled.
No password, Authorization header, token, account dump or private URL is needed.
Use an already accepted book if acquisition is relevant; no repeat downloads
unless necessary to reproduce.

If prompts occur within a single session, distinguish scope/realm differences,
request paths and missing versus rejected Authorization at the boundary. Any
new instrumentation needs a written spec/plan review and must record booleans,
route/status and a short bounded correlation window, never credentials or
credential-derived identifiers. If prompts occur only after process restart,
test reader persistence before altering an otherwise stable Basic challenge.

Server protocol changes, cookies, token URLs or fallback auth are not approved
solutions. AUTH-001 requires separate owner decision for fallback auth; passwords
in URLs remain prohibited. The auth protocol is unchanged; only the operator
Basic pair was rotated, as recorded in the accepted server report.
