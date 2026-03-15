/**
 * mcp.ts — MCP server for the MikroTik forum archive.
 *
 * Exposes the local Discourse export SQLite database as MCP tools
 * so VS Code Copilot can search and retrieve forum post content.
 *
 * Register in .vscode/mcp.json (see below).
 *
 * Environment variables:
 *   DB_PATH   — absolute path to the SQLite DB file
 *               default: <workspace>/.local/sqlkb/mtforum/forum.sqlite
 *   CSV_ROOT  — directory to scan for Discourse CSV exports during import
 *               default: <workspace>/.local/sqlkb/mtforum
 *   CSV_USER  — label applied to imported posts (your username)
 *               default: "amm0"
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DB_PATH, db, getDbStats, initDb } from "./db.ts";
import { runImport } from "./importer.ts";
import { exportTopicMarkdown, runQuery } from "./query.ts";
import path from "node:path";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

initDb();

const server = new McpServer({
  name: "mtforum",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool: mtforum_search
// ---------------------------------------------------------------------------

server.tool(
  "mtforum_search",
  `Search the MikroTik Discourse forum archive using natural language.

Returns ranked posts with excerpts, engagement signals (likes, replies), and
topic-level summaries. Supports filters for date ranges, sort modes, and
code-block detection.

The underlying data comes from the local SQLite archive populated from
Discourse "Download My Data" CSV exports. Run mtforum_import first if
the database is empty.

Examples:
  "most liked capsman posts in 2024"
  "firewall filter rules with routeros code"
  "recent posts about VLAN bridging"
  "posts by amm0 since 2025-01-01"`,
  {
    query: z.string().describe("Natural language search question"),
    limit: z.number().int().min(1).max(200).optional().default(8).describe("Max posts to return (default 8)"),
    sort: z.enum(["relevance", "likes", "recent", "visits", "flags"]).optional().describe("Sort mode (default: relevance)"),
    start: z.string().optional().describe("Filter posts on or after this date (YYYY-MM-DD)"),
    end: z.string().optional().describe("Filter posts on or before this date (YYYY-MM-DD)"),
    require_code: z.boolean().optional().describe("Only return posts containing fenced routeros code blocks"),
  },
  async ({ query, limit, sort, start, end, require_code }) => {
    // Augment the natural-language question with any structured overrides
    let q = query;
    if (sort === "likes") q = `most liked ${q}`;
    else if (sort === "recent") q = `latest ${q}`;
    else if (sort === "visits") q = `most visited ${q}`;
    else if (sort === "flags") q = `flagged ${q}`;
    if (start) q = `${q} since ${start}`;
    if (end) q = `${q} before ${end}`;
    if (require_code) q = `routeros scripts ${q}`;

    const result = runQuery(q, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: mtforum_get_topic
// ---------------------------------------------------------------------------

server.tool(
  "mtforum_get_topic",
  `Export all posts for a single Discourse topic as Markdown.

Use this to get the full text of a forum thread for summarization or context.
Find topic IDs by first running mtforum_search and inspecting the topic_id field.`,
  {
    topic_id: z.number().int().describe("Discourse topic ID"),
  },
  async ({ topic_id }) => {
    const md = exportTopicMarkdown(topic_id);
    return {
      content: [{ type: "text", text: md }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: mtforum_import
// ---------------------------------------------------------------------------

server.tool(
  "mtforum_import",
  `Import (or re-scan) Discourse CSV exports into the local SQLite archive.

Scans CSV_ROOT for Discourse "Download My Data" export directories and upserts
their content. Already-imported files (same path + mtime + SHA1) are skipped,
so re-running is fast and safe.

The CSV structure expected:
  CSV_ROOT/
    <export-dir>/
      user_archive.csv
      likes.csv
      flags.csv
      visits.csv
      badges.csv
      bookmarks.csv
      category_preferences.csv
      preferences.json
      ...

Returns a summary: files scanned / imported / skipped and any errors.`,
  {
    force: z.boolean().optional().default(false).describe("Re-import all files even if unchanged"),
    user: z.string().optional().describe("Label to assign to imported posts (default: CSV_USER env var or 'amm0')"),
  },
  async ({ force, user }) => {
    const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
    const csvRoot = process.env.CSV_ROOT?.trim() || path.join(workspaceRoot, ".local", "sqlkb", "mtforum");
    const userName = user || process.env.CSV_USER?.trim() || "amm0";

    const result = runImport({ rootPath: csvRoot, userName, force: force ?? false });
    const summary = {
      db_path: DB_PATH,
      csv_root: csvRoot,
      user: userName,
      ...result,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: mtforum_stats
// ---------------------------------------------------------------------------

server.tool(
  "mtforum_stats",
  `Return database health statistics for the forum archive.

Shows post count, topic count, source exports, and the active DB path.
Use this to verify the archive is populated before searching.`,
  {},
  async () => {
    const stats = getDbStats();

    // Also grab date range
    const dateRange = db.prepare(
      "SELECT MIN(created_at) AS earliest, MAX(created_at) AS latest FROM posts",
    ).get() as { earliest: string | null; latest: string | null };

    const sources = db.prepare(
      "SELECT source_name, COUNT(DISTINCT post_id) AS post_count FROM post_sources ps JOIN source_exports se ON se.id = ps.source_export_id GROUP BY source_name ORDER BY post_count DESC",
    ).all() as Array<{ source_name: string; post_count: number }>;

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ ...stats, date_range: dateRange, sources }, null, 2),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: mtforum_get_post
// ---------------------------------------------------------------------------

server.tool(
  "mtforum_get_post",
  "Retrieve a single forum post by its Discourse post ID or URL.",
  {
    post_id: z.number().int().optional().describe("Discourse post ID"),
    url: z.string().optional().describe("Canonical post URL"),
  },
  async ({ post_id, url }) => {
    if (!post_id && !url) {
      return { content: [{ type: "text", text: '{"error": "Provide post_id or url"}' }] };
    }
    const row = post_id
      ? db.prepare("SELECT * FROM posts WHERE id = ?").get(post_id)
      : db.prepare("SELECT * FROM posts WHERE url = ?").get(url ?? "");
    if (!row) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Post not found" }) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
