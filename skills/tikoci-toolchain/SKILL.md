---
name: tikoci-toolchain
description: "tikoci toolchain: Bun runs, tests, installs and builds (not node, npm, npx or jest); one exact Bun pin in package.json packageManager, raised in its own PR, never lowered to dodge a failure; bun.lock committed with each dependency change; TypeScript by default, Node only where shipped code runs on Node, Python only for tooling via uv; package.json scripts are the entry point, a Makefile only for several runtimes; POSIX sh, or a Bun script once logic gets clever; tools outside bun install listed in the README; images built and tested in CI, not local Docker. Use when choosing a runtime, language, script, task runner or dev tool."
---

# Toolchain

What tikoci repos build and run with. Linters are in `tikoci-linting`,
dependency and action pins in `tikoci-dependencies`, and how CI calls all
of this in `tikoci-ci`.

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
| `dotenv` | nothing: Bun loads `.env` |
| `execa`, `child_process` wrappers | `Bun.$`, `Bun.spawn` |

- **ESM only**, with the `.ts` extension in relative imports.
- **Look up Bun APIs** in the installed `bun-types` package (its `.d.ts` files
  and docs) or Bun's current docs, not from memory: Bun moves fast.
- **`Bun.*` is fine** in tests, CI scripts and tools, even in a repo whose
  shipped code must also run on Node.
- **Node only where shipped code runs on Node**: an npm package consumed by
  Node users, a VS Code extension. Keep `Bun.*` out of that code path, say so
  in AGENTS.md with the reason, and give it a smoke check that runs under Node
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
  inline `bun-version:`: one file, one place to change.
- **Why pin:** when CI installs whatever Bun is newest, a Bun release turns
  tests red with no repository change to point at, and the innocent PR under
  review takes the blame (quickchr #148). A runtime upgrade is a toolchain
  change and arrives as its own reviewable diff.
- **Upgrade promptly, in its own PR**, and let the full matrix run. If it goes
  red, that PR owns the incompatibility. A newer Bun is the fix for an old-Bun
  problem; **never pin backwards** to dodge a failure.
- **The pin is also the minimum supported Bun.** Users and fresh agent
  sandboxes often run a newer one; some OS packages lag behind.
- **Check the pin mechanically**, as part of `check`: the pin is exact (no
  range, `latest` or `canary`) and every `setup-bun` step reads it. quickchr's
  `scripts/check-bun-pin.ts` is the pattern, but it checks `.bun-version`;
  adapt it to read `packageManager` when adopting.
- **Open (`bun-ci-version`)**: how CI also meets the latest Bun is not
  settled. The direction is a `workflow_dispatch` input for the Bun version,
  defaulting to the pin, plus a scheduled run against the latest Bun; a
  latest-Bun job on every PR is too much.

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

## Task entry points

- **A Bun-only repo has no Makefile.** package.json scripts are the entry
  points, and `bun run check` is the gate a developer and CI both run.
- **A repo with several runtimes or compilers has one Makefile** as its entry
  point. It calls the package scripts for the JavaScript lifecycle and owns
  the rest (data pipelines, image builds, multi-step checks). Never define the
  same task in both.
- **CI calls the same entry point a developer does**, not a copy of its steps
  in workflow YAML, so a green local run predicts a green CI run.
- Make recipes are written as plain, idiomatic make (phony targets, pattern
  rules) and run under `/bin/sh`, which is dash on Ubuntu runners. **Each
  recipe line runs in its own shell**, so `set -eu` on one line protects
  nothing on the next: join dependent lines with `&& \` or `; \`, or set
  `.SHELLFLAGS := -eu -c` (and `.ONESHELL` if wanted) where GNU make 3.82 or
  newer is guaranteed; macOS ships 3.81, which has neither.

## Tools outside `bun install`

- **List every tool the scripts need that `bun install` does not provide**
  (shellcheck, actionlint, hadolint, QEMU, uv) in the README's development
  section or CONTRIBUTING.md, with how to install it. Anything `bunx` or
  `uvx` fetches on demand needs no entry; basic POSIX tools need none.
- **A script that needs a missing tool says which and how to get it**, and a
  local lint run may skip that tool with a message; CI installs it.
- Which machine has which tool is an operator fact, kept in local agent
  notes, not in the repo.

## Shell

Scripts and Make recipes are POSIX `sh`, checked with `shellcheck -s sh`
(see `tikoci-linting`). CI's `/bin/sh` is dash, and plain sh is easier to
read and to run anywhere. A script that needs arrays, string manipulation or
other clever shell is better written in TypeScript and run by Bun
(`#!/usr/bin/env bun`) in a repo that already needs Bun: tsc, Biome and
`bun test` all reach it.

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
