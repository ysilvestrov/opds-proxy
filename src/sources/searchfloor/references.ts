import { load } from 'cheerio';
import type { Book } from '../../domain/book.js';
import { encodeRelatedKey } from '../../domain/related.js';

export function parseReferences(html: string, bookId: string): Pick<Book, 'authorRefs' | 'seriesRef'> {
  const $ = load(html);
  const cards = $('div[id]').filter((_, e) => $(e).attr('id') === `book${bookId}`);
  if (cards.length !== 1) return {};
  const card = cards.first();
  const authorRefs: NonNullable<Book['authorRefs']> = [];
  const series = new Map<string, NonNullable<Book['seriesRef']>>();
  const seen = new Set<string>();
  for (const e of card.find('a[href]').toArray()) {
    if ($(e).parents('div[id]').filter((_, p) => /^book\d+$/.test($(p).attr('id') ?? '')).first().get(0) !== card.get(0)) continue;
    const name = $(e).text().trim();
    if (!name) continue;
    try {
      const url = new URL($(e).attr('href')!, 'https://searchfloor.org');
      if (url.origin !== 'https://searchfloor.org' || url.username || url.password || url.hash) continue;
      const match = /^\/(a|s)\/([^/]+)$/.exec(url.pathname);
      if (!match) continue;
      const slug = decodeURIComponent(match[2]);
      if (match[1] === 'a' && !url.search) {
        encodeRelatedKey({ kind: 'author', slug });
        if (!seen.has(slug)) { seen.add(slug); authorRefs.push({ id: slug, name }); }
      } else if (match[1] === 's') {
        const params = [...url.searchParams];
        if (params.length !== 1 || params[0][0] !== 'authors') continue;
        const rawParams = url.search.slice(1).split('&');
        if (rawParams.length !== 1 || !rawParams[0].includes('=')) continue;
        const rawValue = rawParams[0].slice(rawParams[0].indexOf('=') + 1);
        const authors = decodeURIComponent(rawValue.replace(/\+/g, ' '));
        const ref = { name: slug, authors };
        series.set(encodeRelatedKey({ kind: 'series', ...ref }), ref);
      }
    } catch { /* Invalid optional source references do not invalidate a book. */ }
  }
  return { ...(authorRefs.length ? { authorRefs } : {}),
    ...(series.size === 1 ? { seriesRef: [...series.values()][0] } : {}) };
}
