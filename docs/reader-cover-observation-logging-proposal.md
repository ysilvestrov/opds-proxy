# Proposed bounded origin telemetry — requires separate review

Purpose: observe actual FBReader entry/cover request statuses without passive
capture dependencies. Production is unchanged. Read root spec first; an
approved implementation must align OPDS-005, AUTH-001, CONFIG-001, OPS-001/002,
ARCH-001 and ACCEPT-001 with a reviewed plan and regression tests.

Register a narrow observer before Basic middleware, so direct401 responses and
successful200 responses are both visible. Match only entry/cover routes for
27223/27505. Observe the status associated with the same request context after
the downstream middleware returns; never correlate by time or connection-wide
guesses. Unrelated requests produce no records. Each401 and subsequent retry
is a distinct event, without identities or credential fingerprints.

Output only fixed book ID, resource entry/cover, allowlisted method GET/HEAD,
HTTP status, UTC time and elapsed time. Do not serialize request/response
objects, headers, URLs/query strings, usernames, IPs, User-Agent, exceptions,
annotation text or image bytes. Status timing reflects response headers,
not full-body delivery. Authentication, source concurrency and cache behavior
remain unchanged.

Default off. A separately approved operator activation must set an absolute
expiry no more than180s ahead; expiry cannot silently renew on restart. Bound
events (proposed200) and memory without a global request queue. Suppressed or
in-flight events must be represented by fixed counters/inconclusive reporting,
not inferred absence. This proposed activation setting requires CONFIG-001/
OPS-001 review; do not add it to production now. Enabling instrumentation
requires a reviewed release and separate operator procedure, preserving
existing secret config and timer state.

Tests before release, all synthetic/local:

- Matching entry/cover200 and401 followed by200 are separate, correctly matched
  events; auth behavior is unchanged.
- Reused connections, unrelated requests and split HTTP headers do not misassign
  statuses; correlation follows the server's parsed request context.
- Incomplete/disconnected requests are explicitly inconclusive, not successful
  delivery or evidence of no cover request.
- Fake Basic values, image/body text and malicious URL/header/error strings
  never appear in stdout/stderr or diagnostic records, including error paths.
- Disabled/expired activation emits no request records; event/memory/time bounds
  hold. A restart after absolute expiry does not resume observation.

After review/green release, coordinate one owner window: reopen27223 then27505,
no manual probes/book downloads. If no matching entry is observed, one reader
restart/reopen is allowed; record the owner action. Collect only sanitized
events plus before/after release/service observations. No entry, overflow or
incomplete evidence means inconclusive. Even entry seen/no cover means only
that no matching cover reached origin during this window; phone caching,
link selection and pre-origin failures remain possible.
