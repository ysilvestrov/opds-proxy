# Catalogue icon release evidence — 2026-10-07

Root spec.md OPDS-008 is normative; owner approved spec after385aadb and plan
after7faa3e1. PR12: https://github.com/ysilvestrov/opds-proxy/pull/12, attached.

- Local tests:165 Node passed,2 platform skips;57 WSL Python passed;
  build/typecheck and diff whitespace check passed.
- Independent review3e8a2bc..5de8e7b found no Critical/Important;16 focused tests
  passed. Two Minor stale status statements corrected in b440338; no code change.
- Exact PR head:b4403389e1bc27bba6a1c89d2ba75ef49bf56ccd; CI run37665040827:
  typecheck112941990219/build112941990490/test112941990691 success;
  package112942232035 skipped as expected for PR event.
- Mergeable clean before pinned-head squash merge; main SHA:
  23603bb9e7c431e577dabf940442c0ca125f79c5. Its content matches reviewed head.
- Main CI run37665195355, workflow374905819: typecheck112942516364,
  build112942516696,test112942516846,package112942721158 all success.
- Artifact11502381513: opds-release-23603bb9e7c431e577dabf940442c0ca125f79c5,
  7385457 bytes, digest
  sha256:b545ae48be98c339379a7981b27a97ae9819c6710aa89df65bb7b234108960c1.

At2026-10-07T18:15:38.133Z public HTTPS health still reported previous3e8a2bc,
ready=true. This is not evidence of an icon rollout failure: the existing timer
checks every5min with up to15s randomized delay.

At2026-10-07T18:17:12.524Z public HTTPS health returned200,
ready=true, exact23603bb9e7c431e577dabf940442c0ca125f79c5. Anonymous GET and
HEAD `/opds/searchfloor/icon.png` returned200, image/png,
public,max-age=86400 and nosniff; no Location or Basic challenge. GET16618B
SHA-25623441d82ddbfc49498568b4ee3d8533be2ea634a89941678d3f08f521ce8a633;
HEAD0B. Installation and public static-resource gates are complete.

No manual server/unit/timer/cache/bot/Cloudflare/secret changes. Public health
and future bundled-icon probes do not use Searchfloor proxy. Bot PID/restart
counters are not separately sampled and are not inferred from OPDS health.
Actual FBReader catalogue icon display remains pending owner observation.
