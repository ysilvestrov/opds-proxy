# READ-01 release evidence — 2026-11-17

Root spec.md OPDS-001/002, SOURCE-001, AUTH-001/003 and DEPLOY-001 are normative.
Spec approved afterd45aa38; plan approved after29e626d. PR13:
https://github.com/ysilvestrov/opds-proxy/pull/13 (attached to this chat).

## Verification and review

- Node24.22.1:172 tests passed,2 Windows platform skips; build/typecheck passed.
-57 Python deployment tests passed in isolated temporary WSL tree from tracked
  archive; native Projects mount unavailable. Deployment code itself unchanged.
- Fresh independent review found P2/P3 regression-test gaps, both fixed. URL
  boundary test reproduced RED then GREEN; expected IDs pinned to offline fixture
  order. Full172-test suite GREEN after fixes. No production finding deferred.
- Detent cross-family review blocked before execution by automatic approval
  review because external npm execution could read/transmit private code. No
  bypass, no completed Detent review or marker claimed. Fresh independent review
  plus CI used as the safe alternative; no new policy/configuration introduced.

## Exact-head PR and main artifact

- Reviewed implementation77e8096; final PR head after test/doc fixes:
  d21da01a555d49a563b1ac6f0b41e7847d983444.
- PR CI44051721856: typecheck133930915155,test133930915278,
  build133930915427 success; package133931157551 skipped for PR as expected.
- PR mergeable clean before pinned-head squash merge. Actual main SHA:
  6b8021670a92ff9f1c2b6ecd240ef8bc9cdd98fb; content matches PR head.
- Main CI44051945006/workflow374905819: typecheck133931667379,
  test133931667540,build133931667543,package133931900124 all success.
- Artifact14313269541: opds-release-6b8021670a92ff9f1c2b6ecd240ef8bc9cdd98fb,
  7365500B, digest
  sha256:d8d1ac4e007de395aff4c0c98a7f2bbf9f1cfb710b80d92501448c07943412ff.

## Installation and separate evidence gates

At2026-11-17T09:04:01.116Z public HTTPS /health returned200,ready=true and
previous23603bb. Existing timer checks main releases every5min with up to15s
random delay. Follow-up health200/ready=true observations at09:05:39.667Z,
09:07:11.169Z,09:08:22.429Z and09:09:59.416Z still report23603bb. The new
release is not installed according to these public checks, despite a green
artifact. Actual timer/service state and the reason are unknown without host
access; do not infer a token/lock/timer failure. Read-only operator brief:
docs/search-deploy-observation-handoff.md.

Authenticated production root/OpenSearch XML not probed: credentials are not
available locally. No secrets were requested/exposed. Phone search/next and
Catalogue: Searchfloor require owner observation; exact live book counts are not
a fixed contract. No manual server restart, cache flush, bot/Cloudflare/env/unit
changes. Bot identity/restart counters were not sampled or inferred from health.
