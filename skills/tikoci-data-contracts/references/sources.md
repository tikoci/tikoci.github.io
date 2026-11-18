# Sources

The rules in [tikoci-data-contracts](../SKILL.md) come from the November
2026 survey of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
The skill was planned as `tikoci-structure`, then `tikoci-data`, and was
renamed and narrowed on 2026-11-17. Repo files were read at rosetta a51b201,
restraml 0e476ce and centrs 80a6f9f. The centrs and rosetta agents
reviewed #38; rules they added name them below.

| Rule | Rows | Notes |
| --- | --- | --- |
| Contract first, reviewed on real data | - | tikoci.github.io `AGENTS.md` ("Data first") and `docs/add-dataset.md`. |
| A contract says what is flexible | - | Maintainer, 2026-11-17. tikoci.github.io `data/metadata/schema.md` ("Consumers must ignore unknown fields"); restraml `docs/deep-inspect.future.schema.json` (a design target nothing emits). |
| What a release build keeps | - | rosetta review of #38. rosetta `command-versions-vs-presence.instructions.md`. |
| Cross-repo output: strict schema plus consumer-side tests | restraml-24 | restraml `CLAUDE.md` "Downstream consumer contract" (`docs/deep-inspect.schema.json`, `rosetta-consumer.test.ts`, `docs/deep-inspect.md` "Downstream consumers"). |
| The consumer pins the producer version in one file, gates on drift | - | centrs review of #38. centrs `scripts/restraml-trees.ts`; census `--check` scripts in `lint:ci` (`package.json`). |
| Per-document schema version; not a freshness time | - | tikoci.github.io `AGENTS.md` "Data contracts and deployment"; `data/metadata/schema.md` (additive compatible, a bump for removals or new meanings). |
| An invalid contract fails the build | - | tikoci.github.io `AGENTS.md` ("invalid contracts fail"); `build.ts` validates snapshots first. |
| Public data from an allowlist | - | tikoci.github.io `docs/add-dataset.md`. |
| Observed vs attempted; last-good evidence; signal states; pitfalls | - | tikoci.github.io `src/dashboard-schema.md` ("Signal states", "Interpretation pitfalls") and `data/metadata/schema.md`. |
| A run that checked nothing is `unknown` | - | centrs review of #38. centrs `ci-test-tiers-and-release-versioning.instructions.md` (the nightly sweep and its fingerprint). |
| SQLite for queried stores; generated TSV, JSON or TSV, JSONL | user-14 | Open `sqlite-vs-json`: the user-level note prefers SQLite over large JSON, while tikoci.github.io publishes JSON snapshots. The lean grew in the centrs and rosetta reviews of #38: rosetta `cli-reference-links.tsv` (`V-cliref-link-drift` in `VALIDATION.md`) and `rosetta export` (MANUAL.md); centrs `scripts/qa-history.ts` (`qa-runs.jsonl`). |
| `bun:sqlite`, WAL, foreign keys, path override; open on first use | rosetta-30 | rosetta `database.instructions.md`; `bun:sqlite` is also in tikoci-toolchain. Open on first use: rosetta review of #38, rosetta `extractor-import-side-effects.instructions.md`. |
| Read-only databases ship in rollback-journal mode | - | rosetta `src/db.ts` (`DB_READONLY`, `initDb()` skips WAL), `convertToRollbackJournal` in `src/db-lifecycle.ts`, called from `src/setup.ts` at install; the release asset itself is still WAL (rosetta review of #38). rosetta's `database.instructions.md` still says WAL for every database; the code is newer (Codex review of #38). The read-only open was measured for #38: under Bun 1.4.4 (SQLite 3.53.4) on Linux it creates `-wal` and `-shm` and fails with `SQLITE_READONLY_DIRECTORY` in a read-only directory; rosetta's CHANGELOG records the macOS failure. |
| Locks prove a file unused, not file times | - | rosetta `src/db-lifecycle.ts`, `DESIGN.md` "Managed generation lifecycle" (#151, #165). |
| A file with more than one writer: lock and revision check | - | centrs review of #38. centrs `src/data/winbox-cdb-lock.ts` (#581). |
| FTS external content kept by triggers; `'rebuild'`; content check | rosetta-30 | rosetta `database.instructions.md` ("FTS5 Triggers"), the triggers in `src/db.ts`, the `'rebuild'` calls in `src/extract-docusaurus.ts` and `src/extract-html.ts` (rosetta review of #38). The `'integrity-check'` rank-1 behavior was measured for #38 ([SQLite FTS5](https://sqlite.org/fts5.html), "The 'integrity-check' Command"). |
| Rebuilds rerun | rosetta-35 | rosetta `extractor-idempotent.instructions.md`. |
| Count what was stored; constraints match a real identity | - | rosetta review of #38. rosetta #90; `V-extractor-no-silent-drops` in `VALIDATION.md`. |
| Schema change: DDL and code together; exact match for one's own release; round-trip compatibility | rosetta-30 | rosetta `database.instructions.md` ("Schema Changes"); `schema-roundtrip-compat.instructions.md` (rosetta review of #38). |
| Provenance stamps, schema version stamped twice | rosetta-32 | rosetta `db-meta-stamping.instructions.md` and `scripts/stamp-db-meta.ts`; `local-db-grounding.instructions.md` (`internal_inconsistent`, the #94 "Frankenstein"). |
| Local builds untrusted; one classifier; never swap an open database | - | rosetta `local-db-grounding.instructions.md` (`classifyDbGrounding`, `db-sync`, the WAL note); `src/db-lifecycle.ts` header (`SQLITE_IOERR_VNODE`). |
| FTS5 BM25 over MCP; tokenizers per table; LIKE fallback; AND then OR | user-118 | rosetta `DESIGN.md` "SQL-as-RAG Pattern" and "FTS5 for text, SQL WHERE for structured queries"; `pages_fts` and `devices_fts` in `src/db.ts`; `searchPages` in `src/query.ts`. FTS5 sets `tokenize` per table ([SQLite FTS5](https://sqlite.org/fts5.html)). |
| Serve the schema and a query guide as resources | - | rosetta `src/mcp.ts` resources (the DDL resource: "Read this before constructing raw SQL queries"). |
| Static inventory; capability from files; derived origin | restraml-21 | restraml `CLAUDE.md` "Published docs inventory"; tikoci.github.io `fetchGitHubPagesFile` in `src/shared.js`. Moved here from the deferred `tikoci-web`. |

Moved out: never hand-edit generated output (centrs-11) is in
tikoci-docs; the examples file as an executable spec (centrs-27) and the
TUI as an audit surface (user-120) are in
[tikoci-cli-mcp](https://tikoci.dev/house/skills/tikoci-cli-mcp/SKILL.md).
