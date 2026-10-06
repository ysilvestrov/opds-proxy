import type { EntityRef, SourcePage, SourceObservation } from "../../domain/book.js";
import { load, type CheerioAPI } from "cheerio";
export class ParseError extends Error {}
const emptyMarker = ($: CheerioAPI) =>
  $("p")
    .toArray()
    .some((e) => $(e).text().trim().startsWith("Ничего не найдено"));
export const hasEmptyResult = (html: string) => emptyMarker(load(html));
function characterCount(text: string): number | undefined {
  const match = text.match(/^(\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)[ \u00a0\u202f]+зн\.$/u);
  if (!match) return undefined;
  const value = Number(match[1].replace(/[ \u00a0\u202f]/gu, ''));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
function authorSheets(text: string): number | undefined {
  const match = text.match(/^(\d+(?:[.,]\d{1,2})?)[ \u00a0\u202f]+а\.л\.$/u);
  if (!match) return undefined;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
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
    const genres: EntityRef[] = [];
    const genreIds = new Set<string>();
    const owned = (selector: string) => card.find(selector).filter((_, node) =>
      $(node).parents('div[id]').filter((_, parent) => /^book\d+$/.test($(parent).attr('id') ?? '')).first().get(0) === e);
    for (const anchor of owned('a[href]').toArray()) {
      const name = $(anchor).text().trim();
      if (!name) continue;
      try {
        const url = new URL($(anchor).attr('href')!, 'https://searchfloor.org');
        const params = [...url.searchParams];
        if (url.origin !== 'https://searchfloor.org' || url.username || url.password || url.hash ||
            url.pathname !== '/popular' || params.length !== 1 || params[0][0] !== 'include_genres' || !/^\d+$/.test(params[0][1])) continue;
        const genreId = params[0][1].replace(/^0+/, '');
        if (!genreId || genreIds.has(genreId)) continue;
        genreIds.add(genreId); genres.push({ id: genreId, name });
      } catch { /* Optional malformed links do not invalidate the book. */ }
    }
    const countBadge = owned('[data-bs-title="Размер книги"]');
    const sheetsBadge = owned('[data-bs-title="Размер книги в авторских листах"]');
    const count = countBadge.length === 1 ? characterCount(countBadge.text().trim()) : undefined;
    const sheets = sheetsBadge.length === 1 ? authorSheets(sheetsBadge.text().trim()) : undefined;
    books.push({
      sourceName: "searchfloor",
      id,
      title,
      authors,
      complete: true,
      observedAt,
      sourceUrl: `https://searchfloor.org/b/${id}`,
      downloadPath: path,
      ...(genres.length ? { genres } : {}),
      ...(count !== undefined ? { characterCount: count } : {}),
      ...(sheets !== undefined ? { authorSheets: sheets } : {}),
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
