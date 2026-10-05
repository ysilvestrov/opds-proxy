import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePage } from "../src/sources/searchfloor/parse.js";
const fixture = (name: string) =>
  readFileSync(
    new URL(`fixtures/searchfloor/${name}.html`, import.meta.url),
    "utf8",
  );
const at = "2026-10-04T20:00:00Z";
describe("SOURCE-001 real fixtures", () => {
  it("retains complete books and source identity", () => {
    const p = parsePage(fixture("completed"), 1, at);
    expect(p.books).toHaveLength(20);
    expect(p.books[0]).toMatchObject({
      sourceName: "searchfloor",
      complete: true,
      id: "27047",
    });
    expect(p.books[0].authors.length).toBeGreaterThan(0);
    expect(p.nextPage).toBe(2);
  });
  it("filters incomplete search results even when upstream filter is ignored", () => {
    expect(parsePage(fixture("mixed-search"), 1, at).books).toHaveLength(12);
    expect(parsePage(fixture("filtered-search"), 1, at).books).toHaveLength(12);
  });
  it("accepts a fragment and a standalone book with plain title", () => {
    expect(parsePage(fixture("fragment"), 2, at).nextPage).toBe(3);
    expect(parsePage(fixture("book"), 1, at).books[0].title).toBe(
      "Асмодей нашего времени",
    );
  });
  it("recognizes explicit empty result", () => {
    expect(parsePage(fixture("empty-search"), 1, at)).toMatchObject({
      books: [],
      nextPage: null,
    });
  });
  it("rejects malformed/challenge HTML rather than claiming no results", () => {
    expect(() => parsePage("<html>challenge</html>", 1, at)).toThrow();
  });
  it("filters unknown status and invalid download and deduplicates", () => {
    const html = fixture("book");
    expect(parsePage(html + html, 1, at).books).toHaveLength(1);
    expect(
      parsePage(html.replace("весь текст", "неизвестно"), 1, at).books,
    ).toHaveLength(0);
    expect(
      parsePage(
        html.replace("/book/27047", "https://evil.example/book/27047"),
        1,
        at,
      ).books,
    ).toHaveLength(0);
  });
  it("preserves next link after filtering every book", () => {
    const html = fixture("completed").replaceAll("весь текст", "в процессе");
    expect(parsePage(html, 1, at)).toMatchObject({ books: [], nextPage: 2 });
  });
});
