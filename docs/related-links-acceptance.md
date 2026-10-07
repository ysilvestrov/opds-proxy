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

- Exact-head CI.
- Exact-main native package and normal timer installed SHA/health.
- Production source proxy availability for author/series documents.
- Owner's FBReader Android3.8.31 actual Related link display and transitions.

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
