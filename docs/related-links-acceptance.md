# LINKS-01 acceptance — 2026-10-07

Root spec.md is normative. Written spec approved afterad101ee; implementation
plan approved afterd1b4d1e. Native implementation in current checkout.

## Verified locally

- Real sanitized author/series fixtures; compact completion and row isolation.
- Key canonicalization, distinct same-name series author selectors, coauthors.
- Fixed-path source transport, response limits/timeout/redirects/404 handling.
-15min snapshot cache,20-book pagination, stale/coalescing/caller cancellation.
- Rich Book/details records and existing Download freshness remain unchanged.
- Full-card related Atom links, Basic-only related routes, sanitized access logs.
- Real API/Catalog/source integration: card -> author -> local page2 -> series.
-158 Node tests passed;2 platform skips;57 WSL Python tests passed;
  typecheck and production build passed.
- Independent read-only review reproduced4 parser/reference issues. All4
  regressions were observed RED, then GREEN in a single fix pass: explicit
  pagination, changed title layout, nested context, malformed UTF-8 selector.
  The selector finding was treated as Important because it advertises a broken
  navigation target, rather than deferred as cosmetic malformed input.

## Pending separate gates

- Release/CI installed SHA verified:3e8a2bc, public health ready=true;
  docs/related-links-release-evidence.md. These release gates are complete.
- Production source proxy availability for author/series documents.
- Owner confirms Related links appeared and lists opened after retry. Series
  transitions intermittently displayed301; full reader acceptance remains open.

## Owner report and redirect investigation

2026-10-07: owner opened only3–4 series, saw301 a couple of times, then obtained
data on another click. Specific series is not remembered. Approximate event time
was two minutes before the initial chat report; no exact message timestamp is
available here. Author navigation, page2 and Download regression are not inferred.

Local throwaway replay through built API -> Catalog -> SearchfloorClient with the
series fixture: source301 with allowed same-origin HTTPS Location followed by200
produced API200, no Location,2 source requests. Missing Location and cross-origin
Location each produced API502, no Location,1 source request. This demonstrates
local redirect handling; it does not reproduce the phone failure or identify its
production origin. No application or production change was made.

Next evidence: sanitized existing journal events around the owner's series clicks;
see docs/related-links-301-observation-handoff.md. No speculative redirect/auth fix.

Owner follow-up2026-10-07: server Codex found no problem; owner will report any
recurrence with more details. Server receipt has not been independently inspected
here. No root cause or fix is claimed; issue remains under observation and does
not block discussing the next backlog item (catalogue icon).

## Phone checklist after release

1. Open/refetch a known card with references, for example27047. Fresh legacy
   Book cache may lack refs until normal refresh; do not flush the production
   cache or warm up every book. A missing link on legacy data is not proof that
   FBReader ignores the relation; compare returned Atom if needed.
2. Related links should show `Книги автора: …` and `Книги серії: …`.
3. Open each: book list stays in FBReader and offers normal Download.
4. Author page2 opens; known incomplete book is excluded from series.
5. Reopen a card: synopsis, volume after synopsis, cover and Download still work.

Record observed book/author/series and result. Do not infer phone success from
valid XML or server200. If related links fail to display/open, collect reader
and sanitized access-log evidence before changing rel/type/auth mappings.
