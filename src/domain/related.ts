import type { Book } from './book.js';

export type RelatedTarget =
  | { kind: 'author'; slug: string }
  | { kind: 'series'; name: string; authors: string };
export interface RelatedSnapshot { books: Book[]; observedAt: string }

function validString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim() &&
    value === value.normalize('NFC') && [...value].length <= 200 &&
    !/[\p{Cc}\p{Cs}]/u.test(value);
}
function targetFromTuple(value: unknown): RelatedTarget | null {
  if (!Array.isArray(value) || value[0] !== 1) return null;
  if (value.length === 3 && value[1] === 'author' && validString(value[2]))
    return { kind: 'author', slug: value[2] };
  if (value.length === 4 && value[1] === 'series' && validString(value[2]) && validString(value[3]))
    return { kind: 'series', name: value[2], authors: value[3] };
  return null;
}
export function encodeRelatedKey(target: RelatedTarget): string {
  const tuple = target.kind === 'author' ? [1, 'author', target.slug] :
    target.kind === 'series' ? [1, 'series', target.name, target.authors] : null;
  if (!targetFromTuple(tuple)) throw new Error('Invalid related target');
  return Buffer.from(JSON.stringify(tuple), 'utf8').toString('base64url');
}
export function decodeRelatedKey(key: string, kind: RelatedTarget['kind']): RelatedTarget | null {
  if (!key || key.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(key)) return null;
  try {
    const bytes = Buffer.from(key, 'base64url');
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const target = targetFromTuple(value);
    return target && target.kind === kind && encodeRelatedKey(target) === key ? target : null;
  } catch { return null; }
}
