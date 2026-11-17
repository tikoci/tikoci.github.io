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
| How a repo tracks work is its own business; BACKLOG.md | restraml-42 | Settled `backlog-file`. |
| An issue has an end point | centrs-04, quickchr-011 | centrs `AGENTS.md` "Where work is tracked" (actionable only, `moved-to-docs`); quickchr's Done-when. Labels and templates are each repo's choice. rosetta's `pick-next-task` and `promote-idea` (rosetta-57, rosetta-59) stay repo skills. |
| Small items in BACKLOG.md, deleted when done | centrs-04 | centrs keeps its nits in docs/MATRIX.md: the same rule in another file. |
| Nothing undone stays in chat | rosetta-25 | rosetta `capture-undone-work.instructions.md`: "a new agent should still be able to discover the issue from the repo files or the issue tracker alone." |
| Friction is a finding | quickchr-048 | quickchr `examples.instructions.md`. |
| DESIGN.md decision log | mikropkl-06 | Settles `decision-log-home`. mikropkl keeps its "Decision Log" in AGENTS.md (the x86_64-on-ARM64 TCG entry: "Over 16 CI iterations"); tikoci-house keeps AGENTS.md short, and quickchr and rosetta use DESIGN.md. |
| Committed research directory with an index | mikropkl-10, mikropkl-14 | mikropkl `Lab/` and its "Lab Experiments Index"; quickchr `test/lab/`; rosetta `briefings/`. |
| Generate references; drift check | centrs-30, user-42 | centrs `generated-docs.instructions.md`; `docs:cli` and `docs:cli:check` in its `lint:ci`. The generator-owned markers are a user-level note (user-42); tikoci.github.io fills homepage sections into a placeholder in `src/index.html`. |
| A CLI change updates its docs and examples | centrs-46 | centrs `readme-cli-manual.instructions.md`. |
| README is short; outside tools per OS | centrs-46, centrs-47 | centrs `readme-dependencies.instructions.md`. |
| Descriptive kebab-case names | centrs-23, rosetta-33 | Both `descriptive-prose-file-names.instructions.md`. lsp-routeros-ts `docs/` has image names with spaces. |
| Published paths and anchors stay | restraml-10, mikropkl-26 | restraml `AGENTS.md` "/app YAML Schema Files" ("Do not rename"); mikropkl `CLAUDE.md` (the preserved `#hvf-on-apple-m4-and-later` anchor); tikoci.github.io `AGENTS.md`. |
| Editor files name live commands | centrs-52 | centrs `vscode-files.instructions.md`. |
| Screenshots in the repo, with their source | user-114, user-115, user-117 | A user-level screenshot skill (absorbed: `screenshot`). quickchr `docs/tapes/*.tape` (VHS) and `docs/images/*.gif`; lsp-routeros-ts README embeds GIFs and a screenshot from outside hosts. |
