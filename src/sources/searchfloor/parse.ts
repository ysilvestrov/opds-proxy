import type { SourcePage, SourceObservation } from "../../domain/book.js";
import { load, type CheerioAPI } from "cheerio";
export class ParseError extends Error {}
const emptyMarker = ($: CheerioAPI) =>
  $("p")
    .toArray()
    .some((e) => $(e).text().trim().startsWith("Ничего не найдено"));
export const hasEmptyResult = (html: string) => emptyMarker(load(html));
export function parsePage(
  html: string, page: number, observedAt: string,
): SourcePage {
  const {rejectedIds: _, ...result} = parseObservedPage(html,page,observedAt);
  return result;
}
export function parseObservedPage(
  html: string,
  page: number,
  observedAt: string,
): SourceObservation {
  const $ = load(html);
  const cards = $("div[id]").filter((_, e) =>
    /^book\d+$/.test($(e).attr("id") ?? ""),
  );
  const empty = emptyMarker($);
  if (!cards.length && !empty) throw new ParseError("Unrecognized source page");
  const books: SourcePage["books"] = [];
  const seen = new Set<string>();
  const rejected = new Set<string>();
  for (const e of cards.toArray()) {
    const card = $(e);
    const id = card.attr("id")!.slice(4);
    const title = card.find("p.fw-medium").first().text().trim();
    const status = card.find('[data-bs-title="Статус книги"]').text().trim();
    const path = card.find(".download-btn").attr("data-url");
    if (!title) throw new ParseError("Missing book title");
    if (status !== "весь текст" || path !== `/book/${id}`) { rejected.add(id); continue; }
    if (seen.has(id))
      continue;
    seen.add(id);
    const authors = card
      .find('a[href^="/a/"]')
      .toArray()
      .map((a) => $(a).text().trim());
    const series = card.find('[data-bs-title="Серия"]').text().trim();
    const position = Number(
      card.find('[data-bs-title="Номер в серии"]').text().trim(),
    );
    books.push({
      sourceName: "searchfloor",
      id,
      title,
      authors,
      complete: true,
      observedAt,
      sourceUrl: `https://searchfloor.org/b/${id}`,
      downloadPath: path,
      ...(series ? { series } : {}),
      ...(Number.isFinite(position) && position > 0
        ? { seriesPosition: position }
        : {}),
    });
  }
  const next = $("#btn-next-page").attr("data-page");
  const nextPage = next === undefined ? null : Number(next);
  if (
    nextPage !== null &&
    (!Number.isInteger(nextPage) || nextPage <= page || nextPage > 10000)
  )
    throw new ParseError("Invalid pagination");
  return { books, nextPage, observedAt, rejectedIds:[...rejected].filter(id=>!seen.has(id)) };
}
