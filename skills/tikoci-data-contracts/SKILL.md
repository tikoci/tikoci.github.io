---
name: tikoci-data-contracts
description: "tikoci data that code builds and others read (published JSON, a SQLite database in a release, inventories, committed snapshots): a reviewed contract before any consumer, saying what is flexible and what is not; cross-repo output pinned by a strict schema plus consumer-side tests; additive changes compatible, others bump a per-document schemaVersion, which is not a freshness time; failures keep last-good evidence with its original time. SQLite via bun:sqlite: WAL, FTS kept by triggers, rebuilds that rerun, CI provenance a doctor checks; FTS5 BM25 as an MCP retrieval layer. Use when designing a dataset, schema, database, extractor or published file."
---

# Data contracts

Rules for data that code builds and someone else reads: a JSON document a
site publishes, a SQLite database shipped with a release, a generated
inventory, a snapshot committed to git, a file another repo imports. The
reader may be a web page, an MCP tool, another tikoci repo or an agent.
Related rules live elsewhere:

- never hand-edit generated output, published paths that never move, and
  which format to write
  ([tikoci-docs](https://tikoci.dev/house/skills/tikoci-docs/SKILL.md));
- where a tool keeps its own state, TOML for files people edit and JSON
  for a tool's state
  ([tikoci-home](https://tikoci.dev/house/skills/tikoci-home/SKILL.md));
- shipping a database as a release asset
  ([tikoci-release](https://tikoci.dev/house/skills/tikoci-release/SKILL.md));
- a doctor, and the surfaces that serve the data
  ([tikoci-cli-mcp](https://tikoci.dev/house/skills/tikoci-cli-mcp/SKILL.md)).

## A contract first

- **Define and review the contract before anything consumes it**: the
  schema, what each field means, where the data came from, and how failure
  and staleness show. Review real data before building the UI or tool on
  top (tikoci.github.io `docs/add-dataset.md`).
- **A contract says what is flexible, and what is not.** Some parts can
  stay loose: an opaque string, an object whose keys may grow, a field
  marked experimental. The contract names them, and names the parts a
  consumer may rely on. "Consumers ignore unknown fields" is the usual
  flexible part (tikoci.dev `/metadata/schema.md`).
- **A cross-repo output is pinned by a strict JSON Schema plus tests
  written from the consumer's side**, and its shape changes only with both
  updated. A doc lists who reads what. restraml pins
  `deep-inspect.{x86,arm64}.json`, which rosetta imports, with
  `docs/deep-inspect.schema.json` and `rosetta-consumer.test.ts`; a design
  target lives in a separate `*.future.schema.json` that nothing emits yet.
- **Each document versions itself.** A `schemaVersion` per document,
  independent of every other document. Additive fields are compatible;
  removing or renaming a field, or changing what it means, bumps the
  version with a documented migration. A schema version is not a freshness
  timestamp.
- **An invalid contract fails the build**; a build never publishes data
  that does not match its schema.
- **Public data comes from an allowlist of fields.** No credentials, raw
  response dumps or private fields; a token may see private repositories,
  and its output must not show them.

## Time, failure and evidence

From tikoci.dev's dashboard and metadata contracts (`src/dashboard-schema.md`,
`/metadata/schema.md`):

- **Observed and attempted are separate times.** `observedAt` is when the
  data was last seen; `attemptedAt` is the latest try.
- **A failure keeps the last good evidence**, with its original time:
  `lastKnownGood: { observedAt, value }`, never advanced by later failures.
  The current state and error stay authoritative; the evidence is there to
  read, not to pass off as current.
- **Each signal has a state**: `ok` (answered, including known-empty),
  `partial` (truncated), `unknown` (unanswerable, no transport failure),
  `error` (the fetch failed, with the detail). A recent timestamp does not
  mean complete coverage.
- **Write down the interpretation pitfalls**: a full 100-item page is a
  lower bound; a tag existing does not prove a build passed.

## SQLite

For a store that is queried (search, joins, an MCP knowledge base); a
document small enough to review in a PR stays JSON or TSV (open
`sqlite-vs-json`). From rosetta `.github/instructions/`:

- **`bun:sqlite` only**, opened once per process, with WAL and foreign keys
  turned on where it is opened. An environment variable overrides the path.
- **FTS5 tables are kept by triggers** on their content tables; code never
  writes a `*_fts` table directly.
- **A schema change updates the DDL and the code that fills it**, together,
  and moves the schema version (`PRAGMA user_version` against the code's
  `SCHEMA_VERSION`).
- **Every build step reruns cleanly**: delete in foreign-key order (or drop
  and recreate), rebuild from the sources, and let the triggers rebuild the
  indexes. No hand-edited incremental state and no local repair scripts.
- **A released database carries its provenance**: CI stamps `release_tag`,
  `built_at`, `source_commit` and `schema_version` into a meta table, and
  every runtime surfaces them.
- **A local build is untrusted for claims about what shipped.** One pure
  function classifies a database (rosetta `classifyDbGrounding`: `ok`,
  `schema_mismatch`, `internal_inconsistent`, `unstamped`,
  `provenance_incomplete`, `tag_behind`), and the stats tool, the startup
  banner and a doctor command all use it. Grounding uses the latest
  release database.
- **Replace a live database atomically**, and stop its clients first:
  swapping a WAL database under an open reader can cause I/O errors.

## FTS as the retrieval layer

rosetta `DESIGN.md` "SQL-as-RAG Pattern":

- **For a corpus whose users and content share precise jargon**, SQLite
  FTS5 with BM25 ranking, served over MCP, is the practical middle between
  grep and a vector database: no embeddings, sub-millisecond queries.
  rosetta puts the line near 500K documents.
- **Pick the tokenizer per column**: `porter unicode61` for prose, plain
  `unicode61` for identifiers such as model numbers, which stemming mangles,
  with a `LIKE` substring fallback, since FTS matches whole tokens.
- **FTS for text, SQL `WHERE` for structured filters.** A search falls back
  from `AND` to `OR` before it returns nothing.
- **Serve the schema and a query guide** as MCP resources, so an agent
  writing raw SQL reads the DDL first.

## Static inventories

- **A site that browser tools read publishes a generated inventory** of
  its own files, so pages discover versions and files without the GitHub
  API, whose rate limit would otherwise leak into the page and into
  crawlers. restraml commits `docs/docs-index.json`, built by
  `scripts/build-docs-index.mjs` in every workflow that publishes files;
  tikoci.dev commits its snapshots and reads siblings' Pages files
  directly.
- **Infer capability from the files that exist**, not from a hard-coded
  version threshold.
- **Derive the fetch origin from where the shared script loaded**, never a
  hard-coded Pages host: `tikoci.github.io/<repo>/` redirects to
  `tikoci.dev/<repo>/` without a CORS header, so a cross-origin fetch of
  the old host fails.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
