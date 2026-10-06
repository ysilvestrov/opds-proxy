# Annotation-before-volume layout follow-up

Owner2026-10-07 confirmed META-02 success with a Searchfloor screenshot showing
genre tags, cover, synopsis and413.2К/10,33 volume. The reference Flibusta image
places size after annotation; owner explicitly requested the same ordering.
Root spec.md OPDS-006 and existing plan amended to reflect that request.

Only product change: renderBookEntry joins synopsis then volume. Stale notice
stays first in content; absent synopsis still yields volume alone. Source,
cache/auth, rounding, genre mapping and signed/acquisition links unchanged.
Existing renderer/API tests observed3 failures before the change, then passed.
Full133 Node tests passed/2 Windows-only skips; build/typecheck passed.
Independent read-only review: no actionable findings.

PR10:https://github.com/ysilvestrov/opds-proxy/pull/10
Reviewed head10bae9c9f6688c980b7aa1ebfc832fd413ec1006: Linux test/typecheck/build
successful in run37542278359. Merged main5efa8efd791d028cec159f60ae6c487de1ea9675.
Release workflow37542378889; artifact11449271919,
opds-release-5efa8efd791d028cec159f60ae6c487de1ea9675,7365605 bytes,
digestsha256:caaeae7a1f29487cc4d86f516c8729c84d42d96098c9c4bbda582907cf4da0e9.
Exact-main test/typecheck/build/package all completed successfully. Initial
health showed previous release3e660df,ready=true; subsequent public HTTPS
health on2026-10-07 confirmed5efa8efd791d028cec159f60ae6c487de1ea9675,ready=true.
Normal timer activated the fix; no manual server operation occurred here.
Updated phone position remains unobserved; owner can reopen the card normally.
