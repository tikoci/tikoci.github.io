---
name: tikoci-toolchain
description: "tikoci toolchain: Bun runs, tests, installs and builds (not node, npm, npx or jest); one exact Bun pin in package.json packageManager, raised in its own PR, never lowered to dodge a failure; bun.lock committed with each dependency change; TypeScript by default, Node only where shipped code runs on Node, Python only for tooling via uv; package.json scripts are the entry point, a Makefile only for several runtimes; POSIX sh, or a Bun script once logic gets clever; tools outside bun install listed in the developer docs; images built and tested in CI, not local Docker; plain, consistent code; semantic HTML and plain CSS before a framework. Use when choosing a runtime, language, script, task runner or dev tool, or shaping code and web pages."
---

# Toolchain

What tikoci repos build and run with. Linters are in `tikoci-linting`,
dependency and action pins in `tikoci-dependencies`, and how CI calls all
of this in [tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md).

## Bun is the runtime

Use Bun for everything a JavaScript toolchain does, and Bun's built-ins before
a package:

| Instead of | Use |
| --- | --- |
| `node file.ts`, `ts-node`, `tsx` | `bun file.ts` |
| `npm install`, `yarn`, `pnpm` | `bun install` |
| `npx` | `bunx` |
| `jest`, `vitest` | `bun test` (`bun:test`) |
| `webpack`, `esbuild`, `vite` build | `bun build` |
| `express` | `Bun.serve` |
| `better-sqlite3` | `bun:sqlite` |
| `dotenv` | nothing: Bun loads `.env` (but see shipped CLIs below) |
| `execa`, `child_process` wrappers | `Bun.$`, `Bun.spawn` |

- **Publishing is the exception**: `npm pack`, `npm publish` and
  `npm dist-tag` need the npm CLI, because trusted publishing, provenance and
  dist-tags are npm registry features. The release workflow runs npm from an
  `npm` devDependency on `actions/setup-node`'s Node. The release rules
  belong to `tikoci-release`.
- **A shipped CLI does not read the working directory's `.env`.** Bun loads
  `.env` from wherever it runs, so an installed tool would pick up an
  unrelated project's settings (centrs #666). Start the bin with
  `#!/usr/bin/env -S bun --no-env-file`; that covers direct execution, and a
  `bun run` or `bunx` path needs the same flag.
- **ESM only**, with the `.ts` extension in relative imports.
- **Look up Bun APIs** in the installed `bun-types` package (its `.d.ts` files
  and docs) or Bun's current docs, not from memory: Bun moves fast.
- **`Bun.*` is fine** in tests, CI scripts and tools, even in a repo whose
  shipped code must also run on Node.
- **A published package is Bun-only by default**: it ships its `.ts` source
  (`main` or `bin` pointing at `src/`), sets `engines.bun`, and its README
  says Bun is required (quickchr, centrs). Node does not strip types from
  files under `node_modules`, so such a package does not run on Node.
- **Node only where shipped code runs on Node**: an npm package consumed by
  Node users, a VS Code extension. That package ships a JavaScript and `.d.ts`
  build, keeps `Bun.*` out of its code path, says so in AGENTS.md with the
  reason, and gets a smoke check that runs under Node
  (see [tikoci-testing](https://tikoci.dev/house/skills/tikoci-testing/SKILL.md)).
- **Bun has its own bugs.** Re-measure on the current Bun before trusting a
  workaround comment: quickchr's
  [Bun HTTP notes](https://github.com/tikoci/quickchr/blob/main/.github/instructions/bun-http.instructions.md)
  record pooled `fetch` connections, a destroyed `node:http` request that
  never errors, and `Bun.secrets` blocking without a terminal, each measured on
  a stated Bun version.

## One Bun pin

- **`packageManager` in package.json holds one exact version**
  (`"packageManager": "bun@1.4.4"`), and every `oven-sh/setup-bun` step reads
  it with `bun-version-file: package.json`. No `.bun-version` file and no
  inline version: one file, one place to change. The one exception is the
  dispatch-input override tikoci-ci puts next to `bun-version-file` in a
  workflow that tests (see the pin check below).
- **Why pin:** when CI installs whatever Bun is newest, a Bun release turns
  tests red with no repository change to point at, and the innocent PR under
  review takes the blame (quickchr #148). A runtime upgrade is a toolchain
  change and arrives as its own reviewable diff.
- **Upgrade promptly, in its own PR**, and let the full matrix run. If it goes
  red, that PR owns the incompatibility. A newer Bun is the fix for an old-Bun
  problem; **never pin backwards** to dodge a failure.
- **`engines.bun` is the published floor**, and it is what users see:
  `packageManager` never reaches a consumer. The floor may sit below the pin
  (quickchr: `>=1.4.3` against a 1.4.4 pin, for a known 1.4.3 fix) and is
  raised only on purpose, with a CHANGELOG entry, never as a side effect of a
  pin bump. Users and fresh agent sandboxes often run a newer Bun; some OS
  packages lag behind.
- **Other copies follow the pin**: `@types/bun` at the same exact version
  (Dependabot ignores it, so the types never describe APIs the pinned Bun
  lacks; centrs #438), and a Dockerfile `FROM oven/bun:<version>`.
- **Check the pin mechanically**, as part of `check`: the pin is exact (no
  range, `latest` or `canary`); every `setup-bun` step reads it, after
  `actions/checkout`; `@types/bun` and any Dockerfile match it; and
  `engines.bun` allows it. quickchr's `scripts/check-bun-pin.ts` is the
  pattern, but it checks `.bun-version`; adapt it to read `packageManager`
  when adopting. The one inline version it accepts is the override that
  tikoci-ci puts next to `bun-version-file`, and only while `BUN_VERSION` is
  defined once, at the workflow level, from the dispatch input (and
  `latest` on the schedule). A release or deploy workflow gets no override:
  it builds on the pin.
- **CI can meet any Bun**, without a latest-Bun job on every PR: a
  `bun-version` dispatch input everywhere, and, for a tool that runs on its
  users' Bun, a weekly scheduled CI run on `latest` whose failure opens an
  issue ([tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md),
  settles `bun-ci-version`).

## Lockfile

- **Commit `bun.lock` in the same change** as any dependency change.
- **CI installs with `bun install --frozen-lockfile`**, so a lockfile that
  does not match package.json fails the install instead of drifting.

## Languages

- **TypeScript by default**, for shipped code and tests, with tight types
  (the starting tsconfig is in
  [tikoci-linting](https://tikoci.dev/house/skills/tikoci-linting/SKILL.md)).
- **Python only by decision**, for one-off tooling, test drivers or LLM work.
  Not for primary application code by default: tikoci tools share code,
  tests and packaging in TypeScript, and a second language splits all three.
  A repo that needs Python at its core records that like any other language
  (below). Run it with `uv run` or `uvx`; no
  `venv`, Conda or pip-managed project environments. A script that only needs
  the standard library is easiest to run anywhere.
- **Another language** (Python at the core, Swift, Go, C) is a recorded decision in the repo's
  AGENTS.md, with its build driven from the command line.

## Code shape

Code is read by agents as often as by people, so write it plainly:

- **Simple, direct patterns** over clever ones, and few layers between a
  call and the work it does.
- **One way to do one job** across the repo: the next change copies what is
  already there.
- **Names that say what a thing is**, so comments explain why, never restate
  what the code says.
- **Crash early**: no preemptive `try`/`catch`. Catch where the error can be
  handled or reported (for CLIs and MCP servers, the boundary in
  [tikoci-cli-mcp](https://tikoci.dev/house/skills/tikoci-cli-mcp/SKILL.md)).

## Web pages

- **Semantic HTML first** (`article`, `details`, `dialog`, `table`), with a
  little plain CSS on top, before a CSS or front-end framework. Pico v2 is
  how tikoci.dev and restraml look today: a style guide, not a requirement.
- **Work within a framework the repo already uses; adding one is a recorded
  decision** in AGENTS.md, like another language.
- **A build step is fine** when Bun and CI run it: `bun build`, or static
  pages generated in CI for GitHub Pages.

## Task entry points

[package.example.json](assets/package.example.json) sketches the parts of
package.json the house skills refer to: the `packageManager` pin, the `check`
gate and the lint scripts (`tikoci-linting`), the test tiers
(`tikoci-testing`), the `audit` script (`tikoci-ci`) and the dev tools that
`bun install` provides.

- **A Bun-only repo has no Makefile.** package.json scripts are the entry
  points, and `bun run check` is the gate a developer and CI both run.
- **No other task runner** (`just`, Taskfile) unless the repo already uses
  one.
- **A repo with several runtimes or compilers has one Makefile** as its entry
  point. It calls the package scripts for the JavaScript lifecycle and owns
  the rest (data pipelines, image builds, multi-step checks). Never define the
  same task in both. In such a repo `make check` is the gate, and CI jobs call
  make targets where other house skills say package scripts. A couple of
  lines that fit a package script stay there; package.json does not drive
  substantive non-Bun work.
- **CI calls the same entry point a developer does** for the checks, not a
  copy of their steps in workflow YAML, so a green local run predicts a green
  CI run. Some work runs only in CI (image builds, publishing); once a repo
  has more than package.json and workflow YAML, keep the layers clear: the
  workflow sets up the runner (installing QEMU on macOS, Windows or Linux)
  and calls a script, a make target or the Dockerfile, which hold the logic.
- Make recipes are written as plain, idiomatic make (phony targets, pattern
  rules) and run under `/bin/sh`, which is dash on Ubuntu runners. **Each
  recipe line runs in its own shell**, so `set -eu` on one line protects
  nothing on the next: join dependent lines with `&& \` or `; \`, or set
  `.SHELLFLAGS := -eu -c` (and `.ONESHELL` if wanted) where GNU make 3.82 or
  newer is guaranteed; macOS ships 3.81, which has neither.

## Tools outside `bun install`

- **List every tool the scripts need that `bun install` does not provide**
  (shellcheck, actionlint, hadolint, QEMU, uv) where developers look: the
  README's development section, CONTRIBUTING.md or another developer doc,
  with how to install it. Anything `bunx` or
  `uvx` fetches on demand needs no entry; basic POSIX tools need none.
- **A script that needs a missing tool says which and how to get it**, and a
  local lint run may skip that tool with a message; CI installs it. A
  `doctor`-style command that checks and reports them (`quickchr doctor`) is
  a fine form of the list.
- **CI records the versions of host tools it does not pin** (QEMU, socat,
  edk2) in the job summary. They change with the runner image, which is the
  same surprise as an unpinned Bun (quickchr #148), so a failure can be
  traced to a tool upgrade.
- Which machine has which tool is an operator fact, kept in local agent
  notes, not in the repo.

## Line endings

`.gitattributes` keeps LF in the repo and in every checkout, so a shell
script cloned on Windows still runs and no diff is only line endings; it also
marks generated files. Start from
[gitattributes.example](assets/gitattributes.example).

## Shell

Scripts and Make recipes are POSIX `sh`, checked with `shellcheck -s sh`
(see `tikoci-linting`). `/bin/sh` on Ubuntu runners is dash, and plain sh is easier to
read and to run anywhere. A script that needs arrays, string manipulation or
other clever shell is better written in TypeScript and run by Bun
(`#!/usr/bin/env bun`) in a repo that already needs Bun: tsc, Biome and
`bun test` all reach it. A tool that supports Windows ships its shell
examples as PowerShell copies too, checked with PSScriptAnalyzer (quickchr
`lint-powershell.yml`).

- **Start with `set -eu`**, quote every expansion, and use no bashisms.
- **Bytes portably**: octal `printf` escapes (`\101`), not `\xNN`, which dash
  does not support; `LC_ALL=C` for byte-level `tr` on macOS.
- **Background a process as `nohup sh -c "exec CMD" &`**, so `$!` is the
  real process and `kill` reaches it; dash does not forward the signal to a
  child of the wrapper shell.
- **A backgrounded child that reads a temp file** races the parent's `EXIT`
  trap, which fires when the parent exits, possibly before the child reads the
  file. In background mode, do not delete it on exit: use a deterministic path
  per instance (keyed by its name, so a rerun of the same instance overwrites
  only its own file) with no cleanup trap, or `mktemp` with the trap skipped.
  Changing only the file name keeps the bug.

## Virtual machines and containers

- **QEMU, usually through quickchr**, for local RouterOS and Linux VMs.
- **No local Docker requirement.** Repos that build images build and test
  them in GitHub Actions. An image meant for RouterOS is tested under
  RouterOS `/container` on a CHR (quickchr), which is the real target:
  Docker is not `/container`. A local Docker run is fine for a one-off check
  during development, never as a step a contributor must have.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
