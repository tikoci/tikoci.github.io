# Sources

The rules in [tikoci-docs](../SKILL.md) come from the November 2026 survey
of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
The skill merges the planned `tikoci-repo-files` and `tikoci-work-tracking`
(regroup of 2026-11-16).

| Rule | Rows | Notes |
| --- | --- | --- |
| One home per kind; others link to it | rosetta-05, rosetta-56, quickchr-010 | rosetta `CLAUDE.md` "Project Documentation" and `where-does-this-go.instructions.md`; quickchr `CONTRIBUTING.md` "Tracking work" ("do not mirror an open issue inside a doc"). |
| A repo with its own file set lists each file's job | rosetta-05 | rosetta (MANUAL.md, VALIDATION.md, briefings/), centrs (docs/CONSTITUTION.md, docs/MATRIX.md). Top-level files per repo were listed on 2026-11-17. |
| MANUAL.md; agent rules in AGENTS.md or a skill | rosetta-05 | quickchr and rosetta both keep MANUAL.md; quickchr `CONTRIBUTING.md` routes grounded facts to the narrowest scoped instructions file (quickchr review of #37). |
| Docs that ship in the package | - | centrs `package.json` `files` lists `commands/`, `docs/CONSTITUTION.md`, `docs/MATRIX.md`, `docs/errors/` and `docs/tips/` (centrs review of #37). |
| How a repo tracks work is its own business; BACKLOG.md | restraml-42 | Settled `backlog-file`. |
| An issue has an end point | centrs-04, quickchr-011 | centrs `AGENTS.md` "Where work is tracked" (actionable only, `moved-to-docs`); quickchr's Done-when. Labels and templates are each repo's choice. rosetta's `pick-next-task` and `promote-idea` (rosetta-57, rosetta-59) stay repo skills. |
| Outside issues in any shape; a closed `moved-to-docs` issue is history | centrs-04 | centrs `AGENTS.md` "Where work is tracked" (consumer issues; "do not reopen one to resume work"); centrs review of #37. |
| One small-items home named in AGENTS.md, in one of several shapes | centrs-04, quickchr-010 | Settled `backlog-file`. quickchr `BACKLOG.md` is "a map, not a work log" (quickchr review of #37); centrs keeps Nits in docs/MATRIX.md (centrs review); app-t3code keeps a pinned Roadmap issue, #30 (app-t3code review). |
| Nothing undone stays in chat | rosetta-25 | rosetta `capture-undone-work.instructions.md`: "a new agent should still be able to discover the issue from the repo files or the issue tracker alone." Sent to an issue or the small-items home, not DESIGN.md: centrs review of #37. |
| Friction is a finding | quickchr-048 | quickchr `examples.instructions.md`. The pinned collector for another tool's friction: app-t3code #29 (app-t3code review of #37). |
| DESIGN.md decision log | mikropkl-06 | Settles `decision-log-home`. mikropkl keeps its "Decision Log" in AGENTS.md (the x86_64-on-ARM64 TCG entry: "Over 16 CI iterations"); tikoci-house keeps AGENTS.md short, and quickchr and rosetta use DESIGN.md. |
| AGENTS.md carries a one-line guard per rejected approach | - | app-t3code `AGENTS.md` "Gotchas" (tini, linking `docs/research/2026-11-routeros-sigterm/`); app-t3code review of #37. |
| A fact the code relies on lives at that code, pinned by a test | - | centrs `src/protocols/btest.ts` header, "Pinned to captured/derived vectors in `test/unit/btest.test.ts`"; centrs review of #37. |
| Committed research: topic folders and write-once dated notes; an index or names that serve as one | mikropkl-10, mikropkl-14 | mikropkl `Lab/` and its "Lab Experiments Index"; quickchr `test/lab/`; rosetta `briefings/`; app-t3code `docs/research/<YYYY-MM>-<topic>/` and `docs/notes/<YYYY-MM-DD>-<topic>.md`, with frozen probes (app-t3code review of #37). |
| Generate references; drift check; never hand-edit | centrs-30, user-42, centrs-11 | centrs `generated-docs.instructions.md`; `docs:cli` and `docs:cli:check` in its `lint:ci`. The generator-owned markers are a user-level note (user-42); tikoci.github.io fills homepage sections into a placeholder in `src/index.html`. A snapshot inside a link: app-t3code README's `/app` YAML editor link and `test/freshness.test.ts`. "Never hand-edit generated output" stays for whole generated files (centrs review of #37); centrs-11 moved here from the data skill in 3f. |
| Structured over prose: TSV, TOML, JSON, JSONL; checks read the file; no conversion for uniformity | - | Maintainer, 2026-11-17 (3f scope review). JSONL from the centrs review of #38 (centrs `scripts/qa-history.ts`; quickchr `boot-log.ndjson` in `src/lib/state.ts`). tikoci.github.io `docs/add-dataset.md` (TOML and TSV for new files, no conversion) and `docs/house/*.tsv`; tikoci-home `references/layout.tsv` and `references/conformance.json`. |
| A CLI change updates its docs and examples | centrs-46 | centrs `readme-cli-manual.instructions.md`. |
| README is short; outside tools per OS | centrs-46, centrs-47 | centrs `readme-dependencies.instructions.md`. |
| Descriptive kebab-case names | centrs-23, rosetta-33 | Both `descriptive-prose-file-names.instructions.md`. lsp-routeros-ts `docs/` has image names with spaces. |
| Published paths and anchors stay | restraml-10, mikropkl-26 | restraml `AGENTS.md` "/app YAML Schema Files" ("Do not rename"); mikropkl `CLAUDE.md` (the preserved `#hvf-on-apple-m4-and-later` anchor); tikoci.github.io `AGENTS.md`. |
| URLs printed by shipped code; print the final URL | - | centrs `src/errors.ts` (`ERROR_DETAILS_BASE_URL`), centrs #464 (the HTTPS redirect); centrs review of #37. |
| `/app` YAML, app-store document and image tag are contracts | - | app-t3code review of #37. |
| Editor files name live commands | centrs-52 | centrs `vscode-files.instructions.md`. |
| Screenshots in the repo, with their source | user-114, user-115, user-117 | A user-level screenshot skill (absorbed: `screenshot`). quickchr `docs/tapes/*.tape` (VHS) and `docs/images/*.gif`; lsp-routeros-ts README embeds GIFs and a screenshot from outside hosts. |
