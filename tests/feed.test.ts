import { expect, it } from "vitest";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { renderFeed, renderRoot, renderSourceRoot } from "../src/opds/feed.js";
import { renderOpenSearch } from "../src/opds/search.js";
const base = "https://opds.example/proxy";
it("renders escaped UTF-8 acquisition, stable identity and absolute next links", () => {
  const xml = renderFeed(
    {
      books: [
        {
          sourceName: "searchfloor",
          id: "7",
          title: "Книга & <тест>",
          authors: ["A & B"],
          complete: true,
          sourceUrl: "https://searchfloor.org/b/7",
          downloadPath: "/book/7",
          observedAt: "2026-10-04T00:00:00Z",
        },
      ],
      nextPage: 2,
      observedAt: "2026-10-04T00:00:00Z",
    },
    {
      baseUrl: base,
      sourceName: "searchfloor",
      query: "тест & слово",
      page: 1,
      updated: "2026-10-04T00:00:00Z",
      stale: false,
    },
  );
  expect(XMLValidator.validate(xml)).toBe(true);
  const f = new XMLParser({ ignoreAttributes: false }).parse(xml).feed;
  expect(f.entry.title).toBe("Книга & <тест>");
  expect(f.entry.id).toBe("urn:opds:searchfloor:book:7");
  expect(f.link.find((l: any) => l["@_rel"] === "next")["@_href"]).toContain(
    "/proxy/opds/searchfloor/search?q=",
  );
  expect(
    f.entry.link.find(
      (l: any) => l["@_rel"] === "http://opds-spec.org/acquisition",
    )["@_type"],
  ).toBe("application/fb2+zip");
});
it("keeps empty-page next and stale observation time", () => {
  const xml = renderFeed(
    { books: [], nextPage: 3, observedAt: "2026-10-04T00:00:00Z" },
    {
      baseUrl: base,
      sourceName: "searchfloor",
      query: null,
      page: 2,
      updated: "2026-10-04T00:00:00Z",
      stale: true,
    },
  );
  expect(xml).toContain('rel="next"');
  expect(xml).toContain("stale");
  expect(xml).toContain("2026-10-04T00:00:00Z");
});
it("advertises only v1 source and discovery, reserves disabled capabilities", () => {
  const root = renderRoot(base, [
    { name: "searchfloor", title: "Searchfloor" },
  ]);
  expect(XMLValidator.validate(root)).toBe(true);
  expect(root).toContain("/proxy/opds/searchfloor");
  const source = renderSourceRoot(base, "searchfloor");
  expect(source).not.toMatch(/\/authors|\/genres/);
  expect(source).toContain("opensearch.xml");
  const search = renderOpenSearch(base, "searchfloor");
  expect(XMLValidator.validate(search)).toBe(true);
  expect(search).toContain('xmlns="http://a9.com/-/spec/opensearch/1.1/"');
  expect(search).toContain("{searchTerms}");
});
