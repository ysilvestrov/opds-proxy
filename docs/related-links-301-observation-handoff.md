# LINKS-01 intermittent301 — read-only server observation

Read root spec.md first: OPDS-007, SOURCE-005, AUTH-001, OPS-001, ARCH-001.
Production currently reported installed3e8a2bc. Owner confirms Related links
appear;3–4 series were opened, a couple of transitions displayed301 and another
click loaded data. Specific series unknown. No exact chat event timestamp is
available; owner places the failures about two minutes before the first report.

Local fixture replay through API/Catalog/source client returned200 for upstream
301 -> allowed same-origin HTTPS redirect ->200; missing/cross-origin Location
returned502. None returned301 to the reader. This does not identify production
origin. No fix is authorized by this evidence alone.

## Collect existing evidence

1. Read existing searchfloor-opds.service journal for2026-10-07
   11:17:40–12:17:40 UTC. This is a deliberately broad bounded search ending at
   local investigation time, not an asserted exact owner-click interval. If the
   message timestamp is available, narrow around it (including two minutes
   before). Report unavailable/expired history honestly.
2. Parse journal JSON locally; emit only validated event=access fields: UTC time,
   fixed method, route, numeric status, durationMs and outcome. Filter to
   series_feed/author_feed; include entry events only if useful for temporal
   context, with their existing bounded numeric bookId. Limit output to200 events,
   report truncation and journal coverage/rate-limit/drop limitations. Do not
   export raw journal lines, paths, entity keys, query strings or headers.
3. Read local /health for actual installed SHA/ready and existing service restart
   timestamps to establish whether the recorded interval spans a different build.
   Do not print service environment or credentials.
4. If an existing sanitized edge/tunnel HTTP-status log is available, inspect the
   same interval without changing logging configuration. Absence of edge logging
   is a limitation, not permission to enable capture or export sensitive records.

## Interpretation and return

- Origin series_feed301: identify actual installed code/path before proposing a
  fix; current reviewed app has no explicit301 response on this route.
- Origin401 ->200: distinguishes auth challenge/retry at the app, but does not
  explain a phone301 by itself.
- Origin200 while phone301: correlation is approximate; could concern a different
  request or another HTTP boundary. Do not conclude a renderer or Cloudflare bug.
- No matching access event: inconclusive unless journal coverage and the actual
  request interval are known; no raw path/identity is recorded.

Return sanitized events, exact observation window, installed SHA and limitations
through the existing Git evidence workflow. This brief has been prepared locally;
it has not been sent to another chat/operator. No deployment, restart, cache flush,
source probe, book download, packet capture, package installation, bot/secrets or
Cloudflare configuration changes are required.
