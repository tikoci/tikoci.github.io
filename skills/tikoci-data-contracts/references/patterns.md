# Patterns

Copyable code for the SQLite rules in [tikoci-data-contracts](../SKILL.md),
adapted from rosetta. Each sample was run under Bun 1.4.4 (SQLite 3.53.4)
with the tests at the end, and checked with TypeScript 7.0.2 under the
house `tsconfig.example.json` and Biome 2.6.6 under the house
`biome.example.jsonc` with `--error-on-warnings`. The probes that must
fail: a trigger that deletes with a plain `DELETE`, a row dropped by the
database, a schema version that does not match, each missing provenance
stamp, and a schema version that disagrees with the pragma.

## An FTS5 index kept by triggers

From rosetta `src/db.ts`. The FTS table names its content table, so it
stores only the index; the triggers keep it current. Delete and update
remove the old row with the `'delete'` command and the **old** values: new
values, or a plain `DELETE FROM pages_fts`, leave the index wrong without
an error. Pick the tokenizer per table (`porter unicode61` here for
prose).

`src/schema.ts`:

```ts
import type { Database } from "bun:sqlite";

export const SCHEMA_VERSION = 3;

/** Content table, external-content FTS5 index, and the three triggers that keep it in sync. */
export function createSchema(db: Database): void {
  db.run(`
    CREATE TABLE pages (
      id    INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      body  TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE pages_fts USING fts5(
      title, body,
      content = pages, content_rowid = id,
      tokenize = 'porter unicode61'
    );
    CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;
    CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
    END;
    CREATE TRIGGER pages_au AFTER UPDATE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
      INSERT INTO pages_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;
    CREATE TABLE db_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
```

After a bulk wipe and reload, one `INSERT INTO pages_fts(pages_fts)
VALUES('rebuild')` rebuilds the index from the content table. A doctor
runs `INSERT INTO pages_fts(pages_fts, rank) VALUES('integrity-check', 1)`:
with rank 1 it compares the index with the content table and fails on a
mismatch, which a plain `'integrity-check'` does not do for an
external-content table.

## Count what was stored

From rosetta's extractors (`V-extractor-no-silent-drops`, #90). Read the
count back from the database rather than counting the inserts you sent: a
constraint, a trigger or `INSERT OR IGNORE` can drop a row without an
error.

`src/load.ts`:

```ts
import type { Database } from "bun:sqlite";

export interface Page {
  id: number;
  title: string;
  body: string;
}

/** Load parsed pages and fail when the table does not hold every one of them. */
export function loadPages(db: Database, parsed: Page[]): void {
  const insert = db.prepare("INSERT INTO pages (id, title, body) VALUES (?, ?, ?)");
  db.transaction(() => {
    db.run("DELETE FROM pages");
    for (const page of parsed) insert.run(page.id, page.title, page.body);
  })();
  const stored = db.query<{ n: number }, []>("SELECT count(*) AS n FROM pages").get()?.n ?? 0;
  if (stored !== parsed.length) {
    throw new Error(`parsed ${parsed.length} pages but stored ${stored}`);
  }
}
```

## Install a database for read-only clients

From rosetta `src/setup.ts` and `src/db-lifecycle.ts`. Even a read-only
open of a WAL file creates `-wal` and `-shm` beside it, so the installer
converts a private temp copy to rollback-journal mode, checks it, and only
then renames it into place. Better still, the builder runs the same
`PRAGMA journal_mode=DELETE` before upload.

`src/install.ts`:

```ts
import { Database } from "bun:sqlite";
import { renameSync, rmSync } from "node:fs";
import { SCHEMA_VERSION } from "./schema.ts";

/**
 * Install a downloaded database so read-only clients can open it: convert the
 * private temp copy to rollback-journal mode, probe it, then rename it into
 * place. A rename within one directory is atomic, so a reader sees the old
 * file or the new one, never half of either.
 */
export function installDatabase(tmpPath: string, finalPath: string): void {
  const conn = new Database(tmpPath);
  try {
    conn.run("PRAGMA journal_mode=DELETE");
    const version = conn.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version;
    if (version !== SCHEMA_VERSION) {
      throw new Error(`downloaded schema ${version} does not match this build (${SCHEMA_VERSION})`);
    }
  } catch (error) {
    conn.close();
    rmSync(tmpPath, { force: true });
    throw error;
  }
  conn.close();
  renameSync(tmpPath, finalPath);
}
```

## A provenance stamp and its classifier

From rosetta `scripts/stamp-db-meta.ts` and `classifyDbGrounding` in
`src/paths.ts`, cut down. CI stamps the meta table; one pure function
turns the stamps into a verdict that the stats tool, the startup banner
and a doctor all print. rosetta adds `tag_behind`, which compares
`release_tag` with the latest release.

`src/grounding.ts`:

```ts
import type { Database } from "bun:sqlite";
import { SCHEMA_VERSION } from "./schema.ts";

const STAMPS = ["release_tag", "built_at", "source_commit", "schema_version"] as const;

export type Grounding = "ok" | "schema_mismatch" | "internal_inconsistent" | "unstamped" | "provenance_incomplete";

/** CI stamps provenance at build time; the schema version is stamped twice, in the pragma and here. */
export function stampProvenance(db: Database, values: Record<(typeof STAMPS)[number], string>): void {
  const put = db.prepare("INSERT OR REPLACE INTO db_meta (key, value) VALUES (?, ?)");
  for (const key of STAMPS) put.run(key, values[key]);
}

/** One pure verdict behind the stats tool, the startup banner and the doctor. */
export function classifyGrounding(db: Database): Grounding {
  const pragma = db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version;
  if (pragma !== SCHEMA_VERSION) return "schema_mismatch";
  const rows = db.query<{ key: string; value: string }, []>("SELECT key, value FROM db_meta").all();
  const meta = new Map(rows.map((row) => [row.key, row.value]));
  if (meta.size === 0) return "unstamped";
  if (STAMPS.some((key) => !meta.get(key))) return "provenance_incomplete";
  if (Number(meta.get("schema_version")) !== pragma) return "internal_inconsistent";
  return "ok";
}
```

## Tests

`test/sqlite.test.ts` runs every sample against `:memory:` or a temp
directory; none touches a real database.

```ts
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyGrounding, stampProvenance } from "../src/grounding.ts";
import { installDatabase } from "../src/install.ts";
import { loadPages } from "../src/load.ts";
import { createSchema, SCHEMA_VERSION } from "../src/schema.ts";

function fresh(): Database {
  const db = new Database(":memory:");
  createSchema(db);
  return db;
}

const search = (db: Database, q: string) =>
  db.query<{ id: number }, [string]>("SELECT rowid AS id FROM pages_fts WHERE pages_fts MATCH ? ORDER BY rank").all(q).map((r) => r.id);

describe("FTS triggers", () => {
  test("insert, update and delete keep the index in sync", () => {
    const db = fresh();
    loadPages(db, [
      { id: 1, title: "Bridge", body: "bridging ports" },
      { id: 2, title: "Firewall", body: "filter rules" },
    ]);
    expect(search(db, "bridge")).toEqual([1]);
    db.run("UPDATE pages SET body = 'vlan filtering' WHERE id = 1");
    expect(search(db, "ports")).toEqual([]);
    expect(search(db, "vlan")).toEqual([1]);
    db.run("DELETE FROM pages WHERE id = 2");
    expect(search(db, "rules")).toEqual([]);
    // With rank 1, integrity-check also compares the index with the content table.
    db.run("INSERT INTO pages_fts(pages_fts, rank) VALUES('integrity-check', 1)");
    db.run("INSERT INTO pages_fts(pages_fts) VALUES('rebuild')");
    expect(search(db, "vlan")).toEqual([1]);
  });

  test("a plain DELETE trigger leaves the index wrong, and the content check sees it", () => {
    const db = fresh();
    db.run("DROP TRIGGER pages_au");
    db.run(`CREATE TRIGGER pages_au AFTER UPDATE ON pages BEGIN
      DELETE FROM pages_fts WHERE rowid = old.id;
      INSERT INTO pages_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END`);
    loadPages(db, [{ id: 1, title: "Bridge", body: "bridging ports" }]);
    db.run("UPDATE pages SET body = 'vlan filtering' WHERE id = 1");
    expect(search(db, "ports")).toEqual([1]);
    expect(() => db.run("INSERT INTO pages_fts(pages_fts, rank) VALUES('integrity-check', 1)")).toThrow("checksum mismatch");
  });
});

describe("stored, not attempted", () => {
  test("a dropped row fails the load", () => {
    const db = fresh();
    db.run("CREATE TRIGGER drop_dupes BEFORE INSERT ON pages WHEN new.title = 'Dup' BEGIN SELECT RAISE(IGNORE); END");
    expect(() =>
      loadPages(db, [
        { id: 1, title: "Dup", body: "a" },
        { id: 2, title: "Kept", body: "b" },
      ]),
    ).toThrow("parsed 2 pages but stored 1");
  });
});

describe("install", () => {
  test("a WAL file is converted, then opens read-only", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const tmp = join(dir, "db.sqlite.tmp");
    const final = join(dir, "db.sqlite");
    const build = new Database(tmp);
    build.run("PRAGMA journal_mode=WAL");
    createSchema(build);
    build.close();
    installDatabase(tmp, final);
    expect(existsSync(tmp)).toBe(false);
    const reader = new Database(final, { readonly: true });
    const mode = reader.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode;
    expect(mode).toBe("delete");
    reader.close();
  });

  test("a schema mismatch is refused and the temp file removed", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const tmp = join(dir, "db.sqlite.tmp");
    const old = new Database(tmp);
    old.run(`PRAGMA user_version = ${SCHEMA_VERSION - 1}`);
    old.close();
    expect(() => installDatabase(tmp, join(dir, "db.sqlite"))).toThrow("does not match");
    expect(existsSync(tmp)).toBe(false);
    expect(existsSync(join(dir, "db.sqlite"))).toBe(false);
  });
});

describe("grounding", () => {
  const stamps = { release_tag: "v1.2.0", built_at: "2026-11-18T00:00:00Z", source_commit: "abc1234", schema_version: String(SCHEMA_VERSION) };

  test("verdicts", () => {
    const db = fresh();
    expect(classifyGrounding(db)).toBe("unstamped");
    stampProvenance(db, stamps);
    expect(classifyGrounding(db)).toBe("ok");
    db.run("DELETE FROM db_meta WHERE key = 'source_commit'");
    expect(classifyGrounding(db)).toBe("provenance_incomplete");
    stampProvenance(db, { ...stamps, schema_version: String(SCHEMA_VERSION - 1) });
    expect(classifyGrounding(db)).toBe("internal_inconsistent");
    db.run(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    expect(classifyGrounding(db)).toBe("schema_mismatch");
  });
});
```
