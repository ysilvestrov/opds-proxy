import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';

// Never return raw path segments, method strings, query text or headers.
function routeFields(path: string): { route: string; bookId?: string } {
  if (path === '/opds') return { route: 'root' };
  if (path === '/opds/searchfloor') return { route: 'source_root' };
  const fixed: Record<string, string> = {
    '/opds/searchfloor/icon.png': 'catalog_icon',
    '/opds/searchfloor/completed': 'completed',
    '/opds/searchfloor/search': 'search',
    '/opds/searchfloor/opensearch.xml': 'opensearch',
    '/opds/searchfloor/authors': 'authors',
    '/opds/searchfloor/genres': 'genres',
  };
  if (Object.hasOwn(fixed, path)) return { route: fixed[path]! };
  if (/^\/opds\/searchfloor\/authors\/[^/]+$/.test(path)) return { route: 'author_feed' };
  if (/^\/opds\/searchfloor\/series\/[^/]+$/.test(path)) return { route: 'series_feed' };
  const book = /^\/opds\/searchfloor\/books\/(\d{1,20})(?:\/(cover|download\.fb2\.zip))?$/.exec(path);
  if (book) return { route: book[2] === 'cover' ? 'cover' : book[2] ? 'download' : 'entry', bookId: book[1]! };
  return { route: 'unknown' };
}

export function accessLog(log: Logger): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path;
    if (path !== '/opds' && !path.startsWith('/opds/')) return next();
    const fields = routeFields(path);
    const method = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(c.req.method) ? c.req.method : 'OTHER';
    const started = performance.now();
    await next();
    // This measures the handler response, not a streamed body's completion.
    log.info({
      event: 'access', ...fields, method, status: c.res.status,
      durationMs: Math.round((performance.now() - started) * 1000) / 1000,
      outcome: c.req.raw.signal.aborted ? 'aborted' : 'response_created',
    }, 'OPDS request');
  };
}
