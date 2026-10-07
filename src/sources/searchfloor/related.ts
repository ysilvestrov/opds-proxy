import { load } from 'cheerio';
import type { Book } from '../../domain/book.js';
import type { RelatedSnapshot, RelatedTarget } from '../../domain/related.js';
import { ParseError, parsePage } from './parse.js';
import { parseReferences } from './references.js';

export function parseRelatedPage(html: string, target: RelatedTarget, observedAt: string): RelatedSnapshot {
  const $ = load(html);
  const title = $('title').text().trim();
  const expectedTitle = target.kind === 'author' ? target.slug : target.name;
  const header = target.kind === 'author'
    ? $('.card-body > p.fs-5').filter((_, e) => $(e).find('i.bi-person').length > 0 && $(e).text().trim() === target.slug)
    : $('.card-body > p.fs-5 [data-bs-title="Серия"]').filter((_, e) => $(e).text().trim() === target.name);
  if (title !== expectedTitle || header.length !== 1) throw new ParseError('Unknown entity layout');
  if ($('#btn-next-page, [data-next-page], .load-more, #load-more, a[rel="next"]').length ||
      $('[data-page]').toArray().some(e => ($(e).attr('data-page') ?? '').trim() !== ''))
    throw new ParseError('Unsupported entity pagination');
  const rows = $('.card-body > .series-item');
  if (!rows.length && !$('p').toArray().some(e => $(e).text().trim().startsWith('Ничего не найдено')))
    throw new ParseError('Missing entity rows');
  const accepted = new Map<string, Book>();
  const rejected = new Set<string>();
  for (const e of rows.toArray()) {
    const row = $(e).clone();
    row.find('.series-item, script, style').remove();
    const contents = row.children('.series-content');
    if (contents.length !== 1) throw new ParseError('Unknown entity row');
    const content = contents.first();
    const anchors = content.children('p.fw-medium').find('a[href]');
    const ids: string[] = [];
    for (const a of anchors.toArray()) {
      try {
        const u = new URL($(a).attr('href')!, 'https://searchfloor.org');
        const m = /^\/b\/([1-9][0-9]{0,19})$/.exec(u.pathname);
        if (m && u.origin === 'https://searchfloor.org' && !u.username && !u.password && !u.search && !u.hash) ids.push(m[1]);
      } catch { /* A malformed optional row is not a book. */ }
    }
    const id = ids.length === 1 && anchors.length === 1 ? ids[0] : undefined;
    const badges = content.find('[data-bs-title="Статус книги"]');
    const downloads = content.find('.download-btn');
    const valid = id && anchors.text().trim() && (badges.length === 0 ||
      (badges.length === 1 && badges.text().trim() === 'весь текст')) &&
      downloads.length === 1 && downloads.attr('data-url') === `/book/${id}`;
    if (!valid) { for (const candidate of ids) rejected.add(candidate); continue; }
    const context = $(e).parent('.card-body').clone();
    context.find('.series-item, script, style').remove();
    const refs = parseReferences(`<div id="book${id}">${context.html()}</div>`, id);
    const sourceAuthors = refs.authorRefs?.map(a => a.name) ?? (target.kind === 'author' ? [target.slug] : []);
    if (!sourceAuthors.length) throw new ParseError('Missing entity authors');
    const seriesRef = target.kind === 'series' ? { name: target.name, authors: target.authors } : refs.seriesRef;
    // Reuse strict ordinary metadata parsing only after validating this compact row.
    content.find('[data-bs-title="Статус книги"]').remove();
    const book = parsePage(`<div id="book${id}">${content.html()}<span data-bs-title="Статус книги">весь текст</span></div>`, 1, observedAt).books[0];
    if (!book) throw new ParseError('Invalid entity row');
    const position = row.children('.series-num').text().trim().match(/^([1-9][0-9]*)\.$/);
    const seriesPosition = position ? Number(position[1]) : undefined;
    accepted.set(id, { ...book, authors: sourceAuthors, ...refs,
      ...(seriesRef ? { series: seriesRef.name, seriesRef } : {}),
      ...(seriesRef && seriesPosition && Number.isSafeInteger(seriesPosition) ? { seriesPosition } : {}) });
  }
  return { books: [...accepted.values()].filter(b => !rejected.has(b.id)), observedAt };
}
