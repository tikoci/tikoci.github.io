/**
 * importer.ts — Discourse CSV export → SQLite import pipeline.
 *
 * Scans a root directory tree recursively for Discourse "Download My Data" export
 * directories, then upserts their content into the local SQLite DB.
 *
 * Idempotent: files already imported (same path + mtime + SHA1) are skipped.
 *
 * Usage (as a library):
 *   import { runImport } from "./importer.ts";
 *   const result = await runImport({ rootPath: ".local/sqlkb/mtforum", userName: "amm0" });
 *
 * Usage (as a CLI):
 *   bun run import-cli.ts [--root <path>] [--user <name>]
 */

import { db, upsertPost } from "./db.ts";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse } from "csv-parse/sync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso() { return new Date().toISOString(); }

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value !== "string") return undefined;
  const n = value.trim().toLowerCase();
  if (["true", "yes", "1"].includes(n)) return true;
  if (["false", "no", "0"].includes(n)) return false;
  return undefined;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isNaN(n) ? undefined : n;
}

function hashFile(filePath: string): string {
  return crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex");
}

function extractFromUrl(url: string): { topic_id: number | null; post_number: number | null } {
  const m = url.match(/\/t\/[^/]+\/(\d+)(?:\/(\d+))?/);
  if (!m) return { topic_id: null, post_number: null };
  return {
    topic_id: Number.parseInt(m[1], 10),
    post_number: m[2] ? Number.parseInt(m[2], 10) : 1,
  };
}

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];
}

// ---------------------------------------------------------------------------
// Provenance tracking
// ---------------------------------------------------------------------------

interface ImportContext {
  batchId: number;
  rootPath: string;
  sourceExportIds: Map<string, number>;
  userName: string;
}

function getOrCreateSourceExportId(exportDir: string, context: ImportContext): number {
  const cached = context.sourceExportIds.get(exportDir);
  if (cached !== undefined) return cached;

  const relativePath = path.relative(context.rootPath, exportDir) || ".";
  const now = nowIso();

  const existing = db.prepare("SELECT id FROM source_exports WHERE export_path = ? LIMIT 1").get(exportDir) as { id: number } | null;
  if (existing) {
    db.prepare("UPDATE source_exports SET updated_at = ?, source_name = ? WHERE id = ?").run(now, context.userName, existing.id);
    context.sourceExportIds.set(exportDir, existing.id);
    return existing.id;
  }

  db.prepare(
    `INSERT INTO source_exports (export_path, root_path, relative_path, source_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(exportDir, context.rootPath, relativePath, context.userName, now, now);
  const id = Number((db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number }).id);
  context.sourceExportIds.set(exportDir, id);
  return id;
}

function recordPostSource(postId: number, sourceExportId: number, batchId: number) {
  const now = nowIso();
  const existing = db.prepare(
    "SELECT * FROM post_sources WHERE post_id = ? AND source_export_id = ?",
  ).get(postId, sourceExportId) as { first_batch_id: number; first_seen_at: string } | null;

  if (existing) {
    db.prepare(
      "UPDATE post_sources SET last_batch_id = ?, last_seen_at = ? WHERE post_id = ? AND source_export_id = ?",
    ).run(batchId, now, postId, sourceExportId);
  } else {
    db.prepare(
      `INSERT INTO post_sources (post_id, source_export_id, first_batch_id, last_batch_id, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(postId, sourceExportId, batchId, batchId, now, now);
  }
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

function alreadyImported(filePath: string): boolean {
  const stats = fs.statSync(filePath);
  const sha1 = hashFile(filePath);
  const row = db.prepare("SELECT mtime, sha1 FROM imports WHERE path = ?").get(filePath) as
    | { mtime: number; sha1: string }
    | null;
  if (!row) return false;
  return row.mtime === stats.mtimeMs && row.sha1 === sha1;
}

function markImported(filePath: string) {
  const stats = fs.statSync(filePath);
  const sha1 = hashFile(filePath);
  db.prepare(
    "INSERT OR REPLACE INTO imports (path, mtime, sha1, processed_at) VALUES (?, ?, ?, ?)",
  ).run(filePath, stats.mtimeMs, sha1, nowIso());
}

// ---------------------------------------------------------------------------
// Per-file ingestion
// ---------------------------------------------------------------------------

function ingestCsv(filePath: string, sourceExportId: number, context: ImportContext) {
  const rows = parseCsv(filePath);
  const base = path.basename(filePath).toLowerCase();

  switch (base) {
    case "user_archive.csv":
    case "queued_posts.csv": {
      const queued = base === "queued_posts.csv";
      for (const r of rows) {
        const url = r.url;
        let topicId = parseInteger(r.topic_id) ?? null;
        let postNumber = parseInteger(r.post_number) ?? null;
        if ((!topicId || !postNumber) && url) {
          const parsed = extractFromUrl(url);
          topicId = topicId ?? parsed.topic_id;
          postNumber = postNumber ?? parsed.post_number;
        }
        const postId = upsertPost({
          id: parseInteger(r.id),
          user_id: parseInteger(r.user_id),
          topic_id: topicId,
          post_number: postNumber,
          topic_title: r.topic_title ?? null,
          categories: r.categories ?? null,
          url: url ?? null,
          raw: r.post_raw ?? null,
          cooked: r.post_cooked ?? null,
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? null,
          is_pm: parseBoolean(r.is_pm),
          post_like_count: parseInteger(r.like_count),
          reply_count: parseInteger(r.reply_count),
          queued,
          other_json: queued ? JSON.stringify({ verdict: r.verdict ?? null, source: base }) : null,
        });
        recordPostSource(postId, sourceExportId, context.batchId);
      }
      break;
    }

    case "likes.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR IGNORE INTO likes (id, post_id, topic_id, post_number, created_at, updated_at, deleted_at, deleted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          parseInteger(r.id) ?? null, parseInteger(r.post_id) ?? null,
          parseInteger(r.topic_id) ?? null, parseInteger(r.post_number) ?? null,
          r.created_at ?? null, r.updated_at ?? null, r.deleted_at ?? null, r.deleted_by ?? null,
        );
      }
      break;

    case "flags.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR IGNORE INTO flags (id, post_id, flag_type, created_at, updated_at, deleted_at, deleted_by, related_post_id, targets_topic, was_take_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          parseInteger(r.id) ?? null, parseInteger(r.post_id) ?? null,
          r.flag_type ?? null, r.created_at ?? null, r.updated_at ?? null,
          r.deleted_at ?? null, r.deleted_by ?? null,
          parseInteger(r.related_post_id) ?? null,
          r.targets_topic === "true" ? 1 : 0, r.was_take_action === "true" ? 1 : 0,
        );
      }
      break;

    case "visits.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR IGNORE INTO visits (topic_id, post_number, count, visited_at, posts_read, mobile, time_read) VALUES (?, ?, ?, ?, ?, ?, ?)",
          parseInteger(r.topic_id) ?? null, parseInteger(r.post_number) ?? null,
          parseInteger(r.count) ?? null, r.visited_at ?? null,
          parseInteger(r.posts_read) ?? null, parseBoolean(r.mobile) ? 1 : 0,
          parseInteger(r.time_read) ?? null,
        );
      }
      break;

    case "badges.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR IGNORE INTO badges (badge_id, badge_name, granted_at, post_id, seq, granted_manually, notification_id, featured_rank) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          parseInteger(r.badge_id) ?? null, r.badge_name ?? null, r.granted_at ?? null,
          parseInteger(r.post_id) ?? null, parseInteger(r.seq) ?? null,
          r.granted_manually === "true" ? 1 : 0,
          parseInteger(r.notification_id) ?? null, parseInteger(r.featured_rank) ?? null,
        );
      }
      break;

    case "bookmarks.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR REPLACE INTO bookmarks (bookmarkable_id, bookmarkable_type, link, name, created_at, updated_at, reminder_at, reminder_last_sent_at, reminder_set_at, auto_delete_preference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          parseInteger(r.bookmarkable_id) ?? null, r.bookmarkable_type ?? null,
          r.link ?? null, r.name ?? null, r.created_at ?? null, r.updated_at ?? null,
          r.reminder_at ?? null, r.reminder_last_sent_at ?? null, r.reminder_set_at ?? null,
          r.auto_delete_preference ?? null,
        );
      }
      break;

    case "category_preferences.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR REPLACE INTO category_preferences (category_id, category_names, notification_level, dismiss_new_timestamp) VALUES (?, ?, ?, ?)",
          parseInteger(r.category_id) ?? null, r.category_names ?? null,
          r.notification_level ?? null, r.dismiss_new_timestamp ?? null,
        );
      }
      break;

    // auth_tokens and auth_token_logs are imported for completeness but not queried
    case "auth_tokens.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR REPLACE INTO auth_tokens (id, auth_token_hash, prev_auth_token_hash, auth_token_seen, client_ip, user_agent, seen_at, rotated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          parseInteger(r.id) ?? null, r.auth_token_hash ?? null, r.prev_auth_token_hash ?? null,
          parseBoolean(r.auth_token_seen) ? 1 : 0, r.client_ip ?? null, r.user_agent ?? null,
          r.seen_at ?? null, r.rotated_at ?? null, r.created_at ?? null, r.updated_at ?? null,
        );
      }
      break;

    case "auth_token_logs.csv":
      for (const r of rows) {
        db.run(
          "INSERT OR REPLACE INTO auth_token_logs (id, action, user_auth_token_id, client_ip, auth_token_hash, created_at, path, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          parseInteger(r.id) ?? null, r.action ?? null, parseInteger(r.user_auth_token_id) ?? null,
          r.client_ip ?? null, r.auth_token_hash ?? null, r.created_at ?? null,
          r.path ?? null, r.user_agent ?? null,
        );
      }
      break;

    default:
      // Unknown CSV — skip silently
      break;
  }
}

function ingestPreferences(filePath: string, context: ImportContext) {
  getOrCreateSourceExportId(path.dirname(filePath), context);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    user?: Record<string, unknown>;
    users?: Array<{ id: number; username: string; avatar_template: string; trust_level: number }>;
    badges?: Array<{ id: number; name: string }>;
    user_badges?: Array<{ id: number; user_id: number; badge_id: number; granted_at: string; created_at: string; count: number; granted_by_id: number }>;
    badge_types?: Array<{ id: number; name: string; sort_order: number }>;
  };

  if (data.users) {
    for (const u of data.users) {
      db.run(
        "INSERT OR IGNORE INTO users (id, username, avatar_template, trust_level) VALUES (?, ?, ?, ?)",
        u.id, u.username, u.avatar_template, u.trust_level,
      );
    }
  }

  if (data.user_badges) {
    for (const ub of data.user_badges) {
      db.run(
        "INSERT OR REPLACE INTO user_badges (id, user_id, badge_id, granted_at, created_at, count, granted_by_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ub.id, ub.user_id, ub.badge_id, ub.granted_at, ub.created_at, ub.count, ub.granted_by_id,
      );
    }
  }

  if (data.badge_types) {
    for (const bt of data.badge_types) {
      db.run("INSERT OR IGNORE INTO badge_types (id, name, sort_order) VALUES (?, ?, ?)", bt.id, bt.name, bt.sort_order);
    }
  }

  if (data.user) {
    const u = data.user as Record<string, unknown>;
    // Strip sensitive fields before storing
    const safe = { ...u };
    delete safe.email;
    db.run(
      `INSERT OR REPLACE INTO user_profiles
        (user_id, username, email, created_at, last_posted_at, last_seen_at, title, website,
         website_name, location, badge_count, time_read, recent_time_read, profile_view_count,
         accepted_answers, gamification_score, trust_level, moderator, admin, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      u.id ?? null, u.username ?? null,
      // email deliberately omitted — store placeholder
      "<redacted>",
      u.created_at ?? null, u.last_posted_at ?? null, u.last_seen_at ?? null,
      u.title ?? null, u.website ?? null, u.website_name ?? null, u.location ?? null,
      u.badge_count ?? null, u.time_read ?? null, u.recent_time_read ?? null,
      u.profile_view_count ?? null, u.accepted_answers ?? null, u.gamification_score ?? null,
      u.trust_level ?? null, u.moderator ? 1 : 0, u.admin ? 1 : 0,
      JSON.stringify(safe),
    );
  }
}

// ---------------------------------------------------------------------------
// Directory walk
// ---------------------------------------------------------------------------

const KNOWN_CSV_FILES = new Set([
  "user_archive.csv", "queued_posts.csv", "likes.csv", "flags.csv",
  "visits.csv", "badges.csv", "bookmarks.csv", "category_preferences.csv",
  "auth_tokens.csv", "auth_token_logs.csv",
]);

function walkExportDir(dir: string): { csvFiles: string[]; jsonFiles: string[] } {
  const csvFiles: string[] = [];
  const jsonFiles: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walkExportDir(full);
      csvFiles.push(...sub.csvFiles);
      jsonFiles.push(...sub.jsonFiles);
    } else if (entry.isFile()) {
      const low = entry.name.toLowerCase();
      if (KNOWN_CSV_FILES.has(low)) csvFiles.push(full);
      else if (low === "preferences.json") jsonFiles.push(full);
    }
  }
  return { csvFiles, jsonFiles };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ImportOptions = {
  rootPath: string;
  userName?: string;
  force?: boolean; // re-import even if already imported
};

export type ImportResult = {
  filesScanned: number;
  filesImported: number;
  filesSkipped: number;
  batchId: number;
  errors: string[];
};

export function runImport(options: ImportOptions): ImportResult {
  const { rootPath, userName = "default", force = false } = options;

  if (!fs.existsSync(rootPath)) {
    return { filesScanned: 0, filesImported: 0, filesSkipped: 0, batchId: -1, errors: [`Root path not found: ${rootPath}`] };
  }

  const now = nowIso();
  db.prepare(
    "INSERT INTO import_batches (root_path, db_path, user_name, started_at, status) VALUES (?, ?, ?, ?, 'running')",
  ).run(rootPath, (db as unknown as { filename: string }).filename ?? "unknown", userName, now);
  const batchId = Number((db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number }).id);

  const context: ImportContext = {
    batchId,
    rootPath,
    sourceExportIds: new Map(),
    userName,
  };

  const { csvFiles, jsonFiles } = walkExportDir(rootPath);
  const allFiles = [...csvFiles, ...jsonFiles];

  let filesImported = 0;
  let filesSkipped = 0;
  const errors: string[] = [];

  for (const filePath of allFiles) {
    try {
      if (!force && alreadyImported(filePath)) {
        filesSkipped++;
        continue;
      }

      const exportDir = path.dirname(filePath);
      const sourceExportId = getOrCreateSourceExportId(exportDir, context);

      db.transaction(() => {
        if (filePath.toLowerCase().endsWith(".json")) {
          ingestPreferences(filePath, context);
        } else {
          ingestCsv(filePath, sourceExportId, context);
        }
        markImported(filePath);
      })();

      filesImported++;
    } catch (err) {
      errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  db.prepare(
    "UPDATE import_batches SET completed_at = ?, status = ?, files_scanned = ?, files_imported = ? WHERE id = ?",
  ).run(nowIso(), errors.length ? "failed" : "completed", allFiles.length, filesImported, batchId);

  return { filesScanned: allFiles.length, filesImported, filesSkipped, batchId, errors };
}
