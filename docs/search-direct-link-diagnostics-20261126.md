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
  only when catalogue info is (re)loaded — adding/editing the catalogue — and
  stores it as `UrlInfo.Type.Search`. Normal browsing does not re-resolve it.
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

Inference (not proven for the closed Android 3.8.31 binary): the reader fetched
the OpenSearch description anonymously, received 401 required by AUTH-001,
ignored the error and stored "no search". The single unretried 401 and the
absence of any `search` request are consistent with this.

## Chosen approach and alternatives

Add a direct `rel="search"` Atom acquisition template
`{PUBLIC_BASE_URL}/opds/searchfloor/search?q={searchTerms}&page=1` before the
existing OpenSearch discovery link wherever discovery is published. The reader
gets the template from the feed it already loads with Basic auth; no extra
request, no auth change, no source I/O. Flibusta's OPDS root publishes both forms.

Rejected: anonymous `opensearch.xml` — would widen the AUTH-001 public exception
for no benefit over the direct link. Rejected: replacing the OpenSearch link —
other readers may rely on it; OPDS-001 keeps it.

After deployment the owner must make FBReader reload catalogue info (edit and
save, or remove and re-add the catalogue); a previously stored null search URL
is not refreshed by browsing. This is derived from FBReaderJ code; phone
evidence is still required.

## Limits

No credentials were used, no authenticated production probe, no Searchfloor
request, no service/unit/state change. Logs inspected contain route/status only.
