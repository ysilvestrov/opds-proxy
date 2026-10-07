# Catalogue icon implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the owner's preserved native execution choice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the Searchfloor favicon as this private catalogue's icon in FBReader Android3.8.31.

**Architecture:** Bundle the verified PNG as base64 in a small compiled TypeScript asset module, so existing dist packaging includes it without runtime file paths or a new build step. Serve one public fixed GET/HEAD route before Basic middleware; advertise it in navigation XML. All catalogue/data/download authorization remains unchanged.

**Tech Stack:** Existing Node24, TypeScript, Hono, Vitest, Pino and fast-xml-parser; Node crypto/zlib for offline asset validation. No new dependency or infrastructure.

**Spec:** Root spec.md proposed0.8.1, OPDS-008 approved by owner after385aadb2026-10-07; OPDS-001/005, AUTH-001/003, OPS-001, DEPLOY-001 and ACCEPT-001 apply. Owner approved this plan after7faa3e1; native execution/current checkout preserved.

## Global Constraints

- Exact public route: GET/HEAD `/opds/searchfloor/icon.png`;200, `image/png`, `nosniff`, `public, max-age=86400`; HEAD has no body and no redirect/challenge.
- Bundled PNG at most64KiB, valid PNG structure, square nonzero dimensions. Source observed192×192/16618B at `https://searchfloor.org/static/favicon.png`2026-10-07; preserve retrieval date and SHA-256 in the compiled module.
- No runtime source/proxy/cache calls for the icon; no remote URL selector. Public icon works with missing/invalid Basic. Root/source/search/Download remain private; book-card grants remain scoped to AUTH-003.
- Icon URLs use PUBLIC_BASE_URL, including its optional base path. Root/source-root each have one Atom icon; root Searchfloor entry has image and thumbnail links, both PNG.
- Fixed access-log class `catalog_icon`, no raw path/query/headers/credentials. Book artwork behavior unchanged.
- Native execution in current checkout on a codex branch; preserve the two user untracked report/archive files. No bot, Cloudflare, env, cache schema, unit or deployment mechanism change.
- Tests offline; one bounded favicon retrieval during implementation, no books/crawl. Normal exact-SHA CI/package/timer rollout; actual phone display remains a separate acceptance step.

## Review Focus

1. Bad Basic on a public image must not cause401 (Task 1 API test).
2. A path prefix or spoofed Host must not alter advertised icon URL (Task 2 XML test).
3. Runtime cwd/cache/source failure must not affect the compiled asset (Task 1 built-module child-process test).
4. Unknown-source/similar path or other method must not inherit the public exception (Task 1 API test).
5. Valid PNG signature alone is insufficient: truncated/corrupt chunks must fail the offline asset check (Task 1 asset test).

## File map and interfaces

- Create `src/opds/catalog-icon.ts`: `CATALOG_ICON_PATH: string`, `CATALOG_ICON_PROVENANCE: {sourceUrl:string;retrievedAt:string;sha256:string}`, `catalogIconBytes(): Uint8Array` returning a fresh copy of the embedded PNG.
- Modify `src/api/app.ts`: fixed icon handler registered before private middleware; consumes module above. No auth helper modification.
- Modify `src/api/access-log.ts`: exact path maps to `catalog_icon`.
- Modify `src/opds/feed.ts`: root/source-root icon metadata and root Searchfloor entry image relations; existing exported signatures unchanged.
- Create `tests/catalog-icon.test.ts`: asset integrity, API/auth isolation, compiled runtime portability.
- Modify `tests/feed.test.ts`, `tests/access-log.test.ts`: navigation XML and sanitized log assertions.
- Create `docs/catalog-icon-acceptance.md`: actual validation and pending device evidence; update root spec status/backlog as work proceeds.
- Existing `scripts/package-release.mjs` already copies dist; no packaging change needed for an embedded compiled asset.

## Task 1: Bundled icon and public static route

- [ ] Write `tests/catalog-icon.test.ts` RED assertions for API GET without Basic and with invalid Basic:200, exact three headers above, no Location/WWW-Authenticate, payload matches bundled bytes. HEAD returns matching headers with zero body.
- [ ] Assert catalogue/page/book/details/cover/download mocks were never called; root/source/search/Download without Basic still401. Wrong source and similar/trailing-suffix path do not return the PNG, including with valid Basic; POST to the exact icon route does not return the PNG without auth.
- [ ] Write access-log regression: GET icon with dummy query/header secrets emits one `catalog_icon`200 event without those secrets, query, path or PNG bytes.
- [ ] Run focused Vitest tests and observe failure caused by the absent feature, not a test import/setup error.
- [ ] Retrieve only the source favicon with timeout15s, byte cap64KiB and HTTPS same-origin checks. Decode/inspect it locally; record actual retrieval UTC date and SHA-256. If it is not valid square PNG, stop and report source evidence instead of committing HTML/error bytes.
- [ ] Add `src/opds/catalog-icon.ts` with embedded bytes/provenance; implement exact route before auth and fixed log class. Return a fresh byte array and headers; support HEAD explicitly or verify Hono's GET-to-HEAD behavior with the test.
- [ ] Add offline asset assertions: size<=65536, SHA-256 matches provenance, PNG signature/IHDR/nonzero square dimensions, ordered bounded chunks with valid CRC, IDAT zlib decompression and final IEND/no truncation. Validate corrupted/truncated copies are rejected by the test helper; do not expand runtime artwork parser scope.
- [ ] Build and test imported `dist/opds/catalog-icon.js` in a child process with cwd set to an unrelated temporary directory, no runtime network or cache setup. Assert same digest. The test must use an absolute module URL.
- [ ] Run build, focused tests and typecheck; all pass. Commit only Task 1 files with `feat: serve bundled catalogue icon`.

## Task 2: Navigation metadata and release acceptance

- [ ] Write RED XML tests: renderRoot and renderSourceRoot each contain exactly one `<icon>` equal to `https://opds.example/proxy/opds/searchfloor/icon.png`; root Searchfloor entry includes image/thumbnail relations with the same URL and image/png. The source-name input must not cause icon links on an unknown source entry.
- [ ] Assert acquisition book entries retain their existing artwork behavior and catalogue icon does not replace book covers. API root output with spoofed Host still derives icon URL from config.
- [ ] Run focused XML/API tests and record RED; implement navigation icon metadata using `CATALOG_ICON_PATH` and existing absolute/XML escaping helpers. Keep source-specific entry artwork limited to Searchfloor.
- [ ] Run focused tests GREEN, then build/typecheck/full Node suite and existing WSL Python deployment regressions. Run git diff --check. Record actual pass/skip counts rather than copying earlier feature results.
- [ ] Write acceptance document with requirements mapped to evidence; note cached catalogue icons may require reader refresh/re-add, but do not claim this is necessary without a device result. Commit with `feat: advertise Searchfloor catalogue icon`.
- [ ] Obtain one fresh read-only whole-branch review per preserved native workflow; resolve actionable findings with focused verification before PR/merge.
- [ ] Push feature branch, create and attach PR naming OPDS-008/AUTH-001/OPDS-001/OPS-001. Require exact-head CI, then normal main merge/artifact/timer deployment; no manual infrastructure changes.
- [ ] Confirm actual installed SHA via HTTPS health and public icon200/digest/headers without credentials; record evidence separately from local test success. Ask owner to check actual catalogue icon in FBReader and record the result.

## Commands and expected results

Use bundled Node at `C:/Users/yuriy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` if npm is unavailable. PowerShell invokes it with `&`.

- Build: Node `node_modules/typescript/bin/tsc -p tsconfig.build.json` — exit0.
- Focused: Node `node_modules/vitest/vitest.mjs run tests/catalog-icon.test.ts tests/feed.test.ts tests/access-log.test.ts` — RED before implementation, GREEN after.
- Typecheck: Node `node_modules/typescript/bin/tsc --noEmit` — exit0.
- Full: Node `node_modules/vitest/vitest.mjs run` after build — no failures; report skips.
- Deployment: `wsl -d Ubuntu --exec python3 -m unittest discover -s /mnt/c/Projects/search-floor-opds/tests -p '*_test.py'` — exit0.
- Diff: `git diff --check` — exit0.

## Self-review

OPDS-008 asset/provenance/portability/auth/headers/logging scenarios map to Task 1;
navigation/base URL/artwork regression/device acceptance map to Task 2. Public
exception is exact and precedes auth without changing grants. Embedded dist
asset uses existing package inclusion; no second normative spec or new runtime
storage. All five Review Focus cases have an owning test. Execution method and
checkout preference are preserved; owner approved the written plan after7faa3e1.
Local implementation is complete; review/release/device outcomes are recorded
in docs/catalog-icon-acceptance.md as evidence becomes available.
