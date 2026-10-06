# META-02 genre and work-length acceptance

Spec OPDS-006 approved aftera979a83; implementation plan approved afterbee8baa.
Purpose: judge work length using source character count and author sheets.
Source fixtures contain genres and both badges; live values/reader display are
not inferred from fixtures. No ZIP size/pages or new genre catalogue.

## Release and compatibility gate

Require independent review, green exact-head Linux test/typecheck/build and
green exact-main native package; install via existing timer only. Record the
actual release SHA from public HTTPS /health, not from a local commit.
No manual cache rebuild, new env/unit/dependency, bot or Cloudflare changes.
Offline tests cover old cached records, ordinary expiry, no additional request
counts, separate15min completion freshness, signed cards/images and Basic-only
catalogue/Download. Do not claim these are live traffic/billing measurements.

## Owner phone check

After the release is active, reopen a completed book from the authenticated
listing in FBReader Android3.8.31, checking that:

- Genre tags appear alongside the existing series tag.
- The card's annotation area starts with a line such as
  `Обсяг: 511.2К знаків · 12,78 авторських аркушів`, with available source values.
- Original synopsis paragraphs and working artwork remain available.

Names/numbers vary by book; book27047 is a fixture reference, not required live
content. Fresh legacy metadata may lack fields until normal refresh (up to24h);
old reader-cached entries may need reopening. Do not flush production cache,
mass-open books or spend additional proxy traffic solely to populate metadata.
Source absence yields omission, not zero/fabricated values. Record actual book
and visible result. If genres are absent, obtain minimal card/reader evidence
before changing scheme or adding prose fallback; HTTP/XML alone is insufficient.
If volume appears but genres do not, report the two results separately.

This change does not close unrelated READ-01–04 or resource/billing gates.
No server diagnostic script is needed unless the owner reports a regression.
