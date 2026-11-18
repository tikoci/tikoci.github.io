---
name: tikoci-data-contracts
description: "tikoci data that code builds and others read (published JSON, a SQLite database in a release, inventories, committed snapshots): a reviewed contract before any consumer, saying what is flexible and what is not; cross-repo output pinned by a strict schema plus consumer-side tests; additive changes compatible, others bump a per-document schemaVersion, which is not a freshness time; failures keep last-good evidence with its original time. SQLite via bun:sqlite: WAL where written, releases in rollback-journal mode, FTS kept by triggers, stored counts checked, CI provenance a doctor checks; FTS5 BM25 as an MCP retrieval layer. Use when designing a dataset, schema, database, extractor or published file."
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
- **It also says what a release build keeps.** A table pruned or sampled
  in the shipped file says so, since a consumer cannot tell pruning from
  missing data: rosetta's `command_versions` keeps the full history, while
  `schema_node_presence` is pruned to channel heads
  (`command-versions-vs-presence.instructions.md`).
- **A cross-repo output is pinned by a strict JSON Schema plus tests
  written from the consumer's side**, and its shape changes only with both
  updated. A doc lists who reads what. restraml pins
  `deep-inspect.{x86,arm64}.json`, which rosetta imports, with
  `docs/deep-inspect.schema.json` and `rosetta-consumer.test.ts`; a design
  target lives in a separate `*.future.schema.json` that nothing emits yet.
- **A repo that bakes another repo's output pins the source version in
  one file**, regenerates from it, and fails CI when a regenerated file
  differs from the committed one. Moving the pin is a reviewed change that
  regenerates everything built from it: centrs builds its explain menus
  and catalog from restraml `/console/inspect` trees pinned in
  `scripts/restraml-trees.ts`, with census `--check` scripts in `lint:ci`.
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
  `partial` (incomplete: truncated, or some of its requests failed),
  `unknown` (unanswerable, no transport failure),
  `error` (the fetch failed, with the detail). A recent timestamp does not
  mean complete coverage.
- **A run that checked nothing is `unknown`, not `ok`**, however green it
  looks. centrs's nightly QA sweep skips when nothing changed and still
  ends `success`, so its readers inspect the jobs, not the conclusion, and
  it records its fingerprint only when every must-pass leg recorded a
  result (`ci-test-tiers-and-release-versioning.instructions.md`).
- **Write down the interpretation pitfalls**: a full 100-item page is a
  lower bound; a tag existing does not prove a build passed.

## SQLite

For a store that is queried (search, joins, an MCP knowledge base). The
open `sqlite-vs-json` row leans this way: SQLite for a queried store; a
sorted, generated TSV beside it for derived results a reviewer must see
change, with a drift check in CI (rosetta `cli-reference-links.tsv`);
JSON or TSV for a published document small enough to review in a PR;
JSONL for an append-only log kept in git (centrs `qa-runs.jsonl`). Each
rule is general; rosetta is the fullest example, and
[references/patterns.md](references/patterns.md) has the code.

- **`bun:sqlite`, opened on first use, not at import.** A store the tool
  writes is opened once per process, with WAL and foreign keys turned on
  where it is opened. An environment variable overrides the path and is
  set before anything imports the database module; tests use `:memory:` or
  a temp file, and scripts with side effects run only under
  `import.meta.main`. rosetta's module-scope connection is its known
  coupling, not a model (`extractor-import-side-effects.instructions.md`).
- **A database others only read ships in rollback-journal mode.** Even a
  read-only open of a WAL file creates `-wal` and `-shm` files beside it,
  and fails where it cannot (`SQLITE_READONLY_DIRECTORY` on Linux; rosetta
  hit a shared-memory failure on macOS). Run `PRAGMA journal_mode=DELETE`
  before upload. A consumer that installs a WAL file converts a private
  temp copy, probes it, then renames it into place, which is what rosetta
  does today (`src/setup.ts`, `convertToRollbackJournal`).
- **Prove a file is unused with SQLite's own locks, never with file
  times.** Each reader holds a read transaction for its lifetime, and a
  cleanup deletes a file only while it holds `BEGIN EXCLUSIVE`, which no
  live reader allows. rosetta keeps one database per version this way
  (`src/db-lifecycle.ts`, #151), after an age rule deleted a file under a
  running client (#165).
- **Never delete or swap a database a client has open**: on macOS it fails
  in every journal mode (`SQLITE_IOERR_VNODE`). Stop the clients first, or
  write a new file beside it.
- **A file with more than one writer, SQLite or not, needs a lock and a
  revision check**: lock, re-read, compare the revision you loaded, then
  replace. An atomic rename stops a half-written file, not a lost update
  (centrs `src/data/winbox-cdb-lock.ts` for WinBox's CDB, #581).
- **FTS5 is an external-content index kept in sync by triggers**: the FTS
  table names its content table, and AFTER INSERT, DELETE and UPDATE
  triggers keep it current, removing an old row with the `'delete'`
  command and the old values. Code never inserts, updates or deletes FTS
  rows itself; FTS5 commands are fine (`'rebuild'` after a bulk load).
  New values passed to `'delete'`, or a plain `DELETE` on the FTS table,
  leave the index wrong without an error. `'integrity-check'` with rank 1
  compares the index with its content and catches it; a doctor runs that
  form.
- **Every build step reruns cleanly**: delete in foreign-key order (or
  drop and recreate), rebuild from the sources, then one `'rebuild'` per
  FTS table. No hand-edited incremental state and no local repair scripts.
- **An extractor checks what landed**: it reads row counts back and fails
  on any gap between parsed and stored, and never closes the gap by
  lowering the parsed count. A constraint encodes an identity the source
  really has; `INSERT OR IGNORE` on a guessed key dropped 165 rows from
  every rosetta build (#90, `V-extractor-no-silent-drops`), so each
  `OR IGNORE` or `OR REPLACE` says why duplicates are safe to drop.
- **A schema change updates the DDL and the code that fills it**, together,
  and moves the schema version (`PRAGMA user_version` against the code's
  `SCHEMA_VERSION`). A database that only its own release reads is an
  exact-match gate, unlike a cross-repo document: a mismatch means a new
  file, never a stamp over old content. When a richer table becomes the
  source of truth, regenerate the old tables from it so existing readers
  keep working, pinned by a round-trip test
  (`schema-roundtrip-compat.instructions.md`).
- **A released database carries its provenance**: CI stamps `release_tag`,
  `built_at`, `source_commit` and `schema_version` into a meta table, and
  every runtime surfaces them. The schema version lives in both places, so
  a version bumped in place over a stale corpus shows as a disagreement
  (rosetta's #94 "Frankenstein").
- **A local build is untrusted for claims about what shipped.** One pure
  function classifies a database (rosetta `classifyDbGrounding`: `ok`,
  `schema_mismatch`, `internal_inconsistent`, `unstamped`,
  `provenance_incomplete`, `tag_behind`), and the stats tool, the startup
  banner and a doctor command all use it. Grounding uses the latest
  release database.

## FTS as the retrieval layer

rosetta `DESIGN.md` "SQL-as-RAG Pattern":

- **For a corpus whose users and content share precise jargon**, SQLite
  FTS5 with BM25 ranking, served over MCP, is the practical middle between
  grep and a vector database: no embeddings, sub-millisecond queries.
  rosetta puts the line near 500K documents.
- **Pick the tokenizer per FTS table**, since FTS5 sets it for the whole
  table: `porter unicode61` for prose (rosetta `pages_fts`), plain
  `unicode61` in a separate table for identifiers such as model numbers,
  which stemming mangles (`devices_fts`), with a `LIKE` substring fallback,
  since FTS matches whole tokens.
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

## Patterns and sources

[references/patterns.md](references/patterns.md) has copyable code: an
FTS5 index with its triggers, a parsed-versus-stored check, installing a
database for read-only clients, and a provenance stamp with its
classifier. [references/sources.md](references/sources.md) lists the
survey rows and repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
