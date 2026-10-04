export interface EntityRef {
  name: string;
  id?: string;
}
export interface Book {
  sourceName: string;
  id: string;
  title: string;
  authors: string[];
  summary?: string;
  series?: string;
  seriesPosition?: number;
  authorRefs?: EntityRef[];
  genres?: EntityRef[];
  sourceUrl: string;
  downloadPath: string;
  complete: boolean;
  observedAt: string;
}
export interface SourcePage {
  books: Book[];
  nextPage: number | null;
  observedAt: string;
}
export interface CatalogPage extends SourcePage {
  stale: boolean;
}
