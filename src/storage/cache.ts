import Database from "better-sqlite3";
import { mkdirSync, existsSync, lstatSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
interface Options {
    schema?: number;
    maxKeys?: number;
    maxBytes?: number;
    maxArtworkBytes?: number;
    onReset?: (reason: string) => void;
}
export class Cache {
    private db: Database.Database;
    private rank = 0;
    constructor(path: string, private options: Options = {}) {
        const schema = options.schema ?? 1;
        const memory = path === ":memory:";
        const file = memory ? path : resolve(path);
        if (!memory) {
            mkdirSync(dirname(file), { recursive: true });
            if (existsSync(file) && !lstatSync(file).isFile())
                throw Error("Cache must be a regular file");
        }
        const open = () => {
            const db = new Database(file);
            try {
                const check = db.pragma("quick_check", { simple: true });
                if (check !== "ok")
                    throw Error("CACHE_CORRUPT");
                const version = Number(db.pragma("user_version", { simple: true }));
                if (version !== 0 && version !== schema)
                    throw Error("CACHE_SCHEMA");
                return db;
            }
            catch (e) {
                db.close();
                throw e;
            }
        };
        try {
            this.db = open();
        }
        catch (e) {
            const code = (e as {
                code?: string;
            }).code;
            const message = (e as Error).message;
            if (memory ||
                !(code === "SQLITE_NOTADB" ||
                    code === "SQLITE_CORRUPT" ||
                    message === "CACHE_SCHEMA" ||
                    message === "CACHE_CORRUPT"))
                throw e;
            for (const suffix of ["", "-wal", "-shm"]) {
                const original = file + suffix;
                const quarantine = file + ".corrupt" + suffix;
                if (existsSync(quarantine)) {
                    if (!lstatSync(quarantine).isFile())
                        throw Error("Unsafe quarantine");
                    rmSync(quarantine);
                }
                if (existsSync(original)) {
                    if (!lstatSync(original).isFile())
                        throw Error("Unsafe cache sidecar");
                    renameSync(original, quarantine);
                }
            }
            options.onReset?.(code ?? message);
            this.db = open();
        }
        this.db.pragma("journal_mode = WAL");
        this.db.pragma(`user_version = ${schema}`);
        this.db.exec("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY,value TEXT NOT NULL,expires INTEGER NOT NULL,bytes INTEGER NOT NULL,rank INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS artwork_membership (key TEXT PRIMARY KEY)");
        this.rank = Number((this.db.prepare("SELECT COALESCE(MAX(rank),0) n FROM cache").get() as {
            n: number;
        }).n);
    }
    get<T = unknown>(key: string, now: number, stale = false): {
        value: T;
        expiresAt: number;
    } | null {
        this.db
            .prepare("DELETE FROM cache WHERE expires<?")
            .run(now - 24 * 3600000);
        this.pruneMembership();
        const row = this.db
            .prepare("SELECT value,expires FROM cache WHERE key=?")
            .get(key) as {
            value: string;
            expires: number;
        } | undefined;
        if (!row || (!stale && row.expires <= now))
            return null;
        try {
            const value = JSON.parse(row.value) as T;
            this.db
                .prepare("UPDATE cache SET rank=? WHERE key=?")
                .run(++this.rank, key);
            return { value, expiresAt: row.expires };
        }
        catch {
            this.db.prepare("DELETE FROM cache WHERE key=?").run(key);
            return null;
        }
    }
    private pruneMembership() { this.db.prepare('DELETE FROM artwork_membership WHERE key NOT IN (SELECT key FROM cache)').run(); }
    delete(key: string) { this.db.prepare('DELETE FROM cache WHERE key=?').run(key); this.db.prepare('DELETE FROM artwork_membership WHERE key=?').run(key); }
    set<T>(key: string, value: T, expiresAt: number, group?: 'artwork') {
        const json = JSON.stringify(value);
        const bytes = Buffer.byteLength(json);
        const max = this.options.maxBytes ?? 128 * 1024 * 1024;
        if (bytes > max)
            return;
        const artworkMax = this.options.maxArtworkBytes ?? 64 * 1024 * 1024;
        if (group === 'artwork' && bytes > artworkMax)
            return;
        this.db.transaction(() => {
            this.db
                .prepare("INSERT OR REPLACE INTO cache VALUES(?,?,?,?,?)")
                .run(key, json, expiresAt, bytes, ++this.rank);
            if (group === 'artwork')
                this.db.prepare('INSERT OR IGNORE INTO artwork_membership VALUES(?)').run(key);
            else
                this.db.prepare('DELETE FROM artwork_membership WHERE key=?').run(key);
            while (Number((this.db.prepare("SELECT COALESCE(SUM(bytes),0) n FROM cache JOIN artwork_membership USING(key)").get() as {
                n: number;
            }).n) > artworkMax)
                this.db.prepare("DELETE FROM cache WHERE key=(SELECT key FROM cache JOIN artwork_membership USING(key) ORDER BY rank LIMIT 1)").run();
            while (true) {
                const size = this.db
                    .prepare("SELECT COUNT(*) n,COALESCE(SUM(bytes),0) bytes FROM cache")
                    .get() as {
                    n: number;
                    bytes: number;
                };
                if (size.n <= (this.options.maxKeys ?? 10000) && size.bytes <= max)
                    break;
                this.db
                    .prepare("DELETE FROM cache WHERE key=(SELECT key FROM cache ORDER BY rank LIMIT 1)")
                    .run();
            }
            this.pruneMembership();
        })();
        this.db.pragma("wal_checkpoint(PASSIVE)");
    }
    close() {
        this.db.pragma("wal_checkpoint(TRUNCATE)");
        this.db.close();
    }
}
