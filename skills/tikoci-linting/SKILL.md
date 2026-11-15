---
name: tikoci-linting
description: "tikoci linting: Biome lint with the formatter off, tsc --noEmit (tsc wins a conflict), markdownlint-cli2, cspell with project-words.txt (a # comment for non-obvious words; fix typos, never add them), actionlint and zizmor on workflows, shellcheck -s sh, hadolint on Dockerfiles. One package script is the lint gate CI runs; pre-commit is near instant, pre-push runs the lint gate, nothing is hook-only. Use when adding or configuring a linter, git hook or dictionary word."
---

# Linting

Which linters tikoci repos run, how they are configured, and where each one
runs. The toolchain they run on is in `tikoci-toolchain`; how CI wires the
gate is in `tikoci-ci`.

## The set

| Checks | Tool | Where it applies |
| --- | --- | --- |
| TypeScript and JavaScript lint | Biome 2.x, lint only | every repo with code |
| Types | `tsc --noEmit` | every TypeScript repo |
| Markdown structure | markdownlint-cli2 | every repo |
| Spelling | cspell | every repo |
| Workflow YAML | actionlint | every repo with workflows |
| Workflow security | zizmor | every repo with workflows |
| Shell scripts | `shellcheck -s sh` | repos with shell scripts or examples |
| Dockerfiles | hadolint | repos with Dockerfiles |
| Skills and descriptions | a SKILL.md check with a description budget | repos with skills |

No Prettier, ESLint or second linter for what Biome covers. A rule a linter
can check belongs in the linter's config, not in an instruction file.

## Where each runs

- **One package script is the gate** (`bun run check`, or `lint` plus `check`)
  and CI runs exactly that script. A linter that runs only in CI, or only
  locally, is a surprise waiting to happen.
- **While editing, run the narrowest check** (`bunx biome lint <file>`, one
  cspell file), then the full gate before calling the work done.
- **Pre-commit is near instant**: Biome only, deterministic.
- **Pre-push runs the lint gate**, about 30 seconds on a development machine.
  Tests and the build stay in CI (or an opt-in local aggregate script).
- **Nothing is hook-only.** Hooks live in the repo (`.githooks/`, enabled with
  `git config core.hooksPath .githooks`) and call package scripts, so CI
  reproduces every hook.
- **Editors read the same config files** as the CLI: no `cSpell.words` or
  Biome rules in `.vscode/settings.json`.
- **Output stays short**, so an agent can read the failure without losing its
  context.

## Biome and tsc

- **Formatter off** (`"formatter": { "enabled": false }`). Biome lint plus
  `tsc --noEmit` are the gate; formatting-only diffs cost review tokens and
  bury the change. A repo that turns the formatter on records it under
  `## House exceptions`.
- **Zero errors on a clean checkout.** Overrides only for legacy code; a new
  suppression carries a comment saying why.
- **tsc wins a conflict.** Example: Biome's `complexity/useLiteralKeys`
  conflicts with tsconfig's `noPropertyAccessFromIndexSignature`, which
  requires bracket access on index signatures; turn the Biome rule off rather
  than drop the type check.
- **`biome.json` is plain JSON**, so the reason for each non-default rule goes
  in the repo's docs or AGENTS.md, not in the file.
- **Keep Biome's `$schema` version, the package.json version and `bun.lock` in
  step**; a schema mismatch message usually means a local binary drifted from
  the lockfile.

## Markdown

- **Rules go in `.markdownlint.yaml`**, each non-default rule with a comment
  saying why; globs and ignores go in `.markdownlint-cli2.yaml`. No
  `.markdownlintignore`.
- **Tag every fenced code block** with a language (`text`, `sh`, `typescript`,
  `json`, `yaml`, `routeros`).
- **Lint AGENTS.md and the repo's own skills**: they are the instructions
  agents read, and broken structure there misleads. Ignore `CLAUDE.md` (one
  import line), house skills copied unchanged into `.agents/skills/` (linted at
  the source, and a fix would break the copy), generated docs, fixtures, and
  `.github/instructions/` until the repo retires it.
- **Fix malformed Markdown** before teaching cspell the broken token it
  produced.

## Spelling

- **The dictionary is `project-words.txt`**, referenced from `cspell.json`
  with `addWords: true` so the editor's "Add to dictionary" writes there.
- **Real vocabulary only**: RouterOS, networking, QEMU and tikoci terms. **A
  typo is fixed in the source, never added.**
- **Comment a word that is not obvious** with a `#` line above it: what it is,
  and for a repo, tool or product name, where it lives (a URL), so the
  dictionary doubles as a cross-reference. Not every word needs one.
- **Non-vocabulary goes in `ignoreWords`** in `cspell.json`: locale variants,
  documentation placeholders, test sentinels.
- **A word used in one file only** gets an inline `cspell:ignore` comment in
  that file, not a dictionary entry.
- cspell dictionary syntax (`~word`, `+word`, `!word`) is fine where it saves
  entries.
- `ignorePaths` covers generated and vendored output; never ignore a real
  source file to hide one word.

## Workflows, shell and containers

- **actionlint** checks workflow YAML and gates.
- **zizmor** audits workflow security (`uvx zizmor --offline .` locally). Run
  it and report its findings, through code scanning or the job log; gate on it
  once the existing findings are triaged, as quickchr and centrs are doing.
- **shellcheck -s sh --severity=warning** on every POSIX shell script and
  example. A script that needs Bash (arrays, say) is an exception: it says why
  in a comment and is checked with `shellcheck -s bash --severity=warning`.
  A local run may skip when shellcheck is missing and say so; CI installs it.
- **hadolint** on Dockerfiles, where a repo has them.

## Skill descriptions

A repo that copies many skills into `.agents/skills/` checks the total size of
their descriptions, because harnesses list every description up front and
may truncate the listing. This repo's
[`scripts/check-skills.ts`](https://github.com/tikoci/tikoci.github.io/blob/main/scripts/check-skills.ts)
does it for house skills (8000 characters, printed per skill). The budget is
a trigger for a cleanup pass (move detail to `references/`), not a reason to
leave a rule out.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
