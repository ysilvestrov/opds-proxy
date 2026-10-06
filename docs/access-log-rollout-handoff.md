# Permanent sanitized OPDS access log — operator handoff

Read root spec.md: OPS-001, AUTH-001, ARCH-001, DEPLOY-001, ACCEPT-001.
Owner approved permanent request logs with rolling journal retention. This
supersedes the default-off180s proposal; no activation env setting is needed.
Prepared code is not installed infrastructure. Reader artwork remains unaccepted.

## Before release: read-only journal check

Record active release, OPDS/bot PID/NRestarts/active state. Inspect effective
OPDS StandardOutput/StandardError and journal configuration, including drop-ins,
persistence, MaxRetentionSec, SystemMaxUse/RuntimeMaxUse and rate limiting;
record effective/default values honestly, not only uncommented config lines.
Check journal disk usage and relevant filesystem free space. Do not print
service environment, raw journal contents or credentials. Return a sanitized
settings/counter report. System journal retention can be shared with bot logs.
Do not edit global journald, vacuum it, restart it, install packages or touch bot.
If existing persistence/rotation/bounds cannot be confirmed, keep that gate
pending and propose a concrete isolated storage choice for review.

## Reviewed application rollout

After reviewed merge and exact-SHA green-main artifact, use the existing timer
release mechanism. No bootstrap/unit/env changes or on-server npm build.
Record actual active SHA/local and HTTPS health and expected OPDS restart;
compare bot state before/after without claiming the earlier bot PID is current.
Use ordinary bounded authenticated HTTP checks, privately loaded OPDS secrets,
to verify access events for a401 and its200 retry. No book download is needed.

Each event has event=access, Pino time/level/msg, fixed method/route, bounded
numeric bookId if applicable, status, durationMs and outcome. It records response
creation at the app, not streamed body completion or phone decoding. Health and
non-OPDS paths intentionally have no access event. No raw path/query/headers.

## One coordinated phone window

Only after the owner is ready, record a180s UTC window. Owner opens27223 then
27505 in FBReader; no simultaneous operator/source probes or book downloads.
If no entry request appears, ask owner to restart reader/reopen one card once
and record the action. Existing phone cache can otherwise invalidate absence
conclusions. Logging remains enabled normally beyond this observation window.

Read journal for searchfloor-opds.service and this window into a local sanitizer;
emit only validated access fields, filtered to entry/cover and those two IDs.
Do not export raw journal JSON or arbitrary messages. Limit returned receipt to
200 events; report truncation, journal rate-limit/drop evidence, unavailable
history or interrupted service as inconclusive rather than absence. No IP or
User-Agent is recorded, so attribution depends on the owner-only window.

Interpret401 challenge/retry separately;404/502/503 identifies origin failure.
Cover200 narrows to downstream delivery/reader handling, without proving either.
Entry seen/no cover establishes only no matching origin request observed during
the complete reliable window. No entry or missing journal coverage is inconclusive.
Return sanitized events, owner actions, retention results and service/release
state through Git. Do not apply a renderer/auth fix before this evidence exists.
