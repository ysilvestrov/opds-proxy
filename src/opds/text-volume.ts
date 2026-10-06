import type { Book } from '../domain/book.js';

export function formatTextVolume(book: Pick<Book, 'characterCount' | 'authorSheets'>): string | undefined {
  const parts: string[] = [];
  const count = book.characterCount;
  if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) {
    const tenths = Math.floor(count / 100) + (count % 100 >= 50 ? 1 : 0);
    parts.push(`${Math.floor(tenths / 10)}.${tenths % 10}К знаків`);
  }
  const sheets = book.authorSheets;
  if (typeof sheets === 'number' && Number.isFinite(sheets) && sheets > 0 && Number(sheets.toFixed(2)) === sheets) {
    parts.push(`${sheets.toLocaleString('uk-UA', { useGrouping: false, maximumFractionDigits: 2 })} авторських аркушів`);
  }
  return parts.length ? 'Обсяг: ' + parts.join(' · ') : undefined;
}
