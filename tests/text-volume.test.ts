import { expect, it } from 'vitest';
import { formatTextVolume } from '../src/opds/text-volume.js';

it.each([
  [10500, '10.5'], [10000, '10.0'], [511195, '511.2'], [10549, '10.5'],
  [10550, '10.6'], [1, '0.0'], [49, '0.0'], [50, '0.1'], [999, '1.0'],
  [Number.MAX_SAFE_INTEGER, '9007199254741.0'],
])('formats exact count %s as decimal thousands %sК', (count, expected) => {
  const book = { characterCount: count as number };
  expect(formatTextVolume(book)).toBe(`Обсяг: ${expected}К знаків`);
  expect(book.characterCount).toBe(count);
});

it('combines independently known source values without inventing missing values', () => {
  expect(formatTextVolume({ characterCount: 511195, authorSheets: 12.78 })).toBe('Обсяг: 511.2К знаків · 12,78 авторських аркушів');
  expect(formatTextVolume({ authorSheets: 12 })).toBe('Обсяг: 12 авторських аркушів');
  expect(formatTextVolume({ authorSheets: 0.23 })).toBe('Обсяг: 0,23 авторських аркушів');
  expect(formatTextVolume({})).toBeUndefined();
});

it('omits invalid legacy fields individually', () => {
  for (const characterCount of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '10500' as unknown as number]) {
    expect(formatTextVolume({ characterCount, authorSheets: 1.25 })).toBe('Обсяг: 1,25 авторських аркушів');
  }
  for (const authorSheets of [0, -1, NaN, Infinity, 1.234, '12' as unknown as number]) {
    expect(formatTextVolume({ authorSheets, characterCount: 10500 })).toBe('Обсяг: 10.5К знаків');
  }
});
