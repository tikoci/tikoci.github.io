/**
 * query.ts — Natural-language → SQL query planner for mtforum posts.
 *
 * Ported and adapted from amm0-mikrotik-forum-archive/src/query.ts.
 * The key pipeline: question string → QueryPlan → SQL → ranked evidence bundle.
 */

import { db, DB_PATH, getDbStats } from "./db.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortMode = "flags" | "likes" | "recent" | "relevance" | "visits";

export type QueryPlan = {
  author?: string;
  endDate?: string;
  extractedTerms: string[];
  ftsQuery?: string;
  limit: number;
  mode: "list" | "search";
  question: string;
  recognizedSignals: string[];
  requireRouterOsScript: boolean;
  sort: SortMode;
  startDate?: string;
};

export type QueryPost = {
  author: string | null;
  categories: string | null;
  created_at: string | null;
  excerpt: string;
  flag_count: number;
  id: number;
  like_count: number;
  post_number: number | null;
  reply_count: number;
  relevance_score: number | null;
  topic_id: number | null;
  topic_title: string | null;
  updated_at: string | null;
  url: string | null;
  visit_count: number;
};

export type QueryResult = {
  dataAvailability: { authorFiltering: boolean; postLevelVisits: boolean; replyCounts: boolean };
  database: { path: string; post_count: number; source_count: number };
  fallbackMode: "or" | null;
  overview: { matchedPosts: number; matchedTopics: number; returnedPosts: number; sort: SortMode };
  plan: QueryPlan;
  posts: QueryPost[];
  topics: TopicSummary[];
  warnings: string[];
};

export type TopicSummary = {
  authors: string[];
  flag_count: number;
  latest_post_at: string | null;
  like_count: number;
  matched_posts: number;
  reply_count: number;
  topic_id: number | null;
  topic_title: string | null;
  url: string | null;
  visit_count: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_LIMIT = 8;
const LIST_MODE_LIMIT = 1000;
const MAX_TERMS = 8;
const MIN_TERM_LENGTH = 2;

const STOP_WORDS = new Set([
  "a","an","and","are","by","code","did","do","does","find","for","from",
  "how","i","in","into","is","it","me","mention","mentions","most","my",
  "of","on","or","popular","post","posts","recently","show","since","tell",
  "that","the","their","them","these","this","those","thread","threads",
  "topic","topics","what","when","where","which","why","with","without",
]);

// ---------------------------------------------------------------------------
// NL signal extraction helpers
// ---------------------------------------------------------------------------

function normalizeWS(s: string) { return s.replace(/\s+/g, " ").trim(); }

function extractQuoted(question: string) {
  const phrases: string[] = [];
  const residue = question.replace(/"([^"]+)"/g, (_m, p: string) => {
    const t = normalizeWS(p);
    if (t) phrases.push(t);
    return " ";
  });
  return { phrases, residue };
}

function extractDateRange(question: string) {
  let residue = question;
  const recognized: string[] = [];
  let startDate: string | undefined;
  let endDate: string | undefined;

  const rangM = residue.match(/\b(?:between|from)\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (rangM) { startDate = rangM[1]; endDate = rangM[2]; recognized.push(`date:${startDate}..${endDate}`); residue = residue.replace(rangM[0], " "); }

  const sinceM = residue.match(/\b(?:since|after)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (sinceM) { startDate = sinceM[1]; recognized.push(`date>=${startDate}`); residue = residue.replace(sinceM[0], " "); }

  const beforeM = residue.match(/\b(?:before|until)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (beforeM) { endDate = beforeM[1]; recognized.push(`date<=${endDate}`); residue = residue.replace(beforeM[0], " "); }

  const yearM = residue.match(/\b(?:in|during)\s+(20\d{2})\b/i);
  if (!startDate && !endDate && yearM) { startDate = `${yearM[1]}-01-01`; endDate = `${yearM[1]}-12-31`; recognized.push(`year:${yearM[1]}`); residue = residue.replace(yearM[0], " "); }

  return { endDate, recognized, residue, startDate };
}

function extractAuthor(question: string) {
  const match = question.match(/\b(?:posts?|threads?|topics?)\s+(?:by|from)\s+([A-Za-z0-9_.-]+)\b/i)
    || question.match(/\b(?:by|from|authored by)\s+([A-Za-z0-9_.-]+)\b/i);

  if (match) {
    const author = normalizeWS(match[1]).replace(/^@/, "");
    return { author: author || undefined, residue: question.replace(match[0], " ") };
  }

  // Auto-detect if a token matches a known source_name
  const knownSources = db.prepare(
    `SELECT DISTINCT lower(source_name) AS sn FROM source_exports WHERE source_name IS NOT NULL AND trim(source_name) != ''`,
  ).all() as Array<{ sn: string }>;
  const known = new Set(knownSources.map((r) => r.sn));
  const tokens = question.match(/[A-Za-z0-9_.-]+/g) || [];
  const matches = [...new Set(tokens.map((t) => t.toLowerCase()).filter((t) => known.has(t)))];
  if (matches.length === 1) {
    const author = matches[0];
    return { author, residue: question.replace(new RegExp(`\\b${author}\\b`, "i"), " ") };
  }
  return { author: undefined, residue: question };
}

function inferSort(question: string) {
  if (/\b(most liked|top liked|popular|likes?)\b/i.test(question)) return { sort: "likes" as const, recognized: ["sort:likes"] };
  if (/\b(most visited|top visited|visits?|views?)\b/i.test(question)) return { sort: "visits" as const, recognized: ["sort:visits"] };
  if (/\b(flagged|controversial|flags?)\b/i.test(question)) return { sort: "flags" as const, recognized: ["sort:flags"] };
  if (/\b(recent|latest|newest)\b/i.test(question)) return { sort: "recent" as const, recognized: ["sort:recent"] };
  return { sort: "relevance" as const, recognized: ["sort:relevance"] };
}

function extractTerms(question: string) {
  const { phrases, residue: r0 } = extractQuoted(question);
  const { residue: r1 } = extractDateRange(r0);
  const { residue: r2 } = extractAuthor(r1);
  const stripped = r2
    .replace(/\b(?:top|show)\s+\d{1,2}\b/gi, " ")
    .replace(/\b(most liked|top liked|popular|likes?|most visited|top visited|visits?|views?|flagged|controversial|flags?|recent|latest|newest)\b/gi, " ")
    .replace(/\b(scripts?|code blocks?|rsc)\b/gi, " ");

  const tokens = stripped.match(/[A-Za-z0-9][A-Za-z0-9._/-]*/g) || [];
  const filtered = [...new Set(
    tokens
      .map((t) => t.toLowerCase())
      .filter((t) => t.length >= MIN_TERM_LENGTH && !STOP_WORDS.has(t)),
  )].slice(0, MAX_TERMS);

  return [...phrases.map((p) => `"${p}"`), ...filtered];
}

function toFtsToken(term: string) {
  if (term.startsWith('"') && term.endsWith('"')) return term; // already quoted phrase
  if (/^[A-Za-z0-9_]+$/.test(term)) return `${term.toLowerCase()}*`;
  return `"${term.replace(/"/g, '""')}"`;
}

function buildFtsQuery(terms: string[], op: "AND" | "OR"): string | undefined {
  if (!terms.length) return undefined;
  return terms.map(toFtsToken).join(` ${op} `);
}

export function planQuestion(question: string, explicitLimit?: number): QueryPlan {
  const normalized = normalizeWS(question);
  const recognized: string[] = [];

  const { endDate, recognized: dRec, residue: r1, startDate } = extractDateRange(normalized);
  recognized.push(...dRec);

  const { author, residue: _r2 } = extractAuthor(r1);
  if (author) recognized.push(`author:${author}`);

  const { sort, recognized: sRec } = inferSort(normalized);
  recognized.push(...sRec);

  const listMode = /\b(?:all|every|each|list)\b/i.test(normalized);
  if (listMode) recognized.push("mode:list");

  const requireRouterOsScript = /\b(routeros\s+scripts?|scripts?|code blocks?|rsc)\b/i.test(normalized);
  if (requireRouterOsScript) recognized.push("filter:routeros-script");

  let limit: number;
  if (listMode) {
    limit = LIST_MODE_LIMIT;
  } else if (explicitLimit && explicitLimit > 0) {
    limit = explicitLimit;
  } else {
    const topM = normalized.match(/\b(?:top|show)\s+(\d{1,2})\b/i);
    limit = topM ? Math.max(1, Number.parseInt(topM[1], 10)) : DEFAULT_LIMIT;
  }

  const extractedTerms = extractTerms(normalized);
  const ftsQuery = buildFtsQuery(extractedTerms, "AND");

  return {
    author,
    endDate,
    extractedTerms,
    ftsQuery,
    limit,
    mode: listMode ? "list" : "search",
    question: normalized,
    recognizedSignals: recognized,
    requireRouterOsScript,
    sort,
    startDate,
  };
}

// ---------------------------------------------------------------------------
// SQL execution
// ---------------------------------------------------------------------------

function buildOrderBy(sort: SortMode, hasFts: boolean): string {
  switch (sort) {
    case "likes": return "like_count DESC, created_at DESC";
    case "visits": return "visit_count DESC, created_at DESC";
    case "flags": return "flag_count DESC, created_at DESC";
    case "recent": return "p.created_at DESC";
    default: return hasFts ? "relevance_score ASC, p.created_at DESC" : "p.created_at DESC";
  }
}

function fetchRows(plan: QueryPlan, ftsQuery?: string) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (ftsQuery) { conditions.push("post_fts MATCH ?"); params.push(ftsQuery); }
  if (plan.startDate) { conditions.push("p.created_at >= ?"); params.push(plan.startDate); }
  if (plan.endDate) { conditions.push("p.created_at <= ?"); params.push(plan.endDate); }
  if (plan.requireRouterOsScript) {
    conditions.push("(COALESCE(p.raw,'') LIKE ? OR COALESCE(p.cooked,'') LIKE ?)");
    params.push("%```routeros%", "%```routeros%");
  }
  if (plan.author) {
    conditions.push(`EXISTS (
      SELECT 1 FROM post_sources ps
      JOIN source_exports se ON se.id = ps.source_export_id
      WHERE ps.post_id = p.id AND lower(se.source_name) = lower(?)
    )`);
    params.push(plan.author);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const relevanceSel = ftsQuery ? "bm25(post_fts, 2.0, 0.5, 3.0)" : "NULL";
  const joinFts = ftsQuery ? "JOIN post_fts ON post_fts.rowid = p.id" : "";

  const sql = `
    SELECT
      p.id, p.topic_id, p.post_number, p.topic_title, p.url,
      p.created_at, p.updated_at, p.raw, p.cooked, p.categories, p.reply_count,
      (SELECT se.source_name FROM post_sources ps
       JOIN source_exports se ON se.id = ps.source_export_id
       WHERE ps.post_id = p.id ORDER BY ps.last_seen_at DESC LIMIT 1) AS author,
      COALESCE(e.like_count, 0) AS like_count,
      COALESCE(e.flag_count, 0) AS flag_count,
      COALESCE(e.visit_count, 0) AS visit_count,
      ${relevanceSel} AS relevance_score
    FROM posts p
    ${joinFts}
    LEFT JOIN vw_engagement e ON e.post_id = p.id
    ${where}
    ORDER BY ${buildOrderBy(plan.sort, Boolean(ftsQuery))}
    LIMIT ?`;

  params.push(plan.limit);
  return db.prepare(sql).all(...params) as Array<{
    author: string | null; categories: string | null; cooked: string | null;
    created_at: string | null; flag_count: number; id: number; like_count: number;
    post_number: number | null; raw: string | null; relevance_score: number | null;
    reply_count: number | null; topic_id: number | null; topic_title: string | null;
    updated_at: string | null; url: string | null; visit_count: number;
  }>;
}

function buildExcerpt(raw: string | null, cooked: string | null): string {
  const src = raw || cooked?.replace(/<[^>]+>/g, " ") || "";
  const trimmed = src.replace(/\s+/g, " ").trim();
  return trimmed.length > 400 ? `${trimmed.slice(0, 397)}…` : trimmed;
}

function summarizeTopics(posts: QueryPost[]): TopicSummary[] {
  const map = new Map<number | null, TopicSummary & { authorsSet: Set<string> }>();
  for (const p of posts) {
    const cur = map.get(p.topic_id) ?? {
      authorsSet: new Set<string>(), authors: [], flag_count: 0,
      latest_post_at: p.created_at, like_count: 0, matched_posts: 0,
      reply_count: 0, topic_id: p.topic_id, topic_title: p.topic_title,
      url: p.url, visit_count: 0,
    };
    cur.matched_posts++;
    if (p.author) cur.authorsSet.add(p.author);
    cur.like_count += p.like_count;
    cur.flag_count += p.flag_count;
    cur.reply_count += p.reply_count;
    cur.visit_count += p.visit_count;
    if (!cur.latest_post_at || (p.created_at && p.created_at > cur.latest_post_at)) cur.latest_post_at = p.created_at;
    map.set(p.topic_id, cur);
  }
  return [...map.values()].map(({ authorsSet, ...rest }) => ({ ...rest, authors: [...authorsSet].sort() }))
    .sort((a, b) => (b.matched_posts - a.matched_posts) || (b.like_count - a.like_count));
}

// ---------------------------------------------------------------------------
// Main query entry point
// ---------------------------------------------------------------------------

export function runQuery(question: string, explicitLimit?: number): QueryResult {
  const plan = planQuestion(question, explicitLimit);
  const stats = getDbStats();
  const warnings: string[] = [];

  if (stats.posts === 0) {
    warnings.push(`Database at ${DB_PATH} has 0 posts. Run the import tool first.`);
  }

  const hasVisits = (db.prepare("SELECT COUNT(*) AS c FROM visits WHERE topic_id IS NOT NULL AND count IS NOT NULL").get() as { c: number }).c > 0;
  if (!hasVisits) warnings.push("post-level visit counts unavailable — visits.csv may not have imported");

  const hasAuthors = stats.source_exports > 0;
  if (plan.author && !hasAuthors) warnings.push("Author filtering unavailable: no source provenance imported");

  let fallbackMode: "or" | null = null;
  let appliedFts = plan.ftsQuery;
  let rows = fetchRows(plan, appliedFts);

  // Retry with OR if AND returns nothing and we have multiple terms
  if (rows.length === 0 && plan.extractedTerms.length > 1 && plan.ftsQuery) {
    const orQuery = buildFtsQuery(plan.extractedTerms, "OR");
    if (orQuery && orQuery !== plan.ftsQuery) {
      rows = fetchRows(plan, orQuery);
      if (rows.length > 0) { appliedFts = orQuery; fallbackMode = "or"; }
    }
  }

  const posts: QueryPost[] = rows.map((r) => ({
    author: r.author,
    categories: r.categories,
    created_at: r.created_at,
    excerpt: buildExcerpt(r.raw, r.cooked),
    flag_count: r.flag_count,
    id: r.id,
    like_count: r.like_count,
    post_number: r.post_number,
    reply_count: r.reply_count ?? 0,
    relevance_score: r.relevance_score,
    topic_id: r.topic_id,
    topic_title: r.topic_title,
    updated_at: r.updated_at,
    url: r.url,
    visit_count: r.visit_count,
  }));

  const topics = summarizeTopics(posts).slice(0, Math.min(5, Math.max(1, posts.length)));

  return {
    dataAvailability: {
      authorFiltering: hasAuthors,
      postLevelVisits: hasVisits,
      replyCounts: (db.prepare("SELECT COUNT(*) AS c FROM posts WHERE reply_count IS NOT NULL").get() as { c: number }).c > 0,
    },
    database: { path: stats.db_path, post_count: stats.posts, source_count: stats.source_exports },
    fallbackMode,
    overview: { matchedPosts: posts.length, matchedTopics: topics.length, returnedPosts: posts.length, sort: plan.sort },
    plan: { ...plan, ftsQuery: appliedFts },
    posts,
    topics,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Topic export helper (useful for feeding full context to an LLM)
// ---------------------------------------------------------------------------

export function exportTopicMarkdown(topicId: number): string {
  const rows = db.prepare(`
    SELECT topic_title, post_number, created_at, url, raw, cooked,
      (SELECT se.source_name FROM post_sources ps JOIN source_exports se ON se.id=ps.source_export_id WHERE ps.post_id=p.id ORDER BY ps.last_seen_at DESC LIMIT 1) AS author
    FROM posts p WHERE topic_id = ? ORDER BY post_number ASC
  `).all(topicId) as Array<{
    topic_title: string | null; post_number: number | null; created_at: string | null;
    url: string | null; raw: string | null; cooked: string | null; author: string | null;
  }>;

  if (!rows.length) return `No posts found for topic_id ${topicId}.`;

  const title = rows[0].topic_title ?? `Topic ${topicId}`;
  const lines = [`# ${title}\n`];
  for (const r of rows) {
    lines.push(`---\n**Post #${r.post_number}** by ${r.author ?? "unknown"} at ${r.created_at ?? ""}`);
    if (r.url) lines.push(`[View on forum](${r.url})`);
    lines.push("");
    lines.push(r.raw || r.cooked?.replace(/<[^>]+>/g, " ") || "");
    lines.push("");
  }
  return lines.join("\n");
}
