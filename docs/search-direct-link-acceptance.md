# READ-01 / OPDS-001 0.8.3 acceptance — 2026-11-26

Requirements: OPDS-001 (0.8.3), OPDS-002, AUTH-001, DEPLOY-001, ACCEPT-001.

## Release

- PR14 merged as `ec176a29274f47c39e1689f512b47050ef2001d3`; main CI run
  45784963690: test, typecheck, build, package — success.
- Automatic timer deploy installed it at 2026-11-26 08:45:21 UTC (runtime
  restart only, NRestarts=0). Local and public `/health`: ready=true, SHA ec176a2.
- Anonymous `/opds`, `opensearch.xml`, `search?q=x&page=1` on public HTTPS: 401.

## Access log (route/status only; no query, credentials or user agent)

| UTC | Requests | Reading |
| --- | --- | --- |
| 08:45:23–08:46:23 | root 200 every 2 s; root/opensearch/search 401 at 08:45:27 | deployer health/acceptance probes |
| 09:16:32–09:17:37 | root, source_root, completed 401→200 | owner browsing |
| 09:20:52 | root 401→200, opensearch 401→**200** | catalogue info reload after owner edit |
| 09:21:39 | search 401→200 | first Searchfloor search ever recorded |
| 09:21:46–09:22:00 | download 401→200 ×4, 5th 429 | downloads from results; 429 is the one-transfer limit (OPS) |

In this interactive reload the OpenSearch request was retried with Basic auth,
unlike the 2026-11-16 quiet request. The log cannot show whether FBReader used
the direct template or the OpenSearch description; both were available.

## Owner result

Owner reports 2026-11-26: «все запрацювало» — search in the Searchfloor
catalogue works in FBReader after catalogue edit.

## Not observed

- No second `search` request (next page) and no search after an app restart
  appear in the log up to 09:22 UTC; those OPDS-002 next and post-restart
  scenarios remain unconfirmed by log evidence. The search result card's
  `Catalogue: Searchfloor` was not separately reported; the logged search and
  downloads from it are Searchfloor requests.
