# LINKS-01 release evidence — 2026-10-07

Root spec.md is normative. Owner approved spec afterad101ee and plan afterd1b4d1e.
PR11: https://github.com/ysilvestrov/opds-proxy/pull/11, attached to this chat.

## Validation and review

- Native implementation Tasks1–4 completed in current checkout, no worktree.
- Final158 Node tests passed,2 Windows platform skips;57 WSL Python tests passed.
- Typecheck and production build passed; git diff --check passed.
- Independent fresh-context read-only review on5efa8ef..740fa94 reproduced3
  Important findings plus malformed selector initially Minor. Selector finding
  treated as Important due to an advertised unusable navigation target.
- All4 regressions were observed RED and fixed in one pass: explicit pagination,
  changed title markup, nested section context, malformed percent/UTF-8 selector.
  Full158-test suite passed after fixes. No findings deferred.
- Reconciliation with main made no content changes to the fixed tree.

## Exact-head and exact-main release

- Reviewed/fixed PR head:815cafce1be7823c012ffcf2667f9114d0fbfef7.
- PR CI run37609360173: test/typecheck/build success, package skipped as intended
  for a pull_request event; mergeable=true before exact-head squash merge.
- Main release SHA:3e8a2bced78f2beb58c4bd0023997f0128d9ec40.
- Main CI run37609467696, workflow374905819: test112752917055,
  build112752917311, typecheck112752917419, package112753080439 all success.
- Artifact11477025140: opds-release-3e8a2bced78f2beb58c4bd0023997f0128d9ec40,
  size7368416B, digest
  sha256:6df8262f99d3d78bf57552e1c53b549fbafc275736bb3fd116ba9c9487f4c372.
- Public HTTPS `https://opds.ysilvestrov-ai.uk/health` returned
  `{"ready":true,"sha":"3e8a2bced78f2beb58c4bd0023997f0128d9ec40"}`.
  This confirms installed exact main via the existing automatic deploy path.

No manual server/unit/timer changes, cache flush, bot/env/secrets/Cloudflare
changes or new paid services. Health checks did not use Searchfloor proxy.
Bot identity/restart counters were not separately sampled; none are inferred
from OPDS health. Architecture isolation and operator regressions passed.

## Remaining evidence gates

Phone Related link display/navigation/auth and actual production source proxy
access for entity pages remain unobserved. Existing fresh Book cache may lack
refs until normal source refresh (book metadata TTL24h; list refresh15min may
replace matching books sooner). Do not add hydration solely for missing refs.
See docs/related-links-acceptance.md for the owner's phone checklist.

## Execution notes

The initial fixture helper import typo failed before any HTTP requests; fixed
local import and then captured two bounded public HTML documents. No downloaded
book contents or secrets were retained. Empty generic body data-page is not a
pagination marker; explicit controls/links are rejected. Strict ordinary metadata
parsing was reused via a transient wrapper only after compact-row completion
checks, preserving optional genre/volume semantics without source requests.
