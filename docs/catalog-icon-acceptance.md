# Catalogue icon acceptance — 2026-10-07

Normative requirements: root spec.md OPDS-008, OPDS-001/005, AUTH-001/003,
OPS-001 and DEPLOY-001. Written specification approved after385aadb and plan
approved after7faa3e1; native execution in the current checkout.

## Local evidence

- API/access-log RED:2 tests failed with expected401 instead of200 before the
  public route existed. Navigation RED:2 tests failed before Atom icon existed.
- Favicon retrieved2026-10-07T18:08:53.191Z from
  https://searchfloor.org/static/favicon.png,16618B,PNG192×192.
  SHA-256:23441d82ddbfc49498568b4ee3d8533be2ea634a89941678d3f08f521ce8a633.
- Embedded compiled module includes provenance and returns fresh copies; offline
  tests validate chunk CRC/bounds, square IHDR, inflated image rows and final IEND.
  Corrupted/truncated payloads fail validation. No runtime network/file/cache lookup.
- GET/HEAD succeeds without credentials and with bad Basic; correct headers,
  no redirect/challenge, empty HEAD. Private acquisition routes remain401 without
  Basic. Unknown-source/similar paths and POST do not expose the PNG.
- Fixed catalog_icon log class contains no query/headers/image data. Navigation
  icon and source-entry artwork use configured base URL including path prefix;
  spoofed Host cannot select their URL. Existing book artwork tests pass.
- Built module imported from unrelated temporary cwd returns the same digest.
  Existing package script includes the module through its dist copy.
- Full suite:165 Node tests passed,2 platform skips;57 WSL Python tests passed;
  typecheck/build pass. No new dependencies, bot/Cloudflare/env/unit changes.

## Remaining gates

Independent fresh review3e8a2bc..5de8e7b found no Critical/Important findings and
independently ran16 focused tests successfully. Two Minor stale documentation
status statements were corrected. Exact-head CI and exact-main artifact passed;
Installed SHA23603bb and anonymous public PNG GET/HEAD200, exact digest/headers
are confirmed2026-10-07T18:17:12.524Z (docs/catalog-icon-release-evidence.md).
FBReader Android3.8.31 actual catalogue icon display
requires the owner's check; a cached catalogue may need refreshing/re-adding,
but no such requirement has been observed yet. Local green tests are not proof
of production installation or phone display.
