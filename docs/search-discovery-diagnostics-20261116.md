# READ-01: Searchfloor search discovery — 2026-11-16

Root spec.md OPDS-001/002, SOURCE-001, AUTH-001 and ACCEPT-001 are normative.
This document records evidence and design rationale, not a second specification.

## Owner report and intent

Owner wants Searchfloor search to work in FBReader as catalogue search works for
Flibusta. Reported «стоев» returned Dostoevsky-related titles and «за последним
порогом» returned one book against14 on the site. Owner then checked Catalogue:
the displayed results came from Flibusta or another catalogue. This establishes
the origin of the inspected result, not that Searchfloor was never requested.
Phone Searchfloor search has not yet been accepted.

## Observed evidence

- Remote main and public HTTPS health both identify23603bb9e7c431e577dabf940442c0ca125f79c5;
  ready=true. Anonymous root/OpenSearch401 as required. No private production
  search call or server log correlation was performed in this local session.
- Generated global `/opds` has no search link. Generated source root includes
  `/opds/searchfloor/opensearch.xml` and application/opensearchdescription+xml.
- OpenSearch currently has `q={searchTerms}&page={startPage?}`. A permitted
  empty substitution gives page=, rejected by the unchanged API integer guard.
  The official historical FBReaderJ OpenSearchDescription.makeQuery implements
  that empty substitution for optional parameters. This is compatibility
  evidence, not a claim that the installed Android3.8.31 binary is identical.
- Two bounded direct Searchfloor GETs used the reported queries,page1,15s/2MiB,
  separated by at least1s. No books, credentials or proxy settings were used.
- «стоев»:20 cards; current parser accepts17 completed books by Андрей Стоев,
  rejects22852/22853/27932, preserves next=2. More upstream pages were not fetched.
- «за последним порогом»:14 cards; current parser accepts13 completed books,
  rejects ongoing artbook22852; no next. Site/OPDS counts legitimately differ.
- Replay through existing API -> source client -> parser using captured HTML
  returned200 with17/13 acquisition entries and correct original query in the
  generated source request. SQLite and production proxy/cache were not exercised.
- The throwaway replay used Node26.12.1 with TS transform hooks. It is diagnostic
  evidence only: no Node24 production test-suite/build success is claimed.

## Chosen approach and alternatives

Owner approved advertising Searchfloor search at global root and setting page=1
in the OpenSearch template. This fixes discovery and optional-page compatibility
without changing source search semantics, completion filters or API validation.
Changing parser filtering would expose unfinished books and contradict SOURCE-001;
the captured pages do not justify it. Only teaching the owner to select another
catalogue would leave discovery and the template compatibility issue unresolved.

## Workspace and limits

Initial C:/Projects/search-floor-opds lacks src/tests/docs and working Git refs;
it was not repaired or overwritten. A fresh copy of remote main was cloned into
.superpowers/source-inspection-20261116 within that workspace. It is the working
checkout for this change; user-owned initial files remain intact. Raw captured
public HTML remains outside this checkout and is not committed as a fixture.

No application code, runtime config, dependency manifest, server, bot, Cloudflare
or production credential changes. Diagnostic npm dependencies were installed in
the fresh copy with install scripts disabled; native SQLite has not been built.
Implementation requires the written-spec/plan reviews from AGENTS.md, then
Node24 validation, exact-SHA CI/package and ordinary deployment. Phone check
must name the actual catalogue; investigate auth/log evidence if it still fails.

## Primary references

- https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md#optional-template-parameters
- https://github.com/geometer/FBReaderJ/blob/master/fbreader/app/src/main/java/org/geometerplus/fbreader/network/opds/OpenSearchDescription.java

## Review status

Self-review: existing requirement IDs preserved; no new normative spec copy,
no fixed live book-count guarantee, no claim of production request correlation.
This is a small amendment to approved OPDS-001, not a new architectural spec.
Written owner review remains pending before the implementation plan.
