# Sources

The rules in [tikoci-linting](../SKILL.md) come from the November 2026 survey
of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
"PR #26 review" is the maintainer's review of
[PR #26](https://github.com/tikoci/tikoci.github.io/pull/26) (2026-11-15),
which asked for starting configs, tight types and lenient Markdown.

| Rule | Rows | Notes |
| --- | --- | --- |
| The linter set | quickchr-019, quickchr-049, rskills-03, restraml-17, centrs-39 | centrs `lint:ci` adds secretlint, which a repo may keep. |
| Starting configs in `assets/`, named `*.example.*` | PR #26 review | Biome 2.6.8 refuses a nested root `biome.jsonc`, so a real name inside a copied skill breaks the consumer; `scripts/check-skills.ts` rejects discovered names. Each example was run on sample code with TypeScript 7.0.2, Biome 2.6.8, markdownlint-cli2 0.24.1 and cspell 10.5.1. |
| Suppressions: narrowest scope, rule and reason named | restraml-43, PR #26 review | Syntax from each tool's docs, linked in `references/suppressions.md`. |
| No Prettier or second linter | restraml-06, user-22 | |
| One gate script that CI runs | quickchr-019, rskills-03 | |
| Narrowest check while editing; short output | centrs-39 | centrs `.github/instructions/linting.instructions.md`. |
| Pre-commit near instant; pre-push = lint gate; nothing hook-only | centrs-31 | centrs `.githooks/` and `git-hooks.instructions.md`. |
| Editors read the CLI config | quickchr-042 | quickchr removed `cSpell.words` from `.vscode/settings.json`. |
| Biome formatter off; a new repo considers it on | site-07, quickchr-021, restraml-06, user-22 | Settles `biome-formatter`; centrs has it on from day one, and the centrs/quickchr review of PR #26 argued it prevents style drift between agents. |
| Findings you did not cause: one or two fixed in place, a batch split off | PR #26 review | A dozen lint fixes do not belong in a focused PR. |
| Tight tsconfig | quickchr-025, centrs-40, PR #26 review | Starts from `bun init` (Bun 1.4.4), which quickchr, centrs and routeros-muse already use, plus `exactOptionalPropertyTypes` and `noUncheckedSideEffectImports` from TypeScript 7's `tsc --init`. Measured with TypeScript 7: `exactOptionalPropertyTypes` costs 426 errors in centrs and 175 in quickchr (174 with TypeScript 5.9.3, 55 of them in quickchr's public `QuickCHR` options, so its adoption PR changes exported types); `erasableSyntaxOnly` 10 and 3; `noPropertyAccessFromIndexSignature` 778 in quickchr (centrs has it on). |
| `noExplicitAny` and `noNonNullAssertion` errors in shipped code, off in tests; warnings fail the gate | PR #26 review | Biome 2.6 reports both as warnings by default, and `biome lint` exits 0 on warnings without `--error-on-warnings`. |
| tsc wins; versions in step | centrs-40 | centrs and routeros-muse turn off `useLiteralKeys` for `noPropertyAccessFromIndexSignature`. |
| CSS and HTML linted with the same rules; `noDescendingSpecificity` off; `noImportantStyles` on | restraml-06, restraml-33 | Biome 2.6.8 with `biome.example.jsonc` on tikoci.github.io `src/` and restraml `docs/` (2026-11-17): 18 `noDescendingSpecificity` findings, each checked against the earlier selector it names. Every pair styles different components, or sets different properties, or lets a hover or highlight state win on purpose; none was a bug. This repo's `shared.css` already suppressed 3 more, each as a "different context". `noImportantStyles` found 8: 2 in restraml override third-party widgets (Scalar's integration buttons, Monaco's empty suggestion box), and 6 only win against the page's own rules (restraml `openapi.html` beating its own `#actions-group a:hover`, and 5 in this repo's project map). A CSS comment suppression works inside an HTML `<style>` block (tested). restraml turns off 13 rules for all of `docs/*.html` and does not lint its shared stylesheet, and this repo does not lint its HTML: neither is the house setting. |
| `useTemplate` off | restraml-06 | Maintainer, 2026-11-17: no rule that is pedantic without a quality purpose. Biome 2.6.8 `explain useTemplate`: group style, default severity info, fix unsafe; `--error-on-warnings` still exits 0 on it. It found 24 in this repo's HTML and 26 in restraml's (restraml already turns it off). Concatenation and a template literal print the same unescaped markup under Bun; the escaping in `chr-images.html` comes from `escapeHtml` either way. |
| `biome.jsonc` with reasons as comments | user-108, PR #26 review | Replaces "biome.json is plain JSON, reasons elsewhere". |
| Lenient Markdown: line length, HTML, alignment off | user-108, PR #26 review | centrs and quickchr already turn off MD013 and MD060 and allow GitHub's HTML. |
| One `.markdownlint-cli2.yaml` with `config:` and `ignores:`; no `.markdownlintignore` or root `.markdownlint.yaml` | user-108 | Fewer files, and editor and CLI agree. markdownlint-cli2 reads `.markdownlintignore` only when `gitignore:` names it, and a `.markdownlint.yaml` in the same directory overrides `config:` (its README, v0.24.1). To clean up on adoption: rosetta has both files and a `.markdownlintignore`; routeros-skills and this repo have both files (Phase 4 review and #41 reviews, 3h). |
| Tag fenced code blocks; `routeros` for RouterOS | user-111, PR #26 review | tikbook runs `routeros` blocks. |
| Human docs may use GitHub HTML and Mermaid | PR #26 review | |
| `.vscode/extensions.json` recommends the linters' extensions | PR #26 review | centrs, m2ir and rosetta recommend Biome, markdownlint, cspell and Bun extensions today; personal tools (agent harnesses) stay out. |
| Lint AGENTS.md and own skills; ignore CLAUDE.md and copied house skills | user-109 | Settles `lint-agent-files`: centrs, quickchr, rosetta and routeros-skills ignore AGENTS.md today; this repo lints it and its skills. |
| `project-words.txt`; inline `cspell:ignore` for one-file words | centrs-22, rskills-04, quickchr-042 | Settles `cspell-dictionary-name`. |
| Sorted words with notes on the same line | quickchr-042, PR #26 review | quickchr and rosetta already say "keep sorted". cspell 10.5 ignores text after `#` on a word line (tested). |
| Fix typos and malformed Markdown, never add them | rskills-04, quickchr-042, centrs-22 | |
| `ignoreWords` for non-vocabulary | quickchr-042 | |
| actionlint | rskills-03, restraml-17 | |
| zizmor reported, gated after triage | quickchr-111 | centrs runs it in `codeql.yaml` as alerts. quickchr does not run zizmor or actionlint yet; #228 (triage before gating) is open. |
| PSScriptAnalyzer for PowerShell examples | - | quickchr `lint-powershell.yml`, from the centrs and quickchr review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26#issuecomment-6901659551). |
| Generated files have a `--check` mode in the gate | - | centrs `lint:ci` (`docs:cli:check`, census README `--check`), from the centrs and quickchr review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26#issuecomment-6901659551). |
| Secret scanning with push protection; secretlint optional | - | centrs `SECURITY.md` and `lint:ci`; the setting is `tikoci-github`'s. |
| cspell on Markdown and shipped source | - | centrs runs cspell over the whole tree, from the centrs and quickchr review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26#issuecomment-6901659551). |
| shellcheck `-s sh`; clever logic moves to a Bun script | quickchr-046, quickchr-049, PR #26 review | quickchr `scripts/lint-shell.sh`. |
| hadolint | - | Planned in #21; no surveyed repo runs it yet. |
| Description budget for copied skills | - | Phase 1 notes in #21; `scripts/check-skills.ts` here. |
| The gate can fail | - | tikoci.github.io #31 (MD052 silently off with two `micromark-core-commonmark` copies) and `test/lint-tools.test.js`; the #21 handoff's rule to feed check commands an input that should fail (3b). |
| zizmor ignore syntax; `bun audit` ignores | - | tikoci.github.io #29: an ignore appended to the pin comment without its own `#` was not honored. The #33 review (Codex, zizmor 1.32.0) showed both the `uses:` and `- name:` lines work with `# zizmor:`; [zizmor docs](https://docs.zizmor.sh/usage/#with-comments). #31: the KaTeX reason corrected in review. |
