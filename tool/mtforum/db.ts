/**
 * db.ts — SQLite schema init for the mtforum MCP server.
 *
 * DB path resolution (highest priority wins):
 *   1. DB_PATH env var
 *   2. Default: <workspace-root>/.local/sqlkb/mtforum/forum.sqlite
 *
 * This module exports a singleton `db` instance, ready after `initDb()`.
 */

import sqlite from "bun:sqlite";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolveDbPath(): string {
  if (process.env.DB_PATH?.trim()) {
    return process.env.DB_PATH.trim();
  }
  // Default: two levels up from tool/mtforum/ → workspace root
  const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
  return path.join(workspaceRoot, ".local", "sqlkb", "mtforum", "forum.sqlite");
}

export const DB_PATH = resolveDbPath();

// Ensure parent directory exists before opening
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new sqlite(DB_PATH);

// ---------------------------------------------------------------------------
// Schema init (idempotent — safe to call on every startup)
// ---------------------------------------------------------------------------

export function initDb() {
  db.run("PRAGMA journal_mode=WAL;");
  db.run("PRAGMA foreign_keys=ON;");

  db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    topic_id INTEGER,
    post_number INTEGER,
    topic_title TEXT,
    categories TEXT,
    url TEXT UNIQUE,
    raw TEXT,
    cooked TEXT,
    created_at TEXT,
    updated_at TEXT,
    is_pm BOOLEAN DEFAULT 0,
    post_like_count INTEGER,
    reply_count INTEGER,
    queued BOOLEAN DEFAULT 0,
    other_json TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    avatar_template TEXT,
    trust_level INTEGER
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    email TEXT,
    created_at TEXT,
    last_posted_at TEXT,
    last_seen_at TEXT,
    title TEXT,
    website TEXT,
    website_name TEXT,
    location TEXT,
    badge_count INTEGER,
    time_read INTEGER,
    recent_time_read INTEGER,
    profile_view_count INTEGER,
    accepted_answers INTEGER,
    gamification_score INTEGER,
    trust_level INTEGER,
    moderator BOOLEAN,
    admin BOOLEAN,
    raw_json TEXT NOT NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY,
    post_id INTEGER,
    topic_id INTEGER,
    post_number INTEGER,
    created_at TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    deleted_by TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS flags (
    id INTEGER PRIMARY KEY,
    post_id INTEGER,
    flag_type TEXT,
    created_at TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    deleted_by TEXT,
    related_post_id INTEGER,
    targets_topic BOOLEAN,
    was_take_action BOOLEAN
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER,
    post_number INTEGER,
    count INTEGER,
    visited_at TEXT,
    posts_read INTEGER,
    mobile BOOLEAN,
    time_read INTEGER
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY,
    badge_id INTEGER,
    badge_name TEXT,
    granted_at TEXT,
    post_id INTEGER,
    seq INTEGER,
    granted_manually BOOLEAN,
    notification_id INTEGER,
    featured_rank INTEGER
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    badge_id INTEGER,
    granted_at TEXT,
    created_at TEXT,
    count INTEGER,
    granted_by_id INTEGER
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS badge_types (
    id INTEGER PRIMARY KEY,
    name TEXT,
    sort_order INTEGER
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS bookmarks (
    bookmarkable_id INTEGER NOT NULL,
    bookmarkable_type TEXT NOT NULL,
    link TEXT, name TEXT, created_at TEXT, updated_at TEXT,
    reminder_at TEXT, reminder_last_sent_at TEXT, reminder_set_at TEXT,
    auto_delete_preference TEXT,
    PRIMARY KEY (bookmarkable_id, bookmarkable_type)
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS category_preferences (
    category_id INTEGER PRIMARY KEY,
    category_names TEXT,
    notification_level TEXT,
    dismiss_new_timestamp TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY,
    auth_token_hash TEXT, prev_auth_token_hash TEXT, auth_token_seen BOOLEAN,
    client_ip TEXT, user_agent TEXT, seen_at TEXT, rotated_at TEXT,
    created_at TEXT, updated_at TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS auth_token_logs (
    id INTEGER PRIMARY KEY,
    action TEXT, user_auth_token_id INTEGER, client_ip TEXT,
    auth_token_hash TEXT, created_at TEXT, path TEXT, user_agent TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS imports (
    path TEXT PRIMARY KEY,
    mtime INTEGER,
    sha1 TEXT,
    processed_at TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS source_exports (
    id INTEGER PRIMARY KEY,
    export_path TEXT NOT NULL UNIQUE,
    root_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    source_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY,
    root_path TEXT NOT NULL,
    db_path TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT 'default',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    files_scanned INTEGER NOT NULL DEFAULT 0,
    files_imported INTEGER NOT NULL DEFAULT 0
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS post_sources (
    post_id INTEGER NOT NULL,
    source_export_id INTEGER NOT NULL,
    first_batch_id INTEGER NOT NULL,
    last_batch_id INTEGER NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (post_id, source_export_id)
  );`);

  // FTS5 virtual table (external content, stays in sync via triggers)
  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS post_fts USING fts5(
    raw, cooked, topic_title,
    content='posts',
    content_rowid='id'
  );`);

  // FTS sync triggers
  db.run(`CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO post_fts(rowid, raw, cooked, topic_title)
    VALUES (new.id, new.raw, new.cooked, new.topic_title);
  END;`);
  db.run(`CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
    INSERT INTO post_fts(post_fts, rowid, raw, cooked, topic_title)
    VALUES('delete', old.id, old.raw, old.cooked, old.topic_title);
  END;`);
  db.run(`CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
    INSERT INTO post_fts(post_fts, rowid, raw, cooked, topic_title)
    VALUES('delete', old.id, old.raw, old.cooked, old.topic_title);
    INSERT INTO post_fts(rowid, raw, cooked, topic_title)
    VALUES (new.id, new.raw, new.cooked, new.topic_title);
  END;`);

  // Views
  db.run(`CREATE VIEW IF NOT EXISTS vw_topic_summary AS
    SELECT topic_id, topic_title,
      MIN(created_at) AS first_post,
      MAX(created_at) AS last_post,
      COUNT(*) AS post_count
    FROM posts GROUP BY topic_id;`);

  db.run(`CREATE VIEW IF NOT EXISTS vw_engagement AS
    SELECT
      p.id AS post_id,
      MAX(COALESCE(p.post_like_count, 0), COUNT(DISTINCT l.id)) AS like_count,
      COUNT(DISTINCT f.id) AS flag_count,
      COALESCE(SUM(v.count), 0) AS visit_count
    FROM posts p
    LEFT JOIN likes l ON l.post_id = p.id
    LEFT JOIN flags f ON f.post_id = p.id
    LEFT JOIN visits v ON v.topic_id = p.topic_id AND v.post_number = p.post_number
    GROUP BY p.id;`);

  applyMigration("2026-03-14-category-view", [
    "DROP VIEW IF EXISTS vw_category_posts;",
    `CREATE VIEW vw_category_posts AS
     WITH RECURSIVE split(post_id, category, rest) AS (
       SELECT id, '', COALESCE(categories, '') || ','
       FROM posts
       UNION ALL
       SELECT post_id, trim(substr(rest,0,instr(rest,','))), substr(rest,instr(rest,',')+1)
       FROM split WHERE rest != ''
     )
     SELECT p.*, split.category
     FROM split JOIN posts p ON p.id = split.post_id
     WHERE split.category != '';`,
  ]);

  applyMigration("2026-03-14-indexes", [
    "CREATE INDEX IF NOT EXISTS idx_posts_topic_post ON posts(topic_id, post_number);",
    "CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);",
    "CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);",
    "CREATE INDEX IF NOT EXISTS idx_flags_post_id ON flags(post_id);",
    "CREATE INDEX IF NOT EXISTS idx_visits_topic_post ON visits(topic_id, post_number);",
    "CREATE INDEX IF NOT EXISTS idx_post_sources_post ON post_sources(post_id);",
    "CREATE INDEX IF NOT EXISTS idx_post_sources_export ON post_sources(source_export_id);",
  ]);
}

function applyMigration(version: string, statements: string[]) {
  const existing = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1")
    .get(version);
  if (existing) return;
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const sql of statements) db.run(sql);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(version, now);
  })();
}

// ---------------------------------------------------------------------------
// Post upsert (shared between importer and MCP)
// ---------------------------------------------------------------------------

export type PostRow = {
  id?: number | null;
  user_id?: number | null;
  topic_id?: number | null;
  post_number?: number | null;
  topic_title?: string | null;
  categories?: string | null;
  url?: string | null;
  raw?: string | null;
  cooked?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_pm?: boolean | null;
  post_like_count?: number | null;
  reply_count?: number | null;
  queued?: boolean | null;
  other_json?: string | null;
};

/** Upsert a post row; returns the `id` actually stored (may differ from input id). */
export function upsertPost(p: PostRow): number {
  // Two-phase upsert: INSERT OR IGNORE handles both PK (id) and UNIQUE (url) conflicts,
  // then UPDATE ensures the data is current for the url-keyed row.
  db.prepare(`
    INSERT OR IGNORE INTO posts
      (id, user_id, topic_id, post_number, topic_title, categories, url,
       raw, cooked, created_at, updated_at, is_pm, post_like_count, reply_count, queued, other_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.id ?? null, p.user_id ?? null, p.topic_id ?? null, p.post_number ?? null,
    p.topic_title ?? null, p.categories ?? null, p.url ?? null,
    p.raw ?? null, p.cooked ?? null, p.created_at ?? null, p.updated_at ?? null,
    p.is_pm ? 1 : 0, p.post_like_count ?? null, p.reply_count ?? null,
    p.queued ? 1 : 0, p.other_json ?? null,
  );

  if (p.url) {
    db.prepare(`
      UPDATE posts SET
        raw             = ?,
        cooked          = ?,
        topic_title     = ?,
        categories      = ?,
        updated_at      = ?,
        post_like_count = ?,
        reply_count     = ?
      WHERE url = ?
    `).run(
      p.raw ?? null, p.cooked ?? null, p.topic_title ?? null, p.categories ?? null,
      p.updated_at ?? null, p.post_like_count ?? null, p.reply_count ?? null, p.url,
    );
  }

  // Retrieve the actual stored id
  const row = db.prepare("SELECT id FROM posts WHERE url = ?").get(p.url ?? "") as
    | { id: number }
    | null;
  if (row) return row.id;
  return Number((db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0);
}

// ---------------------------------------------------------------------------
// Stats helper
// ---------------------------------------------------------------------------

export function getDbStats() {
  const count = (sql: string) =>
    Number((db.prepare(sql).get() as { c: number }).c ?? 0);
  return {
    db_path: DB_PATH,
    posts: count("SELECT COUNT(*) AS c FROM posts"),
    topics: count("SELECT COUNT(DISTINCT topic_id) AS c FROM posts"),
    imports: count("SELECT COUNT(*) AS c FROM imports"),
    source_exports: count("SELECT COUNT(*) AS c FROM source_exports"),
    import_batches: count("SELECT COUNT(*) AS c FROM import_batches"),
  };
}
