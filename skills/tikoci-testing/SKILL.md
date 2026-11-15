---
name: tikoci-testing
description: "How tikoci repos test: bun:test; unit tier on every PR, smoke integration on a real CHR via quickchr behind an env flag, a channel sweep nightly and before release, lab work outside CI. Every behavior change ships a test that can fail: assert what the code decides and output markers, not exit 0. Hermetic: TIKOCI_SANDBOX, explicit child env, port 0, cleanup in finally, timeouts from the operation's budget. Use when writing tests, mocks or test tiers."
---

# Testing

How tikoci repos structure and write tests. Why the real router matters, and
what "done" requires, are in
[tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md);
how CI wires the tiers belongs to `tikoci-ci`. Copyable
patterns are in [references/patterns.md](references/patterns.md).

## Runner and layout

- **`bun:test` only**: `describe` and `test` (not `it`), files named
  `*.test.ts`. `Bun.*` APIs are fine in tests even where shipped code must also
  run on Node.
- **Tiers live in separate directories** (`test/unit/`, `test/integration/`,
  `test/lab/` or the repo's equivalent), so a tier runs by path.
- **The integration tier is behind an env flag** (`QUICKCHR_INTEGRATION=1`,
  `CENTRS_RUN_FAST_INTEGRATION=1`), so plain `bun test` never boots a VM. The
  repo's package script sets it. Names stay as they are; a new repo uses
  `<TOOL>_INTEGRATION`.
- **The RouterOS target is an env knob** (a channel or a pinned version), the
  same one a CI dispatch input sets, defaulting to `stable`.

## Tiers

| Tier | Needs | Runs | Holds |
| --- | --- | --- | --- |
| Unit | nothing: no network, VM or real home | every PR and push, on each OS the tool supports | pure logic, parsers, argument builders, error shapes, anchor tests |
| Smoke integration | QEMU and a CHR via quickchr | every code PR, `stable` channel | the core paths: does the CLI and library generally work against a real router |
| Full sweep | as above | nightly when something changed, and before a release | every active RouterOS channel, the repeat counts and options that are too slow per PR |
| Dispatch | expensive hosts or long boots | `workflow_dispatch` from any branch | cross-platform QA, architecture contrasts, VM boot suites |
| Lab | anything | by hand, never in CI | semi-durable experiments with a `REPORT.md`, rerun to recheck an assumption |

Docs-only changes run the repo checks, not the integration tier. A repo
without device behavior has only the unit tier, and that is complete.

## What gets a test

- **Every behavior change ships with a test** that covers it, in the same
  change.
- **Behavior that reaches a device needs an integration test** that boots a
  real CHR, exercises the feature, checks the result through the router (REST,
  CLI or state) and removes the machine in `finally`. Mocks and unit tests are
  not enough for it.
- **Anchor tests pin current behavior** before a refactor or an agent rewrite,
  so a regression shows as a failing test rather than a review argument. They
  are cheap, need no VM and run on every push.
- **Examples are tests.** A runnable example that boots a router is a canary
  for the whole stack; when one fails, assume the tool has a bug.

## Tests that can fail

An assertion nobody has seen fail is a claim, not a test.

- **Watch each new assertion go red once.** Inject the state it should catch
  (the leftover file, the wrong field) and confirm the test fails. quickchr
  found four assertions checking a `.part` file name the code never wrote.
- **Assert what the code decides**, not what the runtime or the router happens
  to synthesize. A header or message chosen by Bun changes with a Bun upgrade;
  re-measure it rather than trusting an old comment, and narrow the assertion
  to the invariant, never to a bare `toThrow()`.
- **Exit 0 is not evidence.** Smoke checks assert output markers that only a
  working run prints, including one from the end of the script and one the
  tool printed rather than the script's own `echo`. Every failure path exits
  non-zero.
- **No catch-all around the call under test.** If a test must swallow an
  error, assert something the stub recorded to prove the code got that far.
- **Grow stubs with the source.** When code starts calling a new method on a
  mocked object, every stub of it gets that method, and the new call gets its
  own assertion.
- **Declare version splits, never relax them.** When RouterOS answers
  differently across releases, express the split in one shared contract
  (a minimum version, an accepted set of codes), gate on the running version
  rather than the channel name, and keep both sides exact.

## Hermetic tests

A test must not read or change the developer's own setup, and must not
re-download what the machine already has.

- **Sandbox the user scope.** Under
  [tikoci-home](https://tikoci.dev/house/skills/tikoci-home/SKILL.md) a test
  run sets `TIKOCI_SANDBOX`, which reads no user state, project, legacy path or
  keychain but still shares the download cache
  ([isolation contract](https://tikoci.dev/house/skills/tikoci-home/references/isolation.md)).
  Until a tool adopts it, use the tool's own override (`QUICKCHR_DATA_DIR`,
  `CENTRS_CDB_FILE`, `DB_PATH=:memory:`), set in a preload, never the real one.
- **Pass an explicit env to every child process**, built from an allowlist
  (tikoci-home's `hermeticEnv()`), never by copying `process.env`. A spawned
  Bun process does not see later changes to `process.env`, so without `env`
  it silently uses the real data directory. Run `bun` children with
  `--no-env-file`, or Bun loads the checkout's `.env` and brings an override
  back. Keep the real `HOME`: faking it moves the host scope where port
  claims live, and the cache too unless `TIKOCI_CACHE_DIR` is set.
- **Windows env names ignore case** (`HTTPS_PROXY` and `https_proxy` are one
  variable). Clear every spelling, then set; never set one and delete the
  other in the same loop.
- **No side effects at import.** Scripts run their work only under
  `if (import.meta.main)`; a module that opens a database or reads files at
  import time is imported by tests only after the override is set, with
  `await import()`. A structural test that rejects the wrong pattern beats a
  runtime guard that fires only in an unlucky file order.
- **Reserve nothing fixed**: bind port 0 and pass the port in, never assume a
  free host port, and never hard-code a router address or assume one is
  running. Boot routers through quickchr.
- **Name what you create with a fixed, reapable prefix**, and remove it in
  `finally`, so a failed run leaks nothing and the next run can clean up.
- **Short socket paths**: Unix sockets go under a short temp directory
  (`os.tmpdir()`), never deep in the checkout; the path limit is about 104 to
  108 bytes and some FUSE mounts do not support sockets.
- **Temp directories are created per test and removed** in `afterEach`.

## Bun specifics

- **A top-level `mock.module()` leaks** into every later file in the same
  `bun test` process, and `mock.restore()` does not undo it (Bun 1.4.4).
  Isolate the mock in a worker process, or snapshot the real exports and
  re-register them afterwards. After adding a module mock, run the full unit
  suite, not just the file.
- **Mock HTTP at the layer the code uses.** Code on `node:http` is tested
  against a real `createServer` on port 0; only code that calls `fetch`
  directly may replace `globalThis.fetch`.

## Timeouts

- **A test timeout must outlive the operation's own budget.** Derive it from
  the budget (boot timeout for this host's architecture and accelerator, plus
  any evidence capture) instead of hard-coding a number. A shorter literal
  kills the test before the operation gives up, so the failure arrives with no
  evidence.
- **Long tests state their timeout** explicitly, as the third argument to
  `test()`.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
