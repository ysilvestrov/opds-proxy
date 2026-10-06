# META-01 bounded request observation — design review

SUPERSEDED: owner selected permanent rolling access logs instead of this
default-off180s proposal. Root spec.md OPS-001 and
docs/access-log-rollout-handoff.md describe the current approved direction.
The original proposal below is retained as history, not implementation guidance.

Status: PROPOSED, awaiting owner approval. No application change or deployment.
Evidence c8a196b: decoder absent, capture never started, production unchanged.
Root spec.md remains normative; this is a design proposal, not a second spec.

## Recommendation and alternatives

Use narrow Hono request-context middleware and existing Pino. This establishes
arrival/status of actual reader requests without installing a packet decoder.
The previous no-install restriction came from our brief, not the owner.
Installing a decoder remains possible, but requires checking package effects
and the capture pipeline, including temporary files. The TShark manual documents
temporary capture files: https://www.wireshark.org/docs/man-pages/tshark.html.
No packet-capture alternative was tested here.

## Concrete design for approval

- Before Basic middleware, match only GET/HEAD and the exact entry/cover paths
  for27223/27505. This includes401 and its subsequent retry as separate events.
  Authentication, feeds and source/cache behavior remain unchanged.
- Default off. Proposed OPDS_READER_OBSERVE_UNTIL is an absolute UTC expiry.
  Reject invalid settings or deadlines more than180s ahead; past expiry means
  inactive. A restart never renews the absolute deadline.
- Limit200 matched requests per process/window; reserve slots on arrival.
  No unbounded history or queue. Emit only fixed event/resource/ID/method,
  UTC time, origin HTTP status and elapsed milliseconds. No headers, query,
  IP, identity, arbitrary errors, annotation or image bytes.
- Status means response created at origin, not successful image delivery.
  Aborts are explicitly inconclusive. At expiry emit bounded completed,
  pending and suppressed counters. Late completion does not extend the window.
  Overflow, pending or interrupted observation prevents absence conclusions.
  Disabled mode creates no observation timer; shutdown clears the active timer.
- Match response by parsed request context, not TCP timing. Attribute to phone
  only during the coordinated owner-only window, with manual probes paused.

## Implementation and release criteria

Approval precedes code. Align AUTH-001, CONFIG-001, OPS-001/002, ARCH-001,
ACCEPT-001 and OPDS-005 in root spec.md and existing META-01 Task5 plan within
the same change set. No auth weakening, public endpoint or eager cover fetching.

Synthetic tests:200;401 then200; unrelated/malicious requests; error responses;
no fake secrets/bodies in output; disabled/invalid/expired config; event limit;
in-flight expiry and cancellation. Verify middleware order and error status
through Hono; use a local HTTP server for adapter/disconnect behavior where
needed. Build/typecheck, relevant tests and review precede normal artifact deploy.

Prepare the operator activation/cleanup script before installation. Deploy the
reviewed release disabled. Coordinate the phone window, set only the OPDS expiry
privately and restart only OPDS; preserve credentials and unrelated env values.
Expiry disables observation automatically. Restore original config afterwards;
cleanup delay cannot extend observation. Record expected OPDS restarts and bot
state before/after; no bot/Cloudflare changes. Return sanitized evidence via Git.
Do not present this path as production unchanged after activation/deployment.

Entry seen/no cover means only no matching cover reached origin in this window.
Reader caches and pre-origin failures remain possible. Cover200 still leaves
delivery and decoding unknown. No speculative cover fix accompanies this change.
