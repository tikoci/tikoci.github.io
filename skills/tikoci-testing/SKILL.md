---
name: tikoci-testing
description: "How tikoci repos test: bun:test; unit tier on every PR, smoke integration on a real CHR via quickchr behind an env flag, a channel sweep nightly and before release, lab work by hand or a non-gating dispatch job. Every behavior change ships a test that can fail: assert what the code decides and output markers, not exit 0. Coverage tracked in CI, never a gate. Hermetic: TIKOCI_SANDBOX, explicit child env, port 0, cleanup in finally, timeouts from the operation's budget. Use when writing tests, mocks or test tiers."
---

# Testing

How tikoci repos structure and write tests. Why the real router matters, and
what "done" requires, are in
[tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md);
how CI wires the tiers belongs to [tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md). Copyable
patterns are in [references/patterns.md](references/patterns.md).

## Runner and layout

- **`bun:test` is the runner**: `describe` and `test` (not `it`), files
  named `*.test.ts`. `Bun.*` APIs are fine in tests even where shipped code
  must also run on Node. Code that ships for Node gets a check that runs under
  Node (the built CLI or package entry point, in CI), because Bun passing
  proves nothing about Node; that check is a smoke step, not a second test
  framework.
- **Tiers live in separate directories** (`test/unit/`, `test/integration/`,
  `test/lab/` or the repo's equivalent), so a tier runs by path.
- **The integration tier is behind an env flag** (`QUICKCHR_INTEGRATION=1`,
  `CENTRS_RUN_FAST_INTEGRATION=1`), so plain `bun test` never boots a VM. The
  repo's package script sets it. Names stay as they are; a new repo uses
  `<TOOL>_INTEGRATION`.
- **The RouterOS target is an env knob** (a channel or a pinned version), the
  same one a CI dispatch input sets, defaulting to `stable`.
- **Test settings live in `bunfig.toml`** (`[test]`: preload, coverage
  reporters); start from [bunfig.example.toml](assets/bunfig.example.toml).
- **Coverage is tracked, never a gate.** CI runs `bun test --coverage` and
  keeps the report (job summary or lcov artifact) as a rough map of untested
  areas. Bun reports only the files a test loaded: a module no test imports
  is missing from the report, not shown as uncovered. No `coverageThreshold`:
  a number to defend invites tests written for the number.

## Tiers

| Tier | Needs | Runs | Holds |
| --- | --- | --- | --- |
| Unit | nothing: no network, VM or real home | every PR and push, on each OS the tool supports | pure logic, parsers, argument builders, error shapes, anchor tests |
| Smoke integration | QEMU and a CHR via quickchr | every code PR, `stable` channel | the core paths: does the CLI and library generally work against a real router |
| Full sweep | as above | nightly when something changed, and before a release | every active RouterOS channel, the repeat counts and options that are too slow per PR |
| Dispatch | expensive hosts or long boots | `workflow_dispatch` from any branch | cross-platform QA, architecture contrasts, VM boot suites |
| Lab | anything | by hand, or a non-gating dispatch job; never a gate | semi-durable experiments with a `REPORT.md`, rerun to recheck an assumption |

Docs-only changes run the repo checks, not the integration tier. A repo
without device behavior has only the unit tier, and that is complete.

## RouterOS versions

Every tikoci project talks to RouterOS, and RouterOS answers the same
question differently across releases
([tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md)).

- **Name a channel, not a version.** Tests, CI jobs and examples target
  `stable`, `long-term`, `testing` or `development` and resolve it when they
  run, so CI moves with RouterOS on its own. Pin a version only when that
  version is the point: a regression on one release, the two sides of a
  declared version split, a minimum a feature needs, or a controlled
  contrast. The pin says why, next to it. RouterOS 6 has no channel: it is
  pinned by version, a boot-only target with no REST (quickchr
  `isRouterOs6`), and the `NEWESTa7` feeds are 7.x only.
- **Resolve once, record the version.** A run resolves each channel to a
  version once and uses that version for the cache key and the boot. Its
  results name the version the device reports, never only the channel
  ([tikoci-ci patterns](https://tikoci.dev/house/skills/tikoci-ci/references/patterns.md),
  "Caches" and "Failure evidence").
- **Where versions come from**: MikroTik's plain-text feed per channel,
  `https://upgrade.mikrotik.com/routeros/NEWESTa7.<channel>`, which answers
  `<version> <unix time>` (`7.25.1 1793623193`). tikoci.dev republishes all
  four, with a state per channel, as one document:
  `https://tikoci.dev/data/ros-versions.json`.
- **Do not hand-roll parsing or comparing.** RouterOS versions are not
  SemVer: `7.22`, `7.22.1`, `7.23beta2`, `7.22rc4`, where a missing patch is
  `.0`, betas sort before release candidates and both before their release.
  `semver.coerce` and a comparator that ignores beta versus rc both get this
  wrong (vscode-tikbook and restraml do today).
  - Bun code that depends on quickchr uses its exports: `resolveVersion`,
    `resolveAllVersions`, `selectActiveChannels`, and
    `compareRouterOsVersion` to sort. Not `parseVersionParts`, which drops
    the beta or rc suffix.
  - Browser, Node or shell code (quickchr ships Bun-only source) ports
    routeros-fundamentals'
    [version-parsing reference](https://github.com/tikoci/routeros-skills/blob/main/routeros-fundamentals/references/version-parsing.md),
    which also covers download URLs. Its `compareVersions` sorts newest
    first and returns `NaN` for equal releases (`Infinity - Infinity`). A
    port returns a negative number when the first version is older, as
    `compareRouterOsVersion` does, and 0 for equal versions, so a check
    like "at or ahead of `stable`" works with either.
  - Either way, a unit test holds these vectors: `7.9 < 7.10`;
    `7.24beta2 < 7.24beta10 < 7.24rc1 < 7.24 < 7.24.1`; `7.22 == 7.22.0`;
    `6.49.18 < 7.1`.
- **Channels are not ordered.** `testing` can equal `stable` or trail it as
  a stale rc, and `development` is usually, not always, the newest. Which
  channels are worth booting comes from the live versions: `stable` and
  `long-term` always, a pre-release channel when it is at or ahead of
  `stable` (quickchr `selectActiveChannels`, used by centrs's
  `scripts/qa-active-channels.ts`). Which of them must pass is the repo's
  call; in centrs only `stable` and `long-term` gate.
- **Boot each version once.** Two channels often resolve to the same
  version (`testing` and `stable` are both `7.25.1` today), so a matrix
  keys its legs on the resolved version and lists every channel that
  resolved to it.
- **A new RouterOS version is a trigger.** A daily job reads the feeds and
  starts what a new version needs: quickchr dispatches a full integration
  run for any version it has never tested, restraml and mikropkl build their
  per-version outputs, and centrs's nightly sweep runs when a resolved
  version (or `main`) changed. Recipe: tikoci-ci patterns, "A new RouterOS
  version".
- **Type what you use, not what RouterOS returns.** Response shapes drift
  between versions, so code checks the shape it expects (an array from a
  list, an object per record, an empty body from a delete), reads the
  fields it needs by name and handles a missing one, rather than typing
  every attribute (quickchr `routeros-rest.instructions.md`). REST encodes
  every record value as a string, numbers and booleans included
  (`"1500"`, `"true"`), so convert each field where it is read; a version
  change then shows as a missing field rather than a wrong type. An error
  reply is its own shape, with a numeric `error` and a `message`
  (`{"error":404,"message":"Not Found"}`).

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
