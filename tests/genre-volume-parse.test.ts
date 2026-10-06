import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/sources/searchfloor/parse.js';

const at = '2026-10-04T20:00:00Z';
const fixture = (name: string) => readFileSync(new URL(`fixtures/searchfloor/${name}.html`, import.meta.url), 'utf8');
const card = (inside: string, id = '1') => `<div id="book${id}"><p class="fw-medium">Title</p><span data-bs-title="Статус книги">весь текст</span><button class="download-btn" data-url="/book/${id}"></button>${inside}</div>`;
const badge = (text: string, sheets = false) => `<span data-bs-title="${sheets ? 'Размер книги в авторских листах' : 'Размер книги'}">${text}</span>`;
const genre = (href: string, name = 'Genre') => `<a href="${href}">${name}</a>`;
const book = (inside: string) => parsePage(card(inside), 1, at).books[0];

it('extracts exact source genres and volume consistently across existing HTML forms', () => {
  for (const name of ['book', 'completed']) {
    const b = parsePage(fixture(name), 1, at).books.find(b => b.id === '27047');
    expect(b).toMatchObject({ characterCount: 511195, authorSheets: 12.78, genres: [
      { id: '76', name: 'Русреал' }, { id: '28', name: 'Альтернативная история' }, { id: '39', name: 'Городское фэнтези' },
    ] });
  }
  const fragment = parsePage(fixture('fragment'), 2, at);
  expect(fragment.nextPage).toBe(3);
  expect(fragment.books[0]).toMatchObject({ id: '23583', characterCount: 9096, authorSheets: 0.23, genres: [{ id: '75', name: 'Дорама' }] });
});

it('does not take genre links or badges from a nested book container', () => {
  const nested = `<div id="book2"><p class="fw-medium">Child</p>${genre('/popular?include_genres=2', 'Child')}${badge('2000 зн.')}</div>`;
  const outer = parsePage(card(genre('/popular?include_genres=1', 'Parent') + badge('10500 зн.') + nested), 1, at).books[0];
  expect(outer.genres).toEqual([{ id: '1', name: 'Parent' }]);
  expect(outer.characterCount).toBe(10500);
});

it('isolates cards and deduplicates valid same-origin genre IDs', () => {
  const html = card(genre('/popular?include_genres=2', ' First ') + genre('https://searchfloor.org/popular?include_genres=2', 'Duplicate') + genre('/popular?include_genres=3', 'Second') + badge('10 500 зн.')) + card(genre('/popular?include_genres=4', 'Other') + badge('8,25 а.л.', true), '2');
  const [one, two] = parsePage(html, 1, at).books;
  expect(one).toMatchObject({ genres: [{ id: '2', name: 'First' }, { id: '3', name: 'Second' }], characterCount: 10500 });
  expect(one).not.toHaveProperty('authorSheets');
  expect(two).toMatchObject({ genres: [{ id: '4', name: 'Other' }], authorSheets: 8.25 });
  expect(two).not.toHaveProperty('characterCount');
});

it('ignores malformed or foreign genre links without losing the book', () => {
  const invalid = ['https://evil.example/popular?include_genres=2', 'https://user@searchfloor.org/popular?include_genres=2', '/popular?include_genres=2#x', '/popular?include_genres=2&include_genres=3', '/popular?include_genres=2&x=3', '/popular?include_genres=2,3', '/popular?include_genres=-1', '/popular?include_genres=0', '/popular?include_genres=abc', '/other?include_genres=2', 'http://searchfloor.org/popular?include_genres=2', 'https://['];
  const b = book(invalid.map(href => genre(href)).join('') + genre('/popular?include_genres=1', '   '));
  expect(b.complete).toBe(true);
  expect(b).not.toHaveProperty('genres');
});

it('accepts exact integers with source spacing and independent decimal author sheets', () => {
  for (const text of ['511195', '511 195', '511\u00a0195', '511\u202f195']) expect(book(badge(text + ' зн.'))).toMatchObject({ characterCount: 511195 });
  for (const text of ['12.78', '12,78', '12']) expect(book(badge(text + ' а.л.', true)).authorSheets).toBe(text === '12' ? 12 : 12.78);
});

it('omits invalid and ambiguous volume fields individually', () => {
  for (const text of ['51 1195 зн.', '1e6 зн.', '-1 зн.', '0 зн.', 'NaN зн.', 'Infinity зн.', '9007199254740992 зн.', '100 KB', '10.5 зн.', '10500 зн. trailing']) {
    const b = book(badge(text) + badge('1.25 а.л.', true));
    expect(b).not.toHaveProperty('characterCount'); expect(b.authorSheets).toBe(1.25);
  }
  for (const text of ['0 а.л.', '-1 а.л.', '1.234 а.л.', 'Infinity а.л.', '1e2 а.л.', '12 KB']) {
    const b = book(badge(text, true) + badge('10500 зн.'));
    expect(b).not.toHaveProperty('authorSheets'); expect(b.characterCount).toBe(10500);
  }
  expect(book(badge('10500 зн.') + badge('10500 зн.') + badge('2 а.л.', true))).toMatchObject({ authorSheets: 2 });
  expect(book(badge('10500 зн.') + badge('10500 зн.'))).not.toHaveProperty('characterCount');
  expect(book(badge('1 а.л.', true) + badge('2 а.л.', true))).not.toHaveProperty('authorSheets');
});
