# Private cover authorization compatibility — proposed design

OWNER DESIGN APPROVED AND EXPANDED2026-10-06: purpose is to control gateway/
proxy traffic, not conceal publicly available Searchfloor metadata. Signed
access covers the full card/description and artwork for one book.
Root spec.md v0.6.0 AUTH-003 now contains the written requirements awaiting
owner review; the implementation plan comes after that review. Basic-authorized
first entry issues signed links. Owner subsequently simplified the design:
no time expiry; links work until password changes. Valid grants can populate
cache through the same bounded Catalog flow as Basic. Description stays inline;
no annotation endpoint is added. The24h/cache-only restrictions are superseded.
The original cover-only proposal below is historical, not current guidance.

Status: DESIGN PROPOSAL, awaiting owner decision. Normative AUTH-001 currently
requires Basic on covers and prohibits unreviewed fallback. No code, production
or auth change made. After design approval, revise root spec.md for review,
then review the implementation plan before implementation. Root remains the
single normative spec; this document records alternatives, evidence and intent.

## Evidence

40436fc4f175de5027c42cff9ba6137326543625: installed f76bfac8, reliable owner
window, entries27223/27505 each401 then200; covers8+10 requests, all401, no
successful retry. Current Basic rejects before the cover handler. Logs do not
distinguish absent, malformed or incorrect credentials; header absence and a
specific FBReader implementation defect are not established. Earlier server
authenticated JPEG200 proves resource availability, not phone auth success.
Journal persistence and size-based rolling bounds were also checked; no global
journal settings, production or bot changes in this observation.

## Alternatives

1. Change Basic challenge behavior or use a session cookie. No current evidence
   that FBReader artwork follows another challenge or shares cookies. Retain as
   hypotheses, not a proven fix. Do not put the Basic password in the image URL.
2. Signed, expiring cover-only URLs. Recommended: remove artwork's dependency
   on Basic forwarding while retaining a scoped authorization check at origin.
3. Public covers or a general long-lived URL password. Rejected as inconsistent
   with the user's private service and broader than the needed capability.

## Recommended design to approve

- Basic still protects root/feed/search/OpenSearch/full entry/Download and the
  existing cover request when used with valid Basic. Only exact numeric
  /opds/searchfloor/books/{id}/cover GET/HEAD can additionally use a signed grant.
- An authenticated full entry advertises the same private HTTPS path with an
  expiry/signature query. Issue only for a verified cached cover. Sign a versioned
  unambiguous tuple of source, book ID, cover purpose and absolute expiry using
  HMAC-SHA256; constant-time signature check. Bind grant to that image resource,
  not an arbitrary URL. No new login/session or downloadable-book permission.
- Proposed lifetime24h; reject expired, malformed, duplicate or excessive-future
  expiry values, changed ID/source/purpose or tampered signatures before cache
  access. Grant survives normal app restart until expiry; Basic credential
  rotation invalidates previous grants. Derive a domain-separated signing key
  from the existing private Basic pair using an unambiguous encoding; do not
  expose the pair or add a new secret-management dependency.
- Grant-only requests serve only an eligible already cached cover; no upstream
  card/annotation/image fetch. If evicted or no longer eligible, return404;
  reopening the authenticated entry can fetch a cover and issue a fresh grant.
  Observed incomplete/deleted books invalidate cached resources as before.
- Valid grants authorize artwork even if the image request carries an unusable
  Basic header; invalid/no grant without valid Basic stays401. Invalid grants
  cannot affect authorization of another route. No auth decisions inferred from
  User-Agent, IP, Referer or a previous request on a reused connection.
- Keep verified MIME/signature,2MiB, nosniff and private cache headers. Do not
  emit covers in listings or fetch covers eagerly; preserve SOURCE-002 limits.
- Signed URLs are bearer credentials: someone who obtains a live URL can view
  that one cover until expiry. This scoped permission is the design trade-off,
  not a claim that URLs remain secret everywhere. No token/raw query in app
  logs, receipts, Git or error messages; existing access-log classifier already
  excludes query. Use private/no-store entry and Referrer-Policy:no-referrer.
  Confirm operator sanitizers preserve this rule; do not claim Cloudflare or
  reader caches never retain URLs. No paid Cloudflare feature/config change.

## Required review and acceptance

If approved, align AUTH-001, OPDS-005, CACHE-003, CONFIG-001 where relevant,
OPS-001 and ACCEPT-001 in root spec.md; retain requirement IDs. Record24h expiry,
key derivation/rotation and cache-only eligibility explicitly. Review the written
spec and implementation plan before code because the private access boundary
changes, rather than treating valid-token access as a casual auth bypass.

Local tests: valid grant GET/HEAD; no Basic required for its exact cover; valid
Basic still works; bad/expired/duplicate query, tampering/other book/route/source,
unknown or evicted cover; no upstream calls on grant-only miss; credential
rotation; logging/error/token leakage; unchanged download authentication.
Review before normal artifact release. Device gate: open fresh authenticated
entries in FBReader3.8.31, cover receives200 and owner actually sees artwork;
repeat and restart. Test expiry/rotation offline, not by waiting24h or weakening
production expiry. Do not claim renderer acceptance from an HTTP200 alone.

Security reference: https://www.rfc-editor.org/rfc/rfc6750.html section2.3 warns
that URI bearer credentials can appear in logs; our scoped signed URL is not an
OAuth implementation or a blanket endorsement of placing tokens in URLs.
