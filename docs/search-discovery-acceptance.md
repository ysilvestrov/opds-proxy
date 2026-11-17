# READ-01 implementation evidence — 2026-11-17

Root spec.md OPDS-001/002, SOURCE-001 and AUTH-001/003 are normative.
Owner approved spec afterd45aa38 and plan after29e626d. Native execution in
the recovered checkout; original incomplete checkout was not overwritten.

- Root advertises search only when Searchfloor is enabled. OpenSearch template
  uses literal page=1; no change to API/source/parser/auth behavior.
- RED: root discovery/template assertion and3 query flows failed before the
  two renderer changes. Unchanged auth/page guards and empty-page next passed.
- Test assumptions corrected: filtered-search fixture still has12 complete books;
  empty filtered case uses completed fixture with status replaced, following the
  existing parser test. Mixed-search has no next; test adds an explicit page2
  button to exercise pagination. These are fixture-only changes, not source evidence.
- Offline root -> OpenSearch -> API -> Catalog -> source client/parser -> next
  tests cover «стоев», «за последним порогом», Cyrillic/space/&/%/NFC, configured
  base prefix, spoofed Host, no discovery source I/O, private Basic/signed-grant
  boundaries, strict page validation, source ordering and filtered empty next.
- Node24.22.1 native SQLite setup passed. Build/typecheck passed. Full suite:
  171 tests passed,2 Windows platform skips. This is fresh local evidence;
  earlier Node26 diagnostic replay is not used as the implementation gate.
- Deployment Python suite:57 tests passed in WSL. Its Projects mount is not
  available, so unchanged tracked deployment files were transferred as git archive
  HEAD into an isolated temporary Linux directory for this run.
- Additional Detent cross-family review was blocked before execution by automatic
  approval review: fetching/executing an external npm package could read/transmit
  private code. No bypass attempted; no Detent marker or completed review claimed.
  Fresh in-session independent review and exact-head CI remain the normal gates.

Independent review, exact-head CI, main artifact/actual installation and device
result remain pending. No private production credentials are available here;
anonymous401 is not evidence of actual authenticated root/OpenSearch XML.
Phone acceptance must inspect Catalogue: Searchfloor and separately observe next;
foreign catalogue results and exact live book counts are not acceptance proof.
No server/bot/Cloudflare/env/cache/schema/unit changes or new query logging.
