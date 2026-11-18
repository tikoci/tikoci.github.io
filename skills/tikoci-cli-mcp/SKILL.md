---
name: tikoci-cli-mcp
description: "tikoci CLI, library and MCP surfaces: output is agent-friendly, with no house shape. stdout is the result; tips and warnings are told apart, go to stderr in text mode, and name a next step; errors carry a code from one registry, what failed and the fix, and a way to more (a page, a URL, a doctor). Refuse an option, never drop it; recovery commands run as printed; a library never prints or exits; logic lives in a shared core with thin adapters. MCP is a few verbs whose descriptions route (next tool, empty-result hints), with a frozen tool list and CLI parity. Use when adding or changing a command, flag, error, tip, library export or MCP tool."
---

# CLI, library and MCP surfaces

How a tikoci tool talks to the people and agents that call it: the CLI, the
library API, an MCP server, and tools a web page registers. Most callers are
agents, so every surface is written to be read by one. Related rules live
elsewhere:

- a surface change adds a CHANGELOG bullet
  ([tikoci-release](https://tikoci.dev/house/skills/tikoci-release/SKILL.md));
- generated CLI references and URLs that shipped code prints
  ([tikoci-docs](https://tikoci.dev/house/skills/tikoci-docs/SKILL.md));
- the shipped CLI's shebang
  ([tikoci-toolchain](https://tikoci.dev/house/skills/tikoci-toolchain/SKILL.md));
- testing examples and output markers
  ([tikoci-testing](https://tikoci.dev/house/skills/tikoci-testing/SKILL.md)).

The strongest models differ by part: centrs for output shape and errors,
quickchr for testing the surface, rosetta for MCP descriptions.

## Agent-friendly output

There is no house output shape; each repo structures its own (settled
`output-shape`). centrs returns one envelope on every surface (`ok`, `data`,
`warnings`, `tips`, `error`, `meta`) and renders text from it without loss;
quickchr prints the result and sends tips to stderr. These are the rules;
one known exception is centrs's fan-out text, a report rather than data,
which keeps its warnings on stdout (CONSTITUTION, "Text stdout is data"):

- **stdout is the result**, so `tool … --json | jq` works without filtering.
  Progress, prompts and notes go to stderr.
- **Tips, warnings and errors are told apart.** A warning is an anomaly in
  this result (a stale cache, an unused option); a tip is advice that is not
  a problem (no default device set). An agent that keeps them apart can
  ignore a tip and still act on a warning.
- **In text mode, tips and warnings go to stderr**, so an agent drops them
  with `2>/dev/null` once it knows the tool. A `--json` mode keeps
  everything in one document.
- **A tip names a next command or a better-suited tool.** It never restates
  what just happened. Tips are not gated on a TTY: their audience, agents
  and first-time users, usually runs without one.
- **A caller can drop tips**: stderr does it in text mode, and a stable
  code on each tip, shaped like a warning, lets it drop one kind and keep
  the rest (centrs `tip/*`). An environment variable is one more way
  (`QUICKCHR_NO_TIPS=1`), not a requirement.
- **A warning that every normal run carries is noise in text mode.** Keep
  it in `--json` and leave it out of text, or agents learn to skip the
  warnings line and miss the one that matters (centrs leaves
  `transport/provider-trust`, which rides every quickchr run, out of text).
- **Plain text when stdout is not a terminal**: no ANSI escapes, and
  `NO_COLOR` forces it on a terminal too (rosetta `browse`).
- **A big result is summarized, with a way to the rest**: a capped list
  with a count, a stats block, and the flag or tool that returns more. This
  holds for MCP too, where hosts cap or cut large tool results and an agent
  then sees a broken JSON document: bound the size and say what was
  clipped (open in centrs #605).

## Errors

- **Errors are public API.** Each says what failed, why it matters and the
  next action: a one-sentence message, a one-sentence fix. Internals (a stack,
  a raw exception, the transport detail) ride as structured cause data, not
  in the message.
- **Each field has one name on every surface.** Renaming a shipped field
  (`fix` to `remediation`, `detailsUrl` beside `details_url`) is a breaking
  change with a CHANGELOG entry, and a spec that names one while the code
  emits the other is drift (centrs is reconciling exactly this).
- **One registry of codes is the source of truth**, and a test fails on a
  thrown code that is not in it: centrs `src/core/error-catalog.ts` with
  `test/unit/error-catalog.test.ts`, quickchr's `ErrorCode` union. The
  library throws one error class carrying the code. No vague codes: quickchr
  has `BOOT_TIMEOUT` and `QGA_TIMEOUT`, never a bare `TIMEOUT`. A code that
  shipped keeps its meaning. The spelling (`family/slug` or `UPPER_SNAKE`)
  is the repo's (settled `error-code-style`).
- **Keep the tool's errors apart from the system's**, whatever the
  spelling: a code says who failed. A RouterOS refusal maps to its own code
  family with the original string kept (centrs `routeros/*`, grounded on
  CHR in `src/core/routeros-errors.ts`).
- **A way to more information, when one line is not enough**, in whatever
  form fits (settled `error-details`): a page per code, a GitHub URL, or
  another command. centrs gives every code a page at a stable `details_url`,
  which pays off because its codes span a CLI, an API and MCP over several
  transports. The gap to watch is a failure the tool could detect but does
  not name. rosetta's offline error names `--refresh`, and its stale-client
  notice names the package spec to check; what it cannot see, a bare
  `bunx` serving its cache without asking the registry, it documents
  instead (MANUAL.md, "How Updates Work").
- **A recovery command runs as printed**: one command per line, a caveat as
  a comment in that line's language, every interpolated value shell-quoted.
  quickchr's routes once ended in `(power-cycles the machine)`, and `(` opens
  a subshell: the advertised fix was a syntax error.
- **Refuse, never drop.** An option that cannot apply fails with a code
  naming the option and where it does apply (quickchr
  `PROVISIONING_WINDOW_CLOSED`). An option already in effect is a no-op, so
  a script that passes the same flags every time is not punished. Absent is
  not `false`: keep "not given" apart from `--no-<flag>`.
- **An operation that creates or changes one thing is all or nothing.** The
  caller gets the machine or setting it asked for, or an error; partial
  success with warnings is an error, and a rollback makes the retry the same
  command (quickchr provisioning).
- **An operation across many targets reports each one.** centrs fan-out
  returns every target's result, failures included, and exits `0` when all
  succeeded, `2` when some failed, and `1` when every target failed or the
  run itself did; it does not roll back the targets that succeeded. A read
  keeps what it got and says what is missing.
- **A write across many targets is confirmed once, up front**, and the
  refusal without it names the blast radius (how many targets). An empty
  selection is an error for a write and a warning for a read, so a
  mistyped selector never passes as a successful bulk write (centrs #460).
- **A write that was sent is never retried**, on one target or many: it
  may already have run. It fails with a warning that the outcome is
  unknown (centrs `transport/write-outcome-unknown`, #448).
- **A missing local tool** is detected where practical, with an install hint
  for each platform.
- **Crash early while failure modes are unknown.** No preemptive
  `try`/`catch`; catch at the boundary that owns the output (the CLI's top
  level, the MCP handler) and handle a case once it is understood.

## A doctor

- **When outside dependencies or the environment cause whole classes of
  failure** (a binary, firmware, a downloaded database, credentials, a
  device the tool reaches), consider a `doctor` command or library call
  that checks the tool's own setup and names the fix for each problem.
  Its job is to rule setup out: after it passes, an agent can tell a
  failed call apart from a broken install.
- **Not every tool needs one; every tool flags setup it has not done.** An
  error or tip names the missing step where the tool first notices it
  (centrs `tip/no-devices`, `tip/credentials-missing`), and errors in a
  class the doctor covers suggest running it.
- **Scripts can run a doctor**: `--json` returns the checks, and a non-zero
  exit on a problem lets CI and hooks use it. quickchr `doctor` checks
  QEMU, firmware, acceleration and helper tools; rosetta `db:doctor`
  prints the same database verdict as its stats tool and startup banner.

## Layers

- **The library never imports the CLI, prints or exits.** The CLI owns
  terminal output and exit codes; the package's main export re-exports only
  the library (quickchr `src/lib/`, `src/cli/`, `src/index.ts`).
- **Shared behavior lives in the core**, so every surface inherits it.
  Adapters (CLI, TUI, MCP, a web page) keep formatting, transport and UI
  affordances; a heuristic only one adapter has is a smell. rosetta wrote
  this rule (`query.ts` under `mcp.ts` and `browse.ts`), and its code is
  still too tightly coupled to meet it: treat the rule as the target.
- **Every external call goes through the repo's common helper(s)** for
  timeouts, auth, HTTP errors and retries (settled `fetch-helper`); the
  helper's shape is the repo's.

## CLI conventions

- **`--help` is answered once, before dispatch**, so a new command cannot
  forget it, and a test fails a command with no help text (quickchr
  `cli-help-guard.test.ts`). The scan stops at a bare `--`.
- **Flags come from a registry.** A command that creates or changes things
  validates its flags against it, and a test cross-checks the registry with
  the help text. Read-only commands may tolerate stray arguments.
- **A flag's arity is declared, never guessed**: a table says which flags
  take a value, and a test scans the source for every flag read (quickchr
  `VALUE_FLAGS`, `cli-flag-arity.test.ts`).
- **A removed flag errors with its replacement**, so it cannot come back as
  a silently ignored argument.

## MCP

- **A handful of verbs over the core, not one tool per underlying
  command.** bench-routeros-tools measured a third-party RouterOS server
  with 166 tools: about 28K always-on tokens, and the right tool was a
  clear top-three pick only 62% of the time. centrs exposes six tools that
  follow its CLI verbs (`centrs_explain`, `centrs_validate`,
  `centrs_retrieve`, `centrs_execute`, plus `centrs_devices` and
  `centrs_discover`); rosetta argues the same in DESIGN.md ("Why
  endpoint-shaped MCP is not the answer").
- **Tool descriptions are interface**: they state knowledge boundaries
  (versions covered, export date), point to the next call with workflow
  arrows (`→ routeros_get_page`), and an empty result returns a hint, not a
  bare empty list.
- **Results use the CLI's shape**, as JSON text; a failure also sets the
  MCP result's `isError`, so a host shows it failed without parsing.
  `isError` means the call failed, not that one target did: a fan-out
  that completed with some targets failed is not an error (centrs
  `src/mcp/server.ts`). Typed output (`structuredContent` with an
  `outputSchema`) beside the text is an open choice; decide it on purpose
  (centrs #605).
- **Not found is an error only when the caller named the thing.** A lookup
  by exact id or title that finds nothing sets `isError` and names the
  next step (rosetta `routeros_get_page`); a search with no hits succeeds
  and carries the empty-result hints.
- **Validate in code** even when the input schema constrains a field: the
  schema helps the agent, the descriptive runtime error lets it retry
  (restraml WebMCP).
- **Annotations are honest.** `readOnlyHint` only on tools that cannot
  write; a tool that may write advertises the worst case
  (`destructiveHint: true` on centrs `execute`) and enforces the real gate
  in code. On WebMCP page tools, restraml sets `untrustedContentHint`
  whenever any string in the result comes from outside the repo.
- **A write opt-in lives where the agent cannot reach it**: per target, off
  by default, and changed only by a person through the CLI or a config
  file, never by a tool on the same server. A `confirm: true` the agent
  supplies guards against accidents, not against the agent. centrs has the
  shape (a device's `mcp=rw` plus `confirm: true`) and the trap: an agent
  can set `mcp=rw` through `centrs_devices` today, a gap its MATRIX
  records. The gate holds only against an agent limited to the MCP
  server; one that can run the CLI or edit the config can open it too.
- **The tool list is frozen in a test, with its annotations.** The test
  connects a real MCP client to the server in process and snapshots what a
  host sees: each tool's name and annotations. Adding, removing or renaming
  a tool, or flipping `readOnlyHint`, fails it until the list and the
  CHANGELOG are updated together. rosetta freezes names by reading the
  source (`EXPECTED_TOOLS` in `src/mcp-contract.test.ts`), the fallback for
  a server with no SDK client. A description-only edit needs no CHANGELOG.
- **Resources for whole datasets, tools for queries**: a CSV export an
  agent attaches on purpose is a resource; ranked, filtered retrieval stays
  a tool (rosetta).
- **Client diversity is the deployment gate.** Each MCP client has its own
  config format; `bunx @tikoci/<tool>` settles the runtime, not the config.
  Ship per-client install snippets, decide packaging before adding tools,
  and keep a read-only server apart from one that writes (rosetta
  DESIGN.md, "Deployment strategy").

## Parity: CLI, TUI and MCP

- **Every MCP tool can be called from the CLI** and returns the same JSON:
  rosetta `browse --once .routeros_search …` writes one JSON document to
  stdout. Calling a tool method from a shell is quicker than going through
  an MCP client, and a test can do it.
- **A TUI over the same core** lets a person explore the way an agent does
  through MCP, one step leading to the next, which audits both the
  retrieval and the exposed tools (rosetta `browse`). centrs keeps one
  settings vocabulary across its API, CLI and MCP.

## Specs and examples

- **A command's spec is normative.** When code and spec disagree, fix the
  code, or change the spec first and then the code; never let them drift.
  centrs keeps a spec per command (`commands/<name>/README.md`) and an
  `examples.md` in which every example has a test.
- **Examples are onboarding**: agents open `examples/` before the source.
  quickchr's shape is a directory per example with a runnable library
  script, a CLI mirror (POSIX `sh`, PowerShell, sometimes Python), a README
  from a template and a coverage list; teardown is guaranteed, so a failed
  run leaves no machine behind. Testing them is
  [tikoci-testing](https://tikoci.dev/house/skills/tikoci-testing/SKILL.md);
  friction they expose is a finding
  ([tikoci-docs](https://tikoci.dev/house/skills/tikoci-docs/SKILL.md)).

## Patterns and sources

[references/patterns.md](references/patterns.md) has copyable code: a tips
helper, an error registry with its test, a frozen tool surface, and
quoting a printed command. [references/sources.md](references/sources.md) lists the
survey rows and repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
