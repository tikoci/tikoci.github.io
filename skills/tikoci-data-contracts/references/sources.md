# Sources

The rules in [tikoci-data-contracts](../SKILL.md) come from the November
2026 survey of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
The skill was planned as `tikoci-structure`, then `tikoci-data`, and was
renamed and narrowed on 2026-11-17. Repo files were read at rosetta a51b201
and restraml 0e476ce.

| Rule | Rows | Notes |
| --- | --- | --- |
| Contract first, reviewed on real data | - | tikoci.github.io `AGENTS.md` ("Data first") and `docs/add-dataset.md`. |
| A contract says what is flexible | - | Maintainer, 2026-11-17. tikoci.github.io `data/metadata/schema.md` ("Consumers must ignore unknown fields"); restraml `docs/deep-inspect.future.schema.json` (a design target nothing emits). |
| Cross-repo output: strict schema plus consumer-side tests | restraml-24 | restraml `CLAUDE.md` "Downstream consumer contract" (`docs/deep-inspect.schema.json`, `rosetta-consumer.test.ts`, `docs/deep-inspect.md` "Downstream consumers"). |
| Per-document schema version; not a freshness time | - | tikoci.github.io `AGENTS.md` "Data contracts and deployment"; `data/metadata/schema.md` (additive compatible, a bump for removals or new meanings). |
| An invalid contract fails the build | - | tikoci.github.io `AGENTS.md` ("invalid contracts fail"); `build.ts` validates snapshots first. |
| Public data from an allowlist | - | tikoci.github.io `docs/add-dataset.md`. |
| Observed vs attempted; last-good evidence; signal states; pitfalls | - | tikoci.github.io `src/dashboard-schema.md` ("Signal states", "Interpretation pitfalls") and `data/metadata/schema.md`. |
| SQLite for queried stores, JSON or TSV for reviewed documents | user-14 | Open `sqlite-vs-json`: the user-level note prefers SQLite over large JSON, while tikoci.github.io publishes JSON snapshots. |
| `bun:sqlite`, WAL, foreign keys, one connection, path override | rosetta-30 | rosetta `database.instructions.md`; `bun:sqlite` is also in tikoci-toolchain. |
| Released databases read-only, rollback journal, owner connections | - | rosetta `src/db.ts` (`DB_READONLY`, `initDb()` skips WAL) and `src/db-lifecycle.ts` (#151). rosetta's `database.instructions.md` still says WAL for every database; the code is newer (Codex review of #38). |
| FTS kept by triggers; schema change updates the DDL and the code that fills it | rosetta-30 | rosetta `database.instructions.md` ("FTS5 Triggers", "Schema Changes"). |
| Rebuilds rerun | rosetta-35 | rosetta `extractor-idempotent.instructions.md`. |
| Provenance stamps | rosetta-32 | rosetta `db-meta-stamping.instructions.md` and `scripts/stamp-db-meta.ts`. |
| Local builds untrusted; one classifier; never swap an open database | - | rosetta `local-db-grounding.instructions.md` (`classifyDbGrounding`, `db-sync`, the WAL note); `src/db-lifecycle.ts` header (`SQLITE_IOERR_VNODE`). |
| FTS5 BM25 over MCP; tokenizers per table; LIKE fallback; AND then OR | user-118 | rosetta `DESIGN.md` "SQL-as-RAG Pattern" and "FTS5 for text, SQL WHERE for structured queries"; `pages_fts` and `devices_fts` in `src/db.ts`; `searchPages` in `src/query.ts`. FTS5 sets `tokenize` per table ([SQLite FTS5](https://sqlite.org/fts5.html)). |
| Serve the schema and a query guide as resources | - | rosetta `src/mcp.ts` resources (the DDL resource: "Read this before constructing raw SQL queries"). |
| Static inventory; capability from files; derived origin | restraml-21 | restraml `CLAUDE.md` "Published docs inventory"; tikoci.github.io `fetchGitHubPagesFile` in `src/shared.js`. Moved here from the deferred `tikoci-web`. |

Moved out: never hand-edit generated output (centrs-11) is in
tikoci-docs; the examples file as an executable spec (centrs-27) and the
TUI as an audit surface (user-120) are in
[tikoci-cli-mcp](https://tikoci.dev/house/skills/tikoci-cli-mcp/SKILL.md).
