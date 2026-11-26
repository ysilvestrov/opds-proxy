# READ-01: FBReader never requests Searchfloor search — 2026-11-26

Root spec.md OPDS-001/002, AUTH-001 and ACCEPT-001 are normative. This file
records evidence and design rationale, not a second specification.

## Owner report

Owner reports that search in the Searchfloor catalogue does not work in FBReader
after the 0.8.2 discovery release.

## Observed evidence (host, read-only)

- 2026-11-26 08:18 UTC: local `http://127.0.0.1:8787/health` and public
  `https://opds.ysilvestrov-ai.uk/health` both return `ready=true`,
  SHA `6b8021670a92ff9f1c2b6ecd240ef8bc9cdd98fb`; `/opt/searchfloor-opds/current`
  resolves to that release. The 0.8.2 discovery release is therefore installed
  (runtime restarted 2026-11-17 16:19 and 2026-11-18 09:12 UTC). Deploy service
  last run `Result=success`.
- Sanitized access log (route/status only, no query or credentials), whole
  retained journal: exactly one `opensearch` request ever, 2026-11-16 22:36:24
  UTC (release 23603bb), status 401, **not followed by an authenticated retry**.
  Every other route (`root`, `source_root`, `completed`, `entry`, `download`,
  `author_feed`, `series_feed`) shows the reader's normal 401 → 200 retry pattern.
- Since 2026-11-17 route counts: completed 74, root 39, entry 18, cover 16,
  download 6, source_root 4, series_feed 4, author_feed 2; `opensearch` 0,
  `search` 0. The `/opds/searchfloor/search` route has never been requested.

## FBReaderJ reference behaviour

Upstream FBReaderJ (`geometer/FBReaderJ`, master):

- `OPDSCustomNetworkLink.reloadInfo` resolves a custom catalogue's search URL
  when catalogue info is (re)loaded and stores it as `UrlInfo.Type.Search`.
  Triggers: adding/editing the catalogue (interactive, can prompt for auth) and
  `NetworkLibrary` background refresh every 12 hours with
  `reloadInfo(quietContext, true, true)`. Quiet requests use only credentials
  already cached in the running process; without them the root fetch gets 401
  and `Search` is set to null before the error is rethrown.
- `OPDSCatalogInfoHandler.processFeedMetadata` accepts two forms of root
  `rel="search"`: an `application/opensearchdescription+xml` URL (queued for a
  second fetch) or a direct `application/atom+xml`/`text/html` template, turned
  into `OpenSearchDescription.createDefault(href)`. MIME match is `weakEquals`
  (parameters such as `profile`/`kind` ignored).
- The OpenSearch description requests are performed as a separate batch whose
  errors are deliberately swallowed (`// we do ignore errors in opensearch
  description loading/parsing`). With no description, `Search` is set to null.
- The direct description is added before fetched descriptions; `descriptions.get(0)`
  is used, so a direct link wins when both are present.

Access log around the OpenSearch request (2026-11-16, route/status only):
22:35:47 root 401→200, 22:35:48 source_root 401→200, 22:35:49 completed
401→200, then 22:36:24.785 root 401 and 22:36:24.880 opensearch 401, neither
retried. In FBReaderJ master the OpenSearch fetch only follows a successfully
parsed root, so the closed Android 3.8.31 build evidently differs (it may
remember the description URL). The pair looks like a quiet, credential-less
path.

Inference (not proven for 3.8.31): search resolution ran without credentials,
received the AUTH-001 401, ignored the error and kept "no search". A direct
link fixes this when catalogue info is reloaded with credentials (catalogue
edit/re-add). It cannot help if the reader's search resolution never sends
credentials even for the root; then anonymous OpenSearch (AUTH-001 change)
would be the next candidate, and only with new owner approval.

## Chosen approach and alternatives

Add a direct `rel="search"` Atom acquisition template
`{PUBLIC_BASE_URL}/opds/searchfloor/search?q={searchTerms}&page=1` before the
existing OpenSearch discovery link wherever discovery is published. The reader
gets the template from the feed it already loads with Basic auth; no extra
request, no auth change, no source I/O. Flibusta's OPDS root publishes both forms.

Deferred: anonymous `opensearch.xml` — would widen the AUTH-001 public exception;
reconsider only if 0.8.3 phone acceptance fails and the owner approves. Rejected: replacing the OpenSearch link —
other readers may rely on it; OPDS-001 keeps it.

After deployment the owner must make FBReader reload catalogue info (edit and
save, or remove and re-add the catalogue), then search, and repeat after an app
restart (a quiet background refresh without credentials may clear it again).
This is derived from FBReaderJ code and the logs; phone evidence is required.

## Limits

No credentials were used, no authenticated production probe, no Searchfloor
request, no service/unit/state change. Logs inspected contain route/status only.
