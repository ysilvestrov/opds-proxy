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
    characterCount?: number;
    authorSheets?: number;
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
export type ArtworkMime = 'image/jpeg' | 'image/png' | 'image/gif';
export interface Artwork {
    mime: ArtworkMime;
    bytes: Uint8Array;
    observedAt: string;
}
export interface BookDetails {
    sourceName: string;
    id: string;
    summary?: string;
    cover?: {
        mime: ArtworkMime;
    };
    observedAt: string;
}
export interface AnnotationHint {
    inline?: string;
    api: boolean;
    invalid?: boolean;
}
export interface SourceCard {
    book: Book;
    annotation: AnnotationHint;
}
export interface SourceObservation extends SourcePage {
    rejectedIds: string[];
}
