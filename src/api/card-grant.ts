import { createHmac, timingSafeEqual } from 'node:crypto';

export interface BookCardSigner {
  sign(source: string, id: string): string;
  verify(source: string, id: string, signature: string): boolean;
}
const validIdentity = (source: string, id: string) => source === 'searchfloor' && /^[1-9][0-9]{0,19}$/.test(id);

export function createBookCardSigner(password: string): BookCardSigner {
  const key = createHmac('sha256', password).update('opds-book-card-key-v1').digest();
  const bytes = (source: string, id: string) => createHmac('sha256', key).update(JSON.stringify([1, 'book-card', source, id])).digest();
  return {
    sign(source, id) {
      if (!validIdentity(source, id)) throw Error('Invalid card identity');
      return bytes(source, id).toString('base64url');
    },
    verify(source, id, signature) {
      if (!validIdentity(source, id) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
      const supplied = Buffer.from(signature, 'base64url');
      return supplied.length === 32 && supplied.toString('base64url') === signature && timingSafeEqual(bytes(source, id), supplied);
    },
  };
}

export function isSignedBookCardRequest(request: Request, signer: BookCardSigner): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  try {
    const url = new URL(request.url);
    const match = /^\/opds\/searchfloor\/books\/([1-9][0-9]{0,19})(?:\/cover)?$/.exec(url.pathname);
    const signatures = url.searchParams.getAll('sig');
    return !!match && signatures.length === 1 && signer.verify('searchfloor', match[1]!, signatures[0]!);
  } catch { return false; }
}
