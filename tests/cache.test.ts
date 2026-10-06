import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import Database from 'better-sqlite3';
import { Cache } from "../src/storage/cache.js";
it("creates empty cache, expires records and provides explicit stale lookup", () => {
    const c = new Cache(":memory:");
    expect(c.get("missing", 0)).toBeNull();
    c.set("x", { a: 1 }, 100);
    expect(c.get("x", 99)?.value).toEqual({ a: 1 });
    expect(c.get("x", 100)).toBeNull();
    expect(c.get("x", 100, true)?.value).toEqual({ a: 1 });
    c.close();
});
it("evicts least recently used records and respects value budget", () => {
    const c = new Cache(":memory:", { maxKeys: 2, maxBytes: 20 });
    c.set("a", "one", 100);
    c.set("b", "two", 100);
    c.get("a", 1);
    c.set("c", "three", 100);
    expect(c.get("b", 1)).toBeNull();
    expect(c.get("a", 1)).not.toBeNull();
    c.set("large", "x".repeat(100), 100);
    expect(c.get("large", 1)).toBeNull();
    c.close();
});
it("rebuilds corrupt and incompatible caches, retaining only owned files", () => {
    const dir = mkdtempSync(join(tmpdir(), "opds-cache-"));
    const path = join(dir, "cache.sqlite");
    try {
        writeFileSync(path, "corrupt");
        const c = new Cache(path);
        c.set("x", 1, 100);
        c.close();
        const newer = new Cache(path, { schema: 2 });
        expect(newer.get("x", 1)).toBeNull();
        newer.close();
        const old = new Cache(path);
        expect(old.get("x", 1)).toBeNull();
        old.close();
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
it("retains stale pages when storing metadata with a longer TTL", () => {
    const c = new Cache(":memory:");
    c.set("page", {}, 15 * 60000);
    c.set("book", {}, 16 * 60000 + 24 * 3600000);
    expect(c.get("page", 16 * 60000, true)).not.toBeNull();
    c.close();
});
it('bounds serialized artwork separately while retaining shared global limits', () => {
    const c = new Cache(':memory:', { maxBytes: 100, maxArtworkBytes: 25, maxKeys: 3 });
    c.set('meta', { title: 'kept' }, 100);
    c.set('a', { base64: 'aaaa' }, 100, 'artwork');
    c.set('b', { base64: 'bbbb' }, 100, 'artwork');
    expect(c.get('a', 0)).toBeNull();
    expect(c.get('b', 0)).not.toBeNull();
    expect(c.get('meta', 0)).not.toBeNull();
    c.set('b', { title: 'normal' }, 100);
    c.set('c', { base64: 'cccc' }, 100, 'artwork');
    expect(c.get('b', 0)).not.toBeNull();
    expect(c.get('c', 0)).not.toBeNull();
    c.set('d', 1, 100);
    expect(c.get('meta', 0)).toBeNull();
    c.delete('c');
    expect(c.get('c', 0)).toBeNull();
    c.close();
});
it('keeps schema1 legacy writes and manifest compatibility across rollback', () => {
    const dir = mkdtempSync(join(tmpdir(), 'opds-compatible-'));
    const path = join(dir, 'cache.sqlite');
    let old: Database.Database | undefined;
    try {
        const current = new Cache(path);
        current.set('cover', { base64: 'abcd' }, 100, 'artwork');
        current.close();
        old = new Database(path);
        expect(old.pragma('user_version', { simple: true })).toBe(1);
        expect((old.pragma('table_info(cache)') as unknown[]).length).toBe(5);
        old.prepare('INSERT OR REPLACE INTO cache VALUES(?,?,?,?,?)').run('legacy', '{"title":"legacy"}', 100, 18, 20);
        old.prepare('DELETE FROM cache WHERE key=?').run('cover');
        old.close();
        const again = new Cache(path, { maxArtworkBytes: 20 });
        expect(again.get('legacy', 0)?.value).toEqual({ title: 'legacy' });
        again.set('new-cover', { base64: 'a' }, 100, 'artwork');
        expect(again.get('new-cover', 0)).not.toBeNull();
        again.close();
    }
    finally {
        old?.close();
        rmSync(dir, { recursive: true, force: true });
    }
});
