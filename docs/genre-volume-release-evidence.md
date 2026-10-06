# META-02 release evidence

Approved root spec.md OPDS-006; written implementation planbee8baa.
PR9: https://github.com/ysilvestrov/opds-proxy/pull/9
Reviewed head31ff0ce6860bc2d751037593c53601a8ebfa60e0, exact-head Linux
test/build/typecheck successful in run37541113322. Main release after merge:
3e660df06895cbe7b3548a82d275cb25f6b29ec2.

Exact-main test/typecheck/build/package succeeded in run37541217095.
Native artifact11448675749:opds-release-3e660df06895cbe7b3548a82d275cb25f6b29ec2,
7360094 bytes, digestsha256:e36e7e9ff54d7184c63df5acb6436697550cd2cf2bdf2a561682555d20e35bbf.
Initial post-merge public health:ready=true, previous signed-card release1a3781a.
Subsequent public HTTPS /health on2026-10-07 returned ready=true and exact
SHA3e660df06895cbe7b3548a82d275cb25f6b29ec2. Normal timer activated the release;
no manual server operation occurred here. This is actual public health evidence,
not private source receipts, service identity/restart counts or phone acceptance.

Local133 Node tests passed/2 Windows-only skips;57 WSL Python tests passed,
build/typecheck passed. Bundled local Node has no npm executable; equivalent
build/full Vitest ran; Linux CI's actual npm test succeeded. Independent
read-only final reviewer found no actionable findings; its independent test
collection was blocked by sandbox EPERM, not reported as passing.

Parser reads genres/exact character count/source author sheets only from the
already fetched book HTML. Existing Catalog/cache/source/auth code unchanged;
no dependencies/env/units/bot/Cloudflare changes, extra source probes or books.
Fixtures and local integration assert no extra source requests, old-cache
compatibility, ordinary expiry and separate completion freshness. These are
offline contract results, not actual provider traffic or billing measurements.

Phone acceptance remains pending: docs/genre-volume-acceptance.md.
Owner checks visible genre tags, compact volume line, original synopsis and
working artwork. Old book cache lacks new fields until ordinary refresh,
potentially24h; no forced cache rebuild or mass hydration is required.
Existing reader-cached entries may need reopening. No new server brief.
