import type { SourcePage, Book, BookDetails } from "../domain/book.js";
export const NAV = "application/atom+xml;profile=opds-catalog;kind=navigation";
export const ACQ = "application/atom+xml;profile=opds-catalog;kind=acquisition";
export const ENTRY = 'application/atom+xml;type=entry;profile=opds-catalog';
export const xml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
export const absolute = (base: string, path: string) =>
  base.replace(/\/+$/, "") + path;
const stamp = "2026-10-04T00:00:00Z";
const link = (rel: string, url: string, type = NAV) =>
  `<link rel="${xml(rel)}" href="${xml(url)}" type="${xml(type)}"/>`;
const frame = (id: string, title: string, updated: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog"><id>${xml(id)}</id><title>${xml(title)}</title><updated>${xml(updated)}</updated><author><name>OPDS Proxy</name></author>${body}</feed>`;
const discovery = (base: string, name: string) =>
  link(
    "search",
    absolute(base, `/opds/${name}/opensearch.xml`),
    "application/opensearchdescription+xml",
  );
const entry = (id: string, title: string, href: string, type: string) =>
  `<entry><id>${xml(id)}</id><title>${xml(title)}</title><updated>${stamp}</updated>${link("subsection", href, type)}<content type="text">${xml(title)}</content></entry>`;
const bookPath = (book:Book) => `/opds/${book.sourceName}/books/${book.id}`;
const bookMetadata = (b:Book) => `<id>urn:opds:${xml(b.sourceName)}:book:${xml(b.id)}</id><title>${xml(b.title)}</title><updated>${xml(b.observedAt)}</updated>${b.authors.map(a=>`<author><name>${xml(a)}</name></author>`).join('')}${b.series ? `<category scheme="urn:opds:series" term="${xml(b.series)}" label="${xml(b.series + (b.seriesPosition ? ' #'+b.seriesPosition : ''))}"/>` : ''}`;
const bookAcquisition = (b:Book,base:string) => link('http://opds-spec.org/acquisition',absolute(base,bookPath(b)+'/download.fb2.zip'),'application/fb2+zip');
export function renderBookEntry(book:Book, details:BookDetails, baseUrl:string, stale:boolean):string {
  let body=bookMetadata(book)+link('self',absolute(baseUrl,bookPath(book)),ENTRY)+link('start',absolute(baseUrl,'/opds'))+link('alternate',book.sourceUrl,'text/html')+bookAcquisition(book,baseUrl);
  if(details.summary)body+=`<summary type="text">${xml(details.summary)}</summary>`;
  const content=[stale?'Збережені metadata (stale): джерело тимчасово недоступне':null,details.summary].filter(Boolean).join('\n\n');
  if(content)body+=`<content type="text">${xml(content)}</content>`;
  if(details.cover)for(const rel of ['http://opds-spec.org/image','http://opds-spec.org/image/thumbnail']) body+=link(rel,absolute(baseUrl,bookPath(book)+'/cover'),details.cover.mime);
  return `<?xml version="1.0" encoding="UTF-8"?><entry xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">${body}</entry>`;
}
export function renderRoot(
  base: string,
  sources: { name: string; title: string }[],
): string {
  return frame(
    "urn:opds:root",
    "Бібліотеки",
    stamp,
    link("self", absolute(base, "/opds")) +
      link("start", absolute(base, "/opds")) +
      sources
        .map((s) =>
          entry(
            `urn:opds:${s.name}:root`,
            s.title,
            absolute(base, `/opds/${s.name}`),
            NAV,
          ),
        )
        .join(""),
  );
}
export function renderSourceRoot(base: string, name: string): string {
  return frame(
    `urn:opds:${name}:root`,
    name,
    stamp,
    link("self", absolute(base, `/opds/${name}`)) +
      link("start", absolute(base, "/opds")) +
      link("up", absolute(base, "/opds")) +
      discovery(base, name) +
      entry(
        `urn:opds:${name}:completed`,
        "Останні завершені книги",
        absolute(base, `/opds/${name}/completed`),
        ACQ,
      ),
  );
}
export function renderFeed(
  data: SourcePage,
  c: {
    baseUrl: string;
    query: string | null;
    sourceName: string;
    page: number;
    updated: string;
    stale: boolean;
  },
): string {
  const url = (page: number) => {
    const u = new URL(
      absolute(
        c.baseUrl,
        `/opds/${c.sourceName}/${c.query === null ? "completed" : "search"}`,
      ),
    );
    if (c.query !== null) u.searchParams.set("q", c.query);
    u.searchParams.set("page", String(page));
    return u.href;
  };
  let body =
    link("self", url(c.page), ACQ) +
    link("start", absolute(c.baseUrl, "/opds")) +
    link("up", absolute(c.baseUrl, `/opds/${c.sourceName}`)) +
    discovery(c.baseUrl, c.sourceName);
  if (data.nextPage !== null) body += link("next", url(data.nextPage), ACQ);
  if (c.stale)
    body +=
      "<subtitle>Збережений каталог (stale): джерело тимчасово недоступне</subtitle>";
  body += data.books
    .map(
      (b) =>
        `<entry>${bookMetadata(b)}${b.summary ? `<summary type="text">${xml(b.summary)}</summary>` : ''}${link('alternate',absolute(c.baseUrl,bookPath(b)),ENTRY)}${link('alternate',b.sourceUrl,'text/html')}${bookAcquisition(b,c.baseUrl)}</entry>`,
    )
    .join("");
  return frame(
    `urn:opds:${c.sourceName}:feed:${encodeURIComponent(c.query ?? "completed")}:${c.page}`,
    c.query === null ? "Останні завершені книги" : `Пошук: ${c.query}`,
    c.updated,
    body,
  );
}
