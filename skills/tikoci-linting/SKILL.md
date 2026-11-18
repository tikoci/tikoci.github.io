---
name: tikoci-linting
description: "tikoci linting, with starting configs in assets/: tight types (strict tsc, noUncheckedIndexedAccess, exactOptionalPropertyTypes, erasable syntax only), Biome lint on code, CSS and HTML with the formatter off and warnings failing the gate (noDescendingSpecificity off), lenient markdownlint (no line length; GitHub HTML welcome; fences name a language), cspell with a sorted project-words.txt, actionlint, zizmor, shellcheck -s sh, hadolint. One lint gate CI runs; a finding you meet is fixed, not left; every suppression names the rule and the reason. Use when adding or configuring a linter, git hook, suppression or dictionary word."
---

# Linting

Which linters tikoci repos run, how they are configured, and where each one
runs. The toolchain they run on is in `tikoci-toolchain`; how CI wires the
gate is in [tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md).

## The set

| Checks | Tool | Starting config |
| --- | --- | --- |
| Types | `tsc --noEmit` | [tsconfig.example.json](assets/tsconfig.example.json) |
| TypeScript, JavaScript, CSS and HTML lint | Biome 2.x, lint only | [biome.example.jsonc](assets/biome.example.jsonc) |
| Markdown structure | markdownlint-cli2 | [markdownlint-cli2.example.yaml](assets/markdownlint-cli2.example.yaml) |
| Spelling | cspell | [cspell.example.json](assets/cspell.example.json), [project-words.example.txt](assets/project-words.example.txt) |
| Workflow YAML | actionlint | none needed |
| Workflow security | zizmor | none needed |
| Shell scripts | `shellcheck -s sh` | none needed |
| PowerShell examples | PSScriptAnalyzer | none needed |
| Dockerfiles | hadolint | none needed |
| Skills and descriptions | a SKILL.md check with a description budget | this repo's script |
| Editor extensions | VS Code | [vscode-extensions.example.json](assets/vscode-extensions.example.json) |

The example files are named `*.example.*` so that no tool picks them up from
inside a copied skill; rename them when copying into a repo root. They are a
starting point: a repo may differ, and records why under `## House exceptions`
in AGENTS.md. No Prettier, ESLint or second linter for what Biome covers. A
rule a linter can check belongs in the linter's config, not in an instruction
file. How to silence one finding, per tool, is in
[references/suppressions.md](references/suppressions.md).

## Where each runs

- **One package script is the gate** (`bun run check`, or `lint` plus `check`)
  and CI runs exactly that script. The scripts are sketched in
  tikoci-toolchain's
  [package.example.json](https://tikoci.dev/house/skills/tikoci-toolchain/assets/package.example.json). A linter that runs only in CI, or only
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
  Biome rules in `.vscode/settings.json`. `.vscode/extensions.json`
  recommends the extensions that read them
  ([vscode-extensions.example.json](assets/vscode-extensions.example.json));
  a RouterOS repo adds `tikoci.tikbook`.
- **Output stays short**, so an agent can read the failure without losing its
  context.
- **The gate can fail.** Each linter in the gate has been seen to reject an
  input it must reject, and a test keeps it that way where a silent pass is
  possible: tikoci.github.io's
  [`test/lint-tools.test.js`](https://github.com/tikoci/tikoci.github.io/blob/main/test/lint-tools.test.js)
  feeds markdownlint an undefined reference and expects MD052. Repeat the
  probe after upgrading a tool or refreshing the lockfile: a duplicate copy
  of a package the tool patches switched that rule off with no error.
- **Every generated file has a `--check` mode** (regenerate in memory, fail
  on a difference), and the gate runs it, so committed output cannot drift
  from its source (centrs `docs:cli:check`).
- **Secrets are caught by GitHub secret scanning with push protection**, a
  repository setting (`tikoci-github`). A repo that handles credentials in
  files may add secretlint to the gate, as centrs does.

## Findings you did not cause

A finding already in the repo costs every later agent time, because each one
has to work out whether it caused it.

- **One or two small ones: fix them in the current change**, even if
  unrelated.
- **A batch** (a dozen findings, a newly enforced rule) goes in BACKLOG.md,
  an issue or its own PR, never into a focused change.
- **A rule is enforced from the PR that fixes its findings.** Until then it
  stays off, or at the level it was, with the backlog item linked; that is
  the leeway, not a standing warning.

## Types: tsc

Tight types make code more durable and diffs easier to read, because the types
tell the story of a change. Starting from
[tsconfig.example.json](assets/tsconfig.example.json) (Bun's `bun init` plus
the stricter checks TypeScript's own `tsc --init` turns on):

- **`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`**:
  an index may miss, and an optional property is absent rather than
  `undefined` unless its type says `| undefined`.
- **`erasableSyntaxOnly`**: no `enum`, `namespace` or parameter properties.
  The code is JavaScript plus types; use a union of string literals or an
  `as const` object.
- **`verbatimModuleSyntax`** and `.ts` import extensions, matching how Bun
  runs the code.
- **`unknown`, not `any`**, narrowed with a check. Biome enforces this.
- **Left off on purpose**: `noUnusedLocals` and `noUnusedParameters` (Biome
  reports unused code, with a fix) and `noPropertyAccessFromIndexSignature`
  (`noUncheckedIndexedAccess` already types the access).
- **tsc wins a conflict.** A repo that turns on
  `noPropertyAccessFromIndexSignature` turns off Biome's
  `complexity/useLiteralKeys`, rather than dropping the type check.
- **An existing repo adopts a stricter flag in its own PR**, with the fixes
  (`exactOptionalPropertyTypes` alone is hundreds of edits in a large repo).
  Until then the gap is a House exception. When the fixes change exported
  types (quickchr's public options), that PR carries a CHANGELOG entry and a
  type check of a consuming repo.

## Lint: Biome

From [biome.example.jsonc](assets/biome.example.jsonc):

- **Formatter off by default**, and the import-sorting assist off: turning a
  formatter on in an existing repo produces formatting-only diffs, which cost
  review time and bury the change. An existing repo does not switch either way.
- **A new repo should consider turning it on** from its first commit, with
  the pre-commit hook applying it: several agents writing in one repo then
  produce one known shape instead of drifting styles (centrs has run it from
  day one). Whichever way it goes, a repo with the formatter on records it
  under `## House exceptions`.
- **The gate runs `biome lint --error-on-warnings`.** A warning is fixed or its
  rule is turned off in the config with a reason; it never sits in the output.
- **`noExplicitAny` and `noNonNullAssertion` are errors in shipped code**:
  use `unknown` and a check instead. Tests turn both off: they need the looser
  escapes to reach into results and build odd inputs.
- **Stylesheets and HTML pages are linted too**, with their `<style>` and
  `<script>` blocks, under the same rules as other code: no `files.includes`
  that leaves them out, and no override that relaxes every page.
- **`noDescendingSpecificity` is off.** It compares any two selectors that end
  in the same element, whether or not they can match the same one, so it
  flags unrelated components (`.hero-art svg` after a dropdown's icon rule).
  Reordering a stylesheet to please it scatters each component's rules.
- **`useTemplate` is off.** `"<b>" + name` and `` `<b>${name}` `` are the same
  string, and neither escapes `name`: only an escaping helper does. A style
  hint with no quality payoff, which Biome rates info, below the gate, but
  prints on every run.
- **`noImportantStyles` stays on.** An `!important` that overrides a
  third-party widget's own CSS (Scalar, Monaco) keeps a suppression that names
  the widget; one that only wins against the site's own rules is fixed.
- **`biome.jsonc`**, so each non-default rule carries its reason as a comment.
- **Keep Biome's `$schema` version, the package.json version and `bun.lock` in
  step**; a schema mismatch message usually means a local binary drifted from
  the lockfile.

## Markdown

Markdown linting catches what breaks rendering or tooling, and nothing more.
Rewriting prose to satisfy a style rule, or a diff that only rewraps lines, is
a cost with no benefit. From
[markdownlint-cli2.example.yaml](assets/markdownlint-cli2.example.yaml):

- **One `.markdownlint-cli2.yaml`** holds the rules (under `config:`) and the
  file list; the CLI and the VS Code extension both read it. Each non-default
  rule has a comment saying why. Exclusions go in its `ignores:`, not the
  older `.markdownlintignore`. On adoption, move the rules from a root
  `.markdownlint.yaml` into `config:` and delete the file: beside
  `.markdownlint-cli2.yaml` it overrides `config:`.
- **Off**: line length, inline HTML, emphasis as a heading, first line as a
  heading, table column alignment.
- **Tag every fenced code block** with a language (`text`, `sh`, `typescript`,
  `json`, `yaml`, `routeros`). Tools find code by its tag: tikbook runs
  `routeros` blocks, and a search for them finds every RouterOS example.
- **Human docs** (README, manuals, reports) may use the HTML GitHub renders
  (`<details>`, `<abbr>`, `<kbd>`, `<sub>`), tables, and Mermaid diagrams,
  when they add meaning or density. Agent-facing files (AGENTS.md, skills)
  stay plain Markdown, since agents read the source.
- **Lint AGENTS.md, the repo's own skills and every human doc that ships**
  (README, DESIGN.md, MANUAL.md in an npm package): broken structure there
  misleads agents and users. Ignore `CLAUDE.md` (one import line), house skills copied
  unchanged into `.agents/skills/` (linted at the source, and a fix would
  break the copy), generated docs, fixtures, and `.github/instructions/` until
  the repo retires it.
- **Fix malformed Markdown** before teaching cspell the broken token it
  produced.

## Spelling

- **The dictionary is `project-words.txt`**, referenced from `cspell.json`
  with `addWords: true` so the editor's "Add to dictionary" writes there.
  [cspell.example.json](assets/cspell.example.json) checks Markdown and
  shipped source (`src/**/*.ts`), where error messages, CLI help and JSON keys
  live, the text users actually read; identifiers cost a few dictionary
  entries. It skips copied house skills, whose words the repo's dictionary
  does not have.
- **Real vocabulary goes in the dictionary**: RouterOS, networking, QEMU and
  tikoci terms, unusual acronyms, project names, jargon with a specific
  meaning, and any word used in several files. When in doubt, add it there;
  that is not a mistake. **A typo is fixed in the source, never added.**
- **One word per line, sorted case-insensitively**, so additions land in
  different places and merge cleanly. Check it in the lint gate:
  `sed -e '/^#/d' -e 's/ *#.*//' -e '/^$/d' project-words.txt | LC_ALL=C sort -c -f -u`.
  A repo with longer definitions (centrs `GLOSSARY.txt`) keeps them in a
  glossary doc and leaves a short note here.
- **A word that is not obvious says what it is on the same line**, after
  ` # ` (cspell ignores the rest of the line): what it is and, for a tool or
  repo, its URL. See
  [project-words.example.txt](assets/project-words.example.txt).
- **Non-vocabulary goes in `ignoreWords`** in `cspell.json`: locale variants,
  documentation placeholders, test sentinels. A word used in one file only,
  such as a variable name in code, gets an inline `cspell:ignore` comment in
  that file instead.
- `ignorePaths` covers generated and vendored output; never ignore a real
  source file to hide one word.

## Workflows, shell and containers

- **actionlint** checks workflow YAML and gates.
- **zizmor** audits workflow security (`uvx zizmor --offline .` locally). Run
  it and report its findings, through code scanning or the job log, as centrs
  does in `codeql.yaml`; gate on it once the existing findings are triaged
  (quickchr plans this in #228 but does not run it yet).
- **shellcheck -s sh --severity=warning** on every shell script and example.
  Scripts are POSIX sh (CI's `/bin/sh` is dash). Logic that wants Bash
  features is a sign the script should be TypeScript run by Bun
  (`#!/usr/bin/env bun`), where tsc, Biome and tests reach it; Bash only where
  Bun is not available, checked with `-s bash`.
- **hadolint** on Dockerfiles, where a repo has them.
- A local run may skip a tool that `bun install` does not provide (shellcheck,
  actionlint, hadolint) and say so; CI installs it, and the developer docs
  list it (see `tikoci-toolchain`). With `CI` set, a missing tool fails:
  a skip there removes the gate silently the day an install step breaks.

## Skill descriptions

A repo that copies many skills into `.agents/skills/` checks the total size of
their descriptions, because harnesses list every description up front and
may truncate the listing. This repo's
[`scripts/check-skills.ts`](https://github.com/tikoci/tikoci.github.io/blob/main/scripts/check-skills.ts)
does it for house skills (10000 characters, printed per skill). The budget is
a trigger for a cleanup pass (move detail to `references/`), not a reason to
leave a rule out.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
