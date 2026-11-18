# Patterns

Copyable code for the SQLite rules in [tikoci-data-contracts](../SKILL.md),
adapted from rosetta. Each sample was run under Bun 1.4.4 (SQLite 3.53.4)
with the tests at the end, and checked with TypeScript 7.0.2 under the
house `tsconfig.example.json` and Biome 2.6.6 under the house
`biome.example.jsonc` with `--error-on-warnings`. The probes that must
fail: a trigger that deletes with a plain `DELETE`, a row dropped by the
database (which must leave the previous data in place), a schema version
that does not match, a version stamp with no tables behind it, a download
missing a table readers need, a WAL file at the destination, replacing a
file a client holds, an installer whose file was replaced after it opened
it, each missing provenance stamp, and a schema version that disagrees
with the pragma. A reader whose file was swapped between
opening and starting its transaction was probed separately.

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
error. The check runs inside the transaction, so a gap rolls the load
back and the previous data stays. Finalize a statement from `prepare()`:
`bun:sqlite` keeps the file open after `close()` while one is
outstanding, and the next step that needs the file to itself fails with
"database is locked".

`src/load.ts`:

```ts
import type { Database } from "bun:sqlite";

export interface Page {
  id: number;
  title: string;
  body: string;
}

/**
 * Replace the pages with a parsed set, all or nothing. The stored count is
 * read back inside the transaction, so a gap rolls the load back and the
 * previous data stays.
 */
export function loadPages(db: Database, parsed: Page[]): void {
  const insert = db.prepare("INSERT INTO pages (id, title, body) VALUES (?, ?, ?)");
  try {
    db.transaction(() => {
      db.run("DELETE FROM pages");
      for (const page of parsed) insert.run(page.id, page.title, page.body);
      const stored = db.query<{ n: number }, []>("SELECT count(*) AS n FROM pages").get()?.n ?? 0;
      if (stored !== parsed.length) {
        throw new Error(`parsed ${parsed.length} pages but stored ${stored}`);
      }
    })();
  } finally {
    // A statement not finalized keeps the file open after close().
    insert.finalize();
  }
}
```

## Install a database for read-only clients

From rosetta `src/setup.ts` and `src/db-lifecycle.ts`. Even a read-only
open of a WAL file creates `-wal` and `-shm` beside it, so the installer
converts a private temp copy to rollback-journal mode, checks that it
has every table its readers query and some content (a version stamp alone
proves nothing), and only then puts it in place. Better still, the builder runs the same
`PRAGMA journal_mode=DELETE` before upload.

An atomic rename does not make it safe to replace a file a client has
open. This sample refuses instead, given three things:

- **Readers open through `openOwned()`**, which starts a read transaction
  straight after opening and then checks the path still names the file it
  opened (rosetta compares inodes in `acquireOwnership`). Without that
  check, an installer can swap the file between a reader's open and its
  first read.
- **The old file is in rollback-journal mode.** A WAL reader does not
  block `BEGIN EXCLUSIVE`, so the installer refuses a WAL destination.
- **POSIX.** The rename under the lock fails on Windows while any handle
  is open; there, install each version under its own name, as rosetta
  does, and retire old files separately.

A first install uses `linkSync`, which creates the destination only if it
does not exist, so two installers cannot both skip the guard. A
replacement records the destination's inode before opening its guard and
checks it again once it holds the lock: if another installer replaced the
file in between, the lock is on a file no reader can reach any more, so
the installer refuses rather than overwrite the newer file.

`src/install.ts`:

```ts
import { Database } from "bun:sqlite";
import { existsSync, linkSync, renameSync, rmSync, statSync } from "node:fs";
import { SCHEMA_VERSION } from "./schema.ts";

/** Every table a reader of this database queries; a version stamp alone proves nothing. */
const REQUIRED_TABLES = ["pages", "pages_fts", "db_meta"] as const;
const MIN_PAGES = 1;

/** Convert a private temp copy to rollback-journal mode and check it is usable. */
function prepare(tmpPath: string): void {
  const conn = new Database(tmpPath);
  try {
    conn.run("PRAGMA journal_mode=DELETE");
    const version = conn.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version;
    if (version !== SCHEMA_VERSION) {
      throw new Error(`downloaded schema ${version} does not match this build (${SCHEMA_VERSION})`);
    }
    const present = new Set(
      conn.query<{ name: string }, []>("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name),
    );
    const missing = REQUIRED_TABLES.filter((table) => !present.has(table));
    if (missing.length > 0) throw new Error(`downloaded database lacks ${missing.join(", ")}`);
    const pages = conn.query<{ n: number }, []>("SELECT count(*) AS n FROM pages").get()?.n ?? 0;
    if (pages < MIN_PAGES) throw new Error(`downloaded database has ${pages} pages`);
  } finally {
    conn.close();
  }
}

/**
 * A reader's connection, owning the file for its lifetime: it starts a read
 * transaction straight after opening, then checks that the path still names
 * the file it opened, since an installer may have swapped it in between.
 */
export function openOwned(path: string): Database {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = statSync(path).ino;
    const conn = new Database(path, { readonly: true });
    conn.run("BEGIN");
    conn.query("SELECT count(*) FROM sqlite_schema").get(); // takes the shared lock
    if (statSync(path).ino === before) return conn;
    conn.close();
  }
  throw new Error(`${path} kept changing while opening it`);
}

/**
 * Install a downloaded database for readers that use openOwned(). In
 * rollback-journal mode an EXCLUSIVE lock on the old file succeeds only when
 * no owner holds it, so the replacement is renamed in under that lock, which
 * POSIX allows; on Windows the rename fails while any handle is open, so
 * install to a new path there instead. The lock proves something only if
 * the path still names the locked file: another installer may have replaced
 * it after this one opened it.
 */
export function installDatabase(tmpPath: string, finalPath: string): void {
  try {
    prepare(tmpPath);
    try {
      // Creates finalPath only if it does not exist, so two installers cannot both take this path.
      linkSync(tmpPath, finalPath);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const before = statSync(finalPath).ino;
    const guard = new Database(finalPath);
    try {
      const mode = guard.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode;
      // A WAL reader does not block BEGIN EXCLUSIVE, so the lock would prove nothing.
      if (mode !== "delete") throw new Error(`${finalPath} is in ${mode} mode; stop its clients and replace it by hand`);
      try {
        guard.run("BEGIN EXCLUSIVE");
      } catch {
        throw new Error(`${finalPath} is in use; stop its clients and retry`);
      }
      if (statSync(finalPath).ino !== before) {
        guard.run("ROLLBACK");
        throw new Error(`${finalPath} was replaced during this install; retry`);
      }
      renameSync(tmpPath, finalPath);
      guard.run("ROLLBACK");
    } finally {
      guard.close();
    }
  } finally {
    if (existsSync(tmpPath)) rmSync(tmpPath);
  }
}
```

## A provenance stamp and its classifier

From rosetta `scripts/stamp-db-meta.ts` and `classifyDbGrounding` in
`src/paths.ts`, cut down. CI stamps the meta table; one pure function
turns the stamps into a verdict that the stats tool, the startup banner
and a doctor all print. rosetta adds `tag_behind`, which compares the
stamped release tag with the running code's base version; it does not
look up newer releases.

`src/grounding.ts`:

```ts
import type { Database } from "bun:sqlite";
import { SCHEMA_VERSION } from "./schema.ts";

const STAMPS = ["release_tag", "built_at", "source_commit", "schema_version"] as const;

export type Grounding = "ok" | "schema_mismatch" | "internal_inconsistent" | "unstamped" | "provenance_incomplete";

/** CI stamps provenance at build time; the schema version is stamped twice, in the pragma and here. */
export function stampProvenance(db: Database, values: Record<(typeof STAMPS)[number], string>): void {
  const put = db.prepare("INSERT OR REPLACE INTO db_meta (key, value) VALUES (?, ?)");
  try {
    for (const key of STAMPS) put.run(key, values[key]);
  } finally {
    put.finalize();
  }
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
import { installDatabase, openOwned } from "../src/install.ts";
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
  test("a dropped row fails the load and keeps the previous data", () => {
    const db = fresh();
    loadPages(db, [{ id: 1, title: "Old", body: "kept" }]);
    db.run("CREATE TRIGGER drop_dupes BEFORE INSERT ON pages WHEN new.title = 'Dup' BEGIN SELECT RAISE(IGNORE); END");
    expect(() =>
      loadPages(db, [
        { id: 1, title: "Dup", body: "a" },
        { id: 2, title: "Kept", body: "b" },
      ]),
    ).toThrow("parsed 2 pages but stored 1");
    expect(db.query("SELECT title FROM pages").all()).toEqual([{ title: "Old" }]);
  });
});

describe("install", () => {
  function download(dir: string, pages: number, version = SCHEMA_VERSION): string {
    const tmp = join(dir, `db.sqlite.tmp-${pages}-${version}`);
    const build = new Database(tmp);
    build.run("PRAGMA journal_mode=WAL");
    createSchema(build);
    loadPages(
      build,
      Array.from({ length: pages }, (_, i) => ({ id: i + 1, title: `Page ${i + 1}`, body: "text" })),
    );
    build.run(`PRAGMA user_version = ${version}`);
    build.close();
    return tmp;
  }
  const pageCount = (path: string) => {
    const reader = new Database(path, { readonly: true });
    const n = reader.query<{ n: number }, []>("SELECT count(*) AS n FROM pages").get()?.n;
    reader.close();
    return n;
  };

  test("a WAL download is converted, then opens read-only", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const final = join(dir, "db.sqlite");
    const tmp = download(dir, 2);
    installDatabase(tmp, final);
    expect(existsSync(tmp)).toBe(false);
    const reader = new Database(final, { readonly: true });
    expect(reader.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode).toBe("delete");
    reader.close();
  });

  test("a schema mismatch is refused and the temp file removed", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const tmp = download(dir, 2, SCHEMA_VERSION - 1);
    expect(() => installDatabase(tmp, join(dir, "db.sqlite"))).toThrow("does not match");
    expect(existsSync(tmp)).toBe(false);
    expect(existsSync(join(dir, "db.sqlite"))).toBe(false);
  });

  test("a version stamp without the tables is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const final = join(dir, "db.sqlite");
    installDatabase(download(dir, 2), final);
    const tmp = join(dir, "stamp-only.tmp");
    const stub = new Database(tmp);
    stub.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    stub.close();
    expect(() => installDatabase(tmp, final)).toThrow("lacks pages");
    expect(pageCount(final)).toBe(2);
  });

  test("a download missing a table readers need is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const tmp = download(dir, 2);
    const conn = new Database(tmp);
    conn.run("DROP TABLE pages_fts");
    conn.close();
    expect(() => installDatabase(tmp, join(dir, "db.sqlite"))).toThrow("lacks pages_fts");
  });

  test("a WAL file at the destination is refused, not replaced", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const final = join(dir, "db.sqlite");
    const wal = new Database(final);
    wal.run("PRAGMA journal_mode=WAL");
    createSchema(wal);
    wal.close();
    expect(() => installDatabase(download(dir, 2), final)).toThrow("is in wal mode");
  });

  test("an installer whose file was replaced after it opened it refuses", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const final = join(dir, "db.sqlite");
    installDatabase(download(dir, 1), final);
    const slow = download(dir, 3);
    // Pause installer A after it opens its guard; meanwhile B installs and a reader takes B's file.
    const query = Database.prototype.query;
    let owner: Database | undefined;
    let paused = false;
    Database.prototype.query = function (this: Database, sql: string) {
      if (!paused && sql === "PRAGMA journal_mode" && this.filename === final) {
        paused = true;
        installDatabase(download(dir, 2), final);
        owner = openOwned(final);
      }
      return query.call(this, sql);
    } as typeof query;
    try {
      expect(() => installDatabase(slow, final)).toThrow("was replaced during this install");
    } finally {
      Database.prototype.query = query;
    }
    expect(pageCount(final)).toBe(2);
    owner?.close();
  });

  test("a file a client holds is not replaced; a free one is", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-"));
    const final = join(dir, "db.sqlite");
    installDatabase(download(dir, 2), final);
    const owner = openOwned(final);
    expect(() => installDatabase(download(dir, 3), final)).toThrow("is in use");
    expect(pageCount(final)).toBe(2);
    owner.run("ROLLBACK");
    owner.close();
    installDatabase(download(dir, 3), final);
    expect(pageCount(final)).toBe(3);
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
