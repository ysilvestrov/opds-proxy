# Signed card access — operator and device acceptance

Root spec.md AUTH-003/AUTH-001/002, OPDS-005, SOURCE/CACHE invariants,
OPS-001, ARCH-001, DEPLOY-001 and ACCEPT-001 govern this change.
Owner approved no-expiry grants revoked by password change, with ordinary
bounded fetching on cache misses. Prior reliable40436fc observation showed
18 cover401 and entry401→200 on f76bfac8; artwork acceptance remains FAILED
until the new release and real reader observations establish otherwise.

## Release gate

Require independent review, exact-head Linux test/typecheck/build, then exact-main
native package success. Existing timer installs only that green-main artifact.
Record actual installed SHA/local+HTTPS health and current OPDS/bot PID/restarts,
before/after the acceptance check. No units/env/secrets/schema/bot/Cloudflare
or global journal changes. Do not rotate production password for this probe;
rotation/rollback/restart/cache-miss cases have local regression tests.

## One bounded server check from Git

After expected release is installed, extract the reviewed probe from its exact
Git revision (replace APPROVED_SHA with that full, confirmed revision). Scripts
are not part of the app artifact; use the existing operator checkout, preserve
dirty files and do not build production from it.

```bash
git fetch origin main
umask 077
probe_dir=$(mktemp -d /tmp/searchfloor-signed-card.XXXXXXXX)
git show APPROVED_SHA:scripts/diagnostics/signed-card.mjs > "$probe_dir/probe.mjs"
sudo /usr/bin/node --env-file=/etc/searchfloor-opds/runtime.env "$probe_dir/probe.mjs"
```

Run once, not concurrently with phone observation. Inspect sanitized stdout
before returning JSONL through Git. Remove the extracted script/private directory
afterward; no book/images/XML/tokens/secrets may be persisted. Root env belongs
only to OPDS; no secrets in argv/chat/Git and no bot env. No source-direct probe.
At most two fixed IDs27223/27505: Basic HTTPS entry, emitted signed self without
Authorization, emitted signed image without Authorization. Each response <=2MiB,
65s deadline within global240s; redirects manual, links restricted to the exact
configured HTTPS origin/source/book/path and one canonical signature. Probe only
reports fixed stage/ID/status/MIME/bytes/timing/presence flags and fixed errors.
No raw URL/query/error/body. Ordinary app calls may populate disposable cache.

Inspect each actual status; process exit0 alone is not feature acceptance.
Expected entry_basic/entry_signed/cover_signed200, summary if provided upstream,
verified existing image MIME from app. No cover link means report unavailable,
not invent a resource or start more source experiments. Retain the known valid
signed links only in process memory; do not paste them into a report or command.

## Coordinated phone window

After probes stop, owner reopens27223/27505 from the authenticated listing to
obtain current signed image links. Previous phone-cached unsigned URLs may still
get401; if needed restart FBReader and reopen the card once, recording that action.
No all-data reset, public cover route or Download needed during this check.
Observe the same existing sanitized journal access schema, at most200 events
in a180s owner-only window, using the already prepared server observation helper
or equally bounded sanitizer. No raw journal export or query/token logging.

Owner confirms annotation and visible artwork, repeats and restarts. Record
cover200 AND owner-visible cover separately; neither replaces the other. Operator
checks capture limits/suppression/errors/process interruption before claiming
an absence. Entry seen/no cover only means no origin cover request observed.
Do not attribute a request to the phone without the coordinated owner-only window.

Return report/receipts through a separate Git evidence branch with active SHA,
actual statuses, owner actions and before/after service identity. Keep unobserved
optional-absence/Download/other META-01 edge gates open. If a new failure occurs,
identify its boundary before another renderer/auth change.
