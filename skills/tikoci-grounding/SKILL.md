---
name: tikoci-grounding
description: "Ground claims in the real system: RouterOS on a CHR booted by quickchr decides RouterOS behavior, not docs, memory or review; run the call before changing code. One failure is a lead: reproduce it locally before naming a cause, and never skip, gate, retry or raise a timeout to turn red green. Unproven causes stay out of docs, issues and skills. Done means the exercising test ran, checks not run are reported and the CI step is named. Use when debugging, measuring or claiming done."
---

# Grounding and done

tikoci builds tools for RouterOS, and RouterOS behavior cannot be inferred
reliably from documentation, training data or reading code. The rules here
keep a guess from becoming a fact that spreads into code, docs and other
repos. They apply to anything tikoci code talks to (RouterOS, QEMU, Bun,
GitHub), with RouterOS as the case that comes up most.

Test tiers and how to write tests that can fail are in
[tikoci-testing](https://tikoci.dev/house/skills/tikoci-testing/SKILL.md).

## The real system decides

- **RouterOS on a CHR is the source of truth** for RouterOS behavior. Boot
  one with quickchr (the `routeros-quickchr` skills cover it), run the
  command, and read what comes back. Docs, rosetta and the `routeros-*`
  skills tell you where to look; they do not settle a question a CHR can
  answer.
- **Versions and architectures matter.** RouterOS answers the same question
  differently across releases. An assertion on device output is checked on
  `long-term` as well as `stable` before it is called done, and a claim about
  one architecture is checked on that architecture (arm64 runs under TCG on an
  x86 host: slow, but real).
- **Look things up instead of guessing.** For RouterOS documentation use the
  rosetta MCP before a web search. For library and tool APIs use current
  documentation (context7 or the project's docs) rather than memory.
- **A tikoci tool is the reference for its own domain.** When a repo and a
  skill disagree about quickchr or centrs behavior, the repo's code and tests
  win; fix the skill.
- **RouterOS is predictable, not flaky.** When a call fails after the router
  is ready, check in order: the command or REST path, the credentials, whether
  the command is asynchronous or blocking, a race with a field that is not
  populated yet after boot. Only then suspect timing or infrastructure.

## Experiment first

Before writing or changing code that talks to a device or an external system,
run the call by hand against a real one and keep:

- the actual output, in the exact shape it came back;
- the field or value that is wrong or missing;
- a concrete hypothesis: "field X is Y, should be Z, because ...".

Red flags that mean you are guessing: "it's flaky", "raise the timeout", "add
a retry", "switch the HTTP library". Each needs a minimal repro first. In
quickchr one connection-pool bug was fixed file by file over ten sessions
because nobody ran the request by hand to see what came back.

## A failure is a signal

- **One CI failure, or one log line, is a lead, not a fact.** Reproduce it
  locally before describing it as how RouterOS, QEMU or a tool works.
- **Never turn red green without understanding why it was red.** No `skip`,
  `skipIf`, OS or architecture gate, retry, raised timeout, loosened assertion
  or disabled validation (`validate=false` in centrs) as a first move. A skip
  is the worst of these: a bumped timeout still runs the test, a skipped test
  never reports again. Filing an issue next to the skip does not make it safe.
  A retry exists only to collect data on a flake an open issue is
  investigating, and is recorded
  ([tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md)).
- **Gate only after a local repro proves a real, unfixable limit**, and cite
  that repro in the gate.
- **A timeout is raised only once you know why the step is slow.** A step
  taking ten times its measured baseline has a bug, not a short timeout.
- **Do not route around a bug by breaking a design rule** or forking one
  path "temporarily". The fork becomes permanent and unvalidated, and the
  divergence hides the next failure.

## Measure honestly

- **Count attempts to tell waiting from latency** on emulated or slow
  targets. Latency inflates an elapsed-time figure; it cannot inflate an
  attempt count. Two pollers running at once against one guest slow each
  other and invent a "window" that a sequential re-measurement makes
  disappear. Elapsed time still measures latency and sets timeout budgets;
  record both, measured sequentially.
- **Change one factor at a time** and hold the rest. Compare pinned versions,
  never moving channels across days.
- **Gate on the property you care about**, not a proxy. Exit 0 proves nothing
  about the output; a package count proves nothing about which menus exist.
- **A step that can silently do nothing must fail.** If its purpose is to make
  something happen, assert that it happened and exit non-zero otherwise. A
  warning nobody reads is not a gate.
- **Do not reuse remembered timings.** Measure on the host and accelerator at
  hand, and name the accelerator in timeout errors.

## Record only what is verified

- **An unproven cause goes nowhere durable**: not in DESIGN or API docs, not
  in instructions, not stated as fact in an issue, and above all not in a
  shared skill, where one guess reaches every repo downstream.
- **Less detail beats shaky detail.** If a claim cannot be grounded (a local
  run, a `/console/inspect` query, a test, a vendor doc URL), omit it.
- **Record a grounded fact once**, in the narrowest place that owns it, with
  its evidence: RouterOS version, architecture and accelerator, date, the
  command or test that showed it.

## Done means

Work is done when the evidence for it exists, not when the code is written.

1. **The test that exercises the change ran and passed.** Logic needs a unit
   test; behavior that reaches a device needs an integration test against a
   real CHR. Add one if none covers it. Unit tests never stand in for a
   device run.
2. **The repo's gate commands ran** (its lint, test and build scripts, named in
   its AGENTS.md). Any check you did not run is reported as not run, with the
   reason; never imply it passed.
3. **CI picks it up.** Name the workflow and step that exercise the change on
   normal triggers (`push`, `pull_request`, a scheduled run). If none does, add
   one in the same change or leave the work open and record the gap; do not
   close on the assumption that someone will run a local command later.
4. **The record is current.** The issue is closed or updated, a durable
   decision or grounded fact is in its narrowest home, and a user-facing
   change has its changelog entry. A device result (pass or fail, RouterOS
   version) goes in the commit or PR that relies on it.

A repo with its own done definition (centrs' constitution, rosetta's
validation table) keeps it; this is the floor those build on.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
