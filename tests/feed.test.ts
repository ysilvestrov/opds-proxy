import { expect, it } from "vitest";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { renderBookEntry, renderFeed, renderRoot, renderSourceRoot } from "../src/opds/feed.js";
import { renderOpenSearch } from "../src/opds/search.js";
const base = "https://opds.example/proxy";
it('renders genre categories separately from series and compact full-card volume', () => {
  const book = { sourceName: 'searchfloor', id: '1', title: 'Title', authors: ['Author'], complete: true,
    sourceUrl: 'https://searchfloor.org/b/1', downloadPath: '/book/1', observedAt: '2026-10-04T00:00:00Z',
    series: 'Series', seriesPosition: 2, genres: [{ id: '2', name: 'Genre & <fiction> "test"' }], characterCount: 10500, authorSheets: 0.26 };
  const details = { sourceName: 'searchfloor', id: '1', observedAt: book.observedAt, summary: 'First & <paragraph>\n\nSecond', cover: { mime: 'image/jpeg' as const } };
  const source = renderBookEntry(book, details, base, true, { self: base + '/signed-entry?sig=fixture', cover: base + '/signed-cover?sig=fixture' });
  expect(XMLValidator.validate(source)).toBe(true);
  const e = new XMLParser({ ignoreAttributes: false }).parse(source).entry;
  expect(e.category).toEqual([
    { '@_scheme': 'urn:opds:series', '@_term': 'Series', '@_label': 'Series #2' },
    { '@_scheme': 'urn:opds:searchfloor:genre', '@_term': '2', '@_label': 'Genre & <fiction> "test"' },
  ]);
  expect(e.summary['#text']).toBe('Обсяг: 10.5К знаків · 0,26 авторських аркушів\n\nFirst & <paragraph>\n\nSecond');
  expect(e.content['#text']).toBe('Збережені metadata (stale): джерело тимчасово недоступне\n\n' + e.summary['#text']);
  expect(e.link.find((l: any) => l['@_rel'] === 'http://opds-spec.org/image')['@_href']).toBe(base + '/signed-cover?sig=fixture');
  expect(e.link.find((l: any) => l['@_rel'] === 'http://opds-spec.org/acquisition')['@_length']).toBeUndefined();
  const listing = renderFeed({ books: [book], nextPage: null, observedAt: book.observedAt }, { baseUrl: base, query: null, sourceName: 'searchfloor', page: 1, updated: book.observedAt, stale: false });
  const f = new XMLParser({ ignoreAttributes: false }).parse(listing).feed.entry;
  expect(f.category).toEqual(e.category);
  expect(f.summary).toBeUndefined();
  expect(listing).not.toMatch(/Обсяг:|\/genres\/|opds-spec.org\/image/);
});
it('shows volume even without synopsis and preserves previous text when volume is unknown', () => {
  const book = { sourceName: 'searchfloor', id: '1', title: 'Title', authors: [], complete: true, sourceUrl: 'https://searchfloor.org/b/1', downloadPath: '/book/1', observedAt: '2026-10-04T00:00:00Z' };
  const details = { sourceName: 'searchfloor', id: '1', observedAt: book.observedAt };
  const parse = (b: typeof book & { characterCount?: number }, d: typeof details & { summary?: string }) => new XMLParser({ ignoreAttributes: false }).parse(renderBookEntry(b, d, base, false)).entry;
  expect(parse({ ...book, characterCount: 10000 }, details).summary['#text']).toBe('Обсяг: 10.0К знаків');
  expect(parse({ ...book, characterCount: 10000 }, details).content['#text']).toBe('Обсяг: 10.0К знаків');
  expect(parse(book, { ...details, summary: 'Original\n\nParagraphs' }).summary['#text']).toBe('Original\n\nParagraphs');
  expect(parse(book, details).summary).toBeUndefined();
  expect(parse(book, details).content).toBeUndefined();
});
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
