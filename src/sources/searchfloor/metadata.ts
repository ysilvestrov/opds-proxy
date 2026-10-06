import { load } from 'cheerio';
import type { AnnotationHint, ArtworkMime } from '../../domain/book.js';
export function parseAnnotationCard(html: string, id: string): AnnotationHint {
    const $ = load(html);
    const node = $('#annotation').first();
    node.find('script,style').remove();
    if (node.attr('data-url'))
        return { api: node.attr('data-url') === `/api/annotation/${id}` };
    node.find('br').replaceWith('\n');
    node.find('p').each((_, p) => { $(p).append('\n\n'); });
    const inline = node.text().trim();
    if (Buffer.byteLength(inline) > 65536)
        return { api: false, invalid: true };
    return inline ? { inline, api: false } : { api: false };
}
export function parseAnnotation(bytes: Uint8Array): string | null {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim() || null;
}
export function validateArtwork(bytes: Uint8Array, contentType: string): ArtworkMime {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    const starts = (signature: number[]) => signature.every((n, i) => bytes[i] === n);
    if (mime === 'image/jpeg' && starts([255, 216, 255]))
        return mime;
    if (mime === 'image/png' && starts([137, 80, 78, 71, 13, 10, 26, 10]))
        return mime;
    if (mime === 'image/gif' && /^(GIF87a|GIF89a)$/.test(new TextDecoder().decode(bytes.slice(0, 6))))
        return mime;
    throw Error('Invalid artwork');
}
