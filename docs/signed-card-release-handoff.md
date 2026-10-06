# AUTH-003 release and operator handoff

Approved spec.md AUTH-003/OPDS-005, AUTH-001/002, SOURCE/CACHE,
OPS-001, DEPLOY-001 and ACCEPT-001 apply. No bot, env, unit, journal or
Cloudflare configuration changes are needed.

PR8: https://github.com/ysilvestrov/opds-proxy/pull/8
Reviewed head:7c04cf4348bd01faeace3986743d061efb8cd40e.
Linux test/typecheck/build succeeded in run37495219196.
Main release:1a3781a2f9db8df3a270f4a923b6db777f224f63.
Local verification:111 Node passed,2 Windows skips;57 WSL Python passed;
typecheck/build/probe syntax passed. Independent read-only review resolved
deadline-composition and malicious-link test reachability findings.

Exact-main test/typecheck/build/package all succeeded in run37495345702.
Native artifact11427457291 (7362806 bytes), named
opds-release-1a3781a2f9db8df3a270f4a923b6db777f224f63, digest
sha256:cdaacbaa8e434b9a266b2cf32d89603df4d13a6f42751f87ac985e5109e38465.
Initial public health after merge:ready=true, previous releasef76bfac8.
Public HTTPS health at2026-10-06T18:29:19+02:00 returned ready=true and exact
release1a3781a2f9db8df3a270f4a923b6db777f224f63 after normal timer polling.
No manual server operation occurred here. Private HTTP, service identity and
device acceptance still require operator/owner evidence.

## Operator task

1. Fetch main preserving local changes. Confirm normal timer installed exact
   release1a3781a2f9db8df3a270f4a923b6db777f224f63. Use existing rollout checks;
   record local and public health, OPDS/bot PID and restart counts. Never force
   install a non-green artifact or build production from an operator checkout.
2. Run the bounded check in docs/signed-card-acceptance.md once, replacing
   APPROVED_SHA with1a3781a2f9db8df3a270f4a923b6db777f224f63. Read only OPDS env
   through Node --env-file. At most27223/27505 and240s; no direct-source probes,
   downloaded books, credential rotation or raw URL/query/header/body exports.
3. Return sanitized stage/status/MIME receipts and actual installed SHA in an
   evidence Git branch. HTTP200 alone does not establish artwork display.
4. Stop probes, coordinate owner-only180s phone observation using existing
   sanitized access journal. Owner reopens both cards from authenticated listing
   to obtain current signed links, checks artwork, repeats and restarts. Never
   clear all reader data. Old cached unsigned image URLs can still401.
5. Record cover200 and owner's actual artwork result separately; preserve all
   unobserved edge gates. Record service identities afterward; bot untouched.

Cache misses via valid signatures are intentional and reuse existing source
traffic/concurrency/queue/cooldown limits. Catalogue and Download remain Basic.
Password changes revoke grants after runtime activation; restoring a password
restores its deterministic grants. No production rotation is required to test it.
