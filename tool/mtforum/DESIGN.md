# SQLite FTS5 as LLM Retrieval — Design Notes

> **Audience:** LLM agents working on this codebase or adapting this pattern elsewhere.
> This document explains _why_ the architecture works, where it breaks down,
> and SQLite-specific techniques that make small-dataset retrieval practical
> without embeddings or vector stores.

## The Problem This Solves

An LLM needs to answer questions about a corpus (here: forum posts) that is too
large to fit in a context window. The options, roughly ordered by complexity:

| Approach | Effort | Quality | When it breaks |
|----------|--------|---------|----------------|
| Paste raw text / CSV into context | Zero | Poor — floods context, no relevance signal | > ~50 KB of source data |
| `grep` / ripgrep over files | Low | Exact-match only, no ranking, no structure | Any semantic query; returns lines not documents |
| SQLite + `LIKE '%term%'` | Low | Scans every row, no ranking, slow on large text | > ~10K rows with large text columns |
| **SQLite + FTS5** | Moderate | Inverted index, BM25 ranking, sub-millisecond | When queries need semantic understanding (synonyms, paraphrase) |
| Vector embeddings (pgvector, etc.) | High | Semantic similarity | Small datasets where lexical match already works fine |

This project sits in the FTS5 row. For a domain-specific technical corpus where
users use precise terminology (RouterOS commands, protocol names, feature names),
lexical matching with stemming gets ~90% of the retrieval quality of embeddings
with a fraction of the infrastructure.

## How FTS5 Works — Mental Model

Think of FTS5 as the index at the back of a textbook, maintained automatically.

**Without FTS5:** To find posts mentioning "bridge", SQLite scans every row:
```sql
SELECT * FROM posts WHERE raw LIKE '%bridge%';  -- full table scan, no ranking
```

**With FTS5:** SQLite maintains a reverse index mapping `"bridge" → [row 42, 817, 2031]`.
The lookup is O(1) on the index, not O(n) on the table:
```sql
SELECT * FROM post_fts WHERE post_fts MATCH 'bridge';  -- instant, ranked
```

### External Content Tables

This project uses an **external content** FTS table:
```sql
CREATE VIRTUAL TABLE post_fts USING fts5(
    raw, cooked, topic_title,
    content='posts',          -- FTS reads from the posts table
    content_rowid='id'        -- maps FTS rowid to posts.id
);
```

FTS5 doesn't store a second copy of the text — it only stores the inverted index
and reads the actual content from `posts` when needed. Triggers keep the index
in sync on INSERT/UPDATE/DELETE. This matters for storage: the index is much
smaller than the source text.

### Tokenization and Stemming

The tokenizer controls how text is split into searchable terms. The default
`unicode61` does word splitting only. Adding `porter` enables stemming:

```sql
-- "configuring" and "configuration" both stem to "configur" and match each other
tokenize='porter unicode61'
```

**Porter stemming is the single highest-impact setting for LLM retrieval quality.**
Without it, you're doing exact-word matching — better than grep, but not by as
much as you'd expect. With it, you get morphological matching for free.

Tokenizer options in FTS5:

| Tokenizer | What it does | When to use |
|-----------|-------------|-------------|
| `unicode61` (default) | Word boundaries, case folding | Exact term matching |
| `porter unicode61` | Stemming + word boundaries | **General-purpose search — use this** |
| `trigram` | 3-character sliding window | Substring matching, typo tolerance |
| `porter unicode61 trigram` | Not valid — pick one pipeline | — |

> `trigram` enables `LIKE`-style substring search on the FTS index, but produces
> much larger indexes and loses word-boundary awareness. Use it for autocomplete
> or "did you mean" features, not for document retrieval.

## BM25 Ranking

FTS5's `bm25()` function scores documents by relevance using the same algorithm
as traditional search engines. It considers:

- **Term frequency (TF):** More occurrences of the search term → higher score
- **Inverse document frequency (IDF):** Rare terms score higher than common ones
- **Document length normalization:** A short post mentioning "VLAN" once ranks
  higher than a long post mentioning it once among thousands of other words

```sql
SELECT *, bm25(post_fts, 2.0, 0.5, 3.0) AS rank
FROM post_fts
WHERE post_fts MATCH 'vlan bridge'
ORDER BY rank;  -- lower is better (negative scores)
```

The `bm25()` arguments are per-column weights. In this project:
- `raw` = 2.0 (post content, primary signal)
- `cooked` = 0.5 (HTML rendering, mostly redundant with raw)
- `topic_title` = 3.0 (title match is a strong relevance signal)

## FTS5 Query Syntax

FTS5 has a query language that goes well beyond simple term matching:

### Boolean operators
```sql
'vlan AND bridge'          -- both terms must appear
'vlan OR bridge'           -- either term
'vlan NOT wireless'        -- vlan but not wireless
```

### Phrase matching
```sql
'"firewall filter"'        -- exact phrase, in order
```

### Prefix matching
```sql
'config*'                  -- matches configure, configuration, configured, ...
```

### Column filters
```sql
'topic_title:vlan'                    -- only match in the title column
'topic_title:vlan AND raw:bridge'     -- title says vlan, body mentions bridge
```

### NEAR queries — proximity matching

This is one of the more useful features for technical content:

```sql
NEAR("firewall" "filter", 5)     -- terms within 5 tokens of each other
NEAR("ip" "address" "pool", 10)  -- three terms within 10 tokens
```

Why this matters: a post that mentions "firewall" in paragraph 1 and "filter"
in paragraph 12 is probably not about firewall filter rules. A post with
"firewall filter" within 5 tokens almost certainly is. For technical forums
where compound terms matter ("bridge port", "ip route", "system scheduler"),
NEAR queries are more precise than AND.

This project's query planner (`query.ts`) doesn't currently emit NEAR queries
but could detect multi-word technical terms and use them.

### snippet() — context-aware excerpts

Instead of truncating the first N characters of a post, `snippet()` returns
text surrounding the matching terms:

```sql
SELECT snippet(post_fts, 0, '**', '**', '…', 40) AS excerpt
FROM post_fts WHERE post_fts MATCH 'vlan';
-- Returns: "…configured the **VLAN** on the bridge interface and set…"
```

Arguments: `snippet(table, column_index, before_mark, after_mark, ellipsis, max_tokens)`

This is significantly better for LLM consumption than a blind truncation because
the LLM sees the matching context, not the post's preamble.

### highlight() — inline term marking

Similar to snippet but returns the full text with matches marked:

```sql
SELECT highlight(post_fts, 0, '**', '**') AS marked_text
FROM post_fts WHERE post_fts MATCH 'vlan';
```

Less useful for LLM retrieval (too verbose), but good for UI display.

## The NL → SQL Pipeline

The key architectural decision in this project is the query planner in `query.ts`:

```
Natural language question
    → extract date ranges, author filters, sort signals
    → extract search terms (strip stop words)
    → build FTS5 MATCH expression
    → execute ranked SQL query
    → return top-K results with excerpts + engagement metrics
```

This pipeline means the MCP tool caller (the LLM) asks a plain English question
and gets back a small, ranked, structured result. The query planner handles
the translation. Key signals it extracts:

- **Date ranges:** "since 2024-01-01", "between X and Y", "in 2023"
- **Author filters:** "posts by amm0", "from username"
- **Sort mode:** "most liked", "recent", "most visited", "controversial"
- **Code filter:** "routeros scripts", "code blocks"
- **Result limit:** "top 5", "show 20"

### The OR Fallback

When an AND query returns zero results, the planner retries with OR. This
handles the case where the user's terms are individually relevant but don't
co-occur in any single post. The fallback is flagged in the result so the
caller knows the results are broader than requested.

## Data Sizing — Where This Approach Works and Breaks

### Sweet spot: 1K – 500K documents

FTS5 handles this range trivially. Index builds are fast (seconds to low
minutes), queries are sub-millisecond, and the entire database fits in a
single file. This covers:

- Forum archives (this project: ~thousands of posts)
- Personal note collections
- Documentation sites
- Chat/message exports
- Small-to-medium codebases (file-per-row)
- CSV/JSON dataset archives

### Below ~1K documents: probably overkill

If your corpus fits in a single LLM context window (~100-200K tokens), just
pass it directly. The retrieval stage adds complexity without much benefit.
A grep or even `LIKE '%term%'` works fine here.

### Above ~500K documents: still works, but consider alternatives

FTS5 scales to millions of rows without issues — the inverted index is
efficient. But at this scale:

- **BM25 alone may not be enough.** You start needing semantic matching
  (embeddings) because users phrase queries in ways that don't lexically
  overlap with the content.
- **You'll want query expansion** — automatically adding synonyms or
  related terms to the FTS query.
- **Hybrid retrieval** (FTS5 for lexical + vector for semantic) becomes
  worth the infrastructure cost.

### The key question: do your users use the same words as the content?

FTS5 works best when query terms lexically overlap with document terms. For
technical domains (networking, programming, hardware), this is almost always
true — people search for "VLAN", "BGP", "firewall", not "network segmentation
technology". For general-purpose Q&A over diverse content, embeddings win.

## Generalizing This Pattern to Other Small Datasets

The architecture here — CSV → SQLite → FTS5 → MCP tool — is reusable for
any small structured dataset you want an LLM to query:

### Recipe

1. **Ingest:** Parse your source format (CSV, JSON, Markdown files, API dumps)
   into a SQLite table with a text column per searchable field.

2. **Index:** Create an FTS5 virtual table over the searchable columns:
   ```sql
   CREATE VIRTUAL TABLE docs_fts USING fts5(
       title, body,
       content='docs',
       content_rowid='id',
       tokenize='porter unicode61'
   );
   ```

3. **Sync triggers:** If the source table is mutable, add AFTER INSERT/UPDATE/DELETE
   triggers to keep the FTS index current (see `db.ts` for the pattern).

4. **Query function:** Accept natural language, extract structured filters,
   build an FTS5 MATCH expression, return top-K with `bm25()` ranking and
   `snippet()` excerpts.

5. **Expose via MCP:** Wrap the query function as an MCP tool so any LLM
   client can call it.

### Adapting the column weights

The `bm25()` weights should reflect your data's structure:

- **High weight (3.0+):** Title, subject line, heading — short, high-signal text
- **Medium weight (1.0-2.0):** Body text, content — the bulk of the data
- **Low weight (0.5):** Metadata rendered as text, redundant fields

### What to index vs. what to filter

- **Index in FTS5:** Free-text fields that users would search by content
  (titles, bodies, descriptions, comments)
- **Filter in SQL WHERE:** Structured fields with known values (dates, authors,
  categories, status, numeric ranges)

Don't put dates or category IDs in the FTS index — use SQL WHERE clauses
for those. FTS5 is for text matching; SQL is for structured filtering.
Combine them in a single query by JOINing the FTS table with the source table.

## SQLite Features Worth Knowing for LLM Data Work

Beyond FTS5, these SQLite capabilities are useful when building LLM retrieval:

### JSON functions
SQLite has `json_extract()`, `json_each()`, `json_group_array()`, etc.
JSON blob columns aren't opaque — you can query into them:
```sql
SELECT json_extract(metadata, '$.author') FROM docs WHERE ...
```

### Window functions
Useful for "rank within group" queries:
```sql
SELECT *, ROW_NUMBER() OVER (PARTITION BY topic_id ORDER BY created_at) AS post_order
FROM posts
```

### CTEs (WITH clauses)
Common table expressions make complex queries readable. This project uses
a recursive CTE in `vw_category_posts` to split comma-separated category
strings into rows — a common pattern for denormalized data.

### Generated columns
Computed columns that are stored or virtual:
```sql
ALTER TABLE posts ADD COLUMN text_clean TEXT
    GENERATED ALWAYS AS (replace(replace(cooked, '<p>', ''), '</p>', '')) VIRTUAL;
```
Useful for creating a cleaned-up text column to feed into FTS without
duplicating data.

### INSERT ... ON CONFLICT ... RETURNING
Modern SQLite (3.35+) supports proper upsert with a returning clause:
```sql
INSERT INTO posts (url, raw, ...) VALUES (?, ?, ...)
ON CONFLICT(url) DO UPDATE SET raw = excluded.raw, ...
RETURNING id;
```
Eliminates the need for two-phase INSERT OR IGNORE + UPDATE + SELECT patterns.

### WAL mode
`PRAGMA journal_mode=WAL` allows concurrent reads during writes. Always
enable this for any database that serves queries while importing data.

## vs. Grep / Ripgrep Over Files

If your data lives in flat files in a `.local` directory, `grep` is the
zero-effort baseline. Here's where SQLite+FTS5 beats it:

| Capability | grep/rg | SQLite + FTS5 |
|-----------|---------|---------------|
| Exact string match | Yes | Yes |
| Regex | Yes | No (use LIKE/GLOB on source table) |
| Ranked results | No | Yes (BM25) |
| Stemming | No | Yes (porter) |
| Proximity ("X near Y") | No | Yes (NEAR) |
| Structured filters (date, author) | Awkward (filename hacks) | Native SQL WHERE |
| Cross-field queries | No | Yes (column weights) |
| Aggregation | No | Yes (COUNT, GROUP BY, window functions) |
| Result limit + offset | `head -n` | LIMIT/OFFSET with ordering |
| Contextual excerpts | `-C` flag (fixed window) | `snippet()` (term-aware window) |
| Persistent across queries | Rescans every time | Indexed once, queries are instant |

The break-even point is roughly: if you're running more than a few searches
per session, or if you need ranking, the index pays for itself immediately.

## File Layout

```
tool/mtforum/
├── mcp.ts          # MCP server — tool definitions + stdio transport
├── db.ts           # Schema init, FTS5 setup, triggers, upsert helpers
├── query.ts        # NL → SQL query planner, BM25 ranking, result formatting
├── importer.ts     # Discourse CSV → SQLite ingestion pipeline
├── import-cli.ts   # CLI wrapper for the importer
├── package.json    # Dependencies: @modelcontextprotocol/sdk, csv-parse, zod
├── tsconfig.json   # TypeScript config
└── DESIGN.md       # This file
```

## Known Limitations and Future Work

- **No porter stemming yet.** The FTS5 table uses the default `unicode61`
  tokenizer. Adding `tokenize='porter unicode61'` requires a migration that
  drops and rebuilds the FTS table and triggers.
- **Manual excerpt truncation.** `buildExcerpt()` in `query.ts` truncates
  at 400 characters. Switching to FTS5's `snippet()` would give match-aware
  excerpts.
- **No NEAR queries.** The query planner emits AND/OR but could detect
  multi-word technical terms and use NEAR for better precision.
- **Auth token data imported.** The importer ingests `auth_tokens.csv` and
  `auth_token_logs.csv` for completeness, but these contain security-sensitive
  data (token hashes, IPs, user agents). Consider skipping these.
- **Two-phase upsert.** The INSERT OR IGNORE + UPDATE pattern in `upsertPost()`
  could be simplified to INSERT ... ON CONFLICT ... RETURNING.
- **This MCP will move to its own repository.** It was developed here alongside
  the static site for convenience, but the forum archive tool is independent
  of the website and will be extracted.
