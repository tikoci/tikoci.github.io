# Sources

The rules in [tikoci-linting](../SKILL.md) come from the November 2026 survey
of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Rows | Notes |
| --- | --- | --- |
| The linter set | quickchr-019, quickchr-049, rskills-03, restraml-17, centrs-39 | centrs `lint:ci` adds secretlint, which a repo may keep. |
| No Prettier or second linter | restraml-06, user-22 | |
| One gate script that CI runs | quickchr-019, rskills-03 | |
| Narrowest check while editing; short output | centrs-39 | centrs `.github/instructions/linting.instructions.md`. |
| Pre-commit near instant; pre-push = lint gate; nothing hook-only | centrs-31 | centrs `.githooks/` and `git-hooks.instructions.md`. |
| Editors read the CLI config | quickchr-042 | quickchr removed `cSpell.words` from `.vscode/settings.json`. |
| Biome formatter off | site-07, quickchr-021, restraml-06, user-22 | Settles `biome-formatter`; centrs has it on. |
| Zero errors; justified suppressions | restraml-43 | |
| tsc wins; rationale outside `biome.json`; versions in step | centrs-40 | |
| `.markdownlint.yaml` with why-comments; no `.markdownlintignore` | user-108 | rosetta still has a `.markdownlintignore`. |
| Tag fenced code blocks | user-111 | |
| Lint AGENTS.md and own skills; ignore CLAUDE.md and copied house skills | user-109 | Settles `lint-agent-files`: centrs, quickchr, rosetta and routeros-skills ignore AGENTS.md today; this repo lints it and its skills. |
| `project-words.txt`; comments for non-obvious words; inline comments for one-file words | centrs-22, rskills-04, quickchr-042 | Settles `cspell-dictionary-name`; the comment style comes from centrs `GLOSSARY.txt`. |
| Fix typos and malformed Markdown, never add them | rskills-04, quickchr-042, centrs-22 | |
| `ignoreWords` for non-vocabulary | quickchr-042 | |
| actionlint | rskills-03, restraml-17 | |
| zizmor reported, gated after triage | quickchr-111 | quickchr #228; centrs runs it in `codeql.yaml` as alerts. |
| shellcheck `-s sh` | quickchr-046, quickchr-049 | quickchr `scripts/lint-shell.sh`. |
| hadolint | - | Planned in #21; no surveyed repo runs it yet. |
| Description budget for copied skills | - | Phase 1 notes in #21; `scripts/check-skills.ts` here. |
