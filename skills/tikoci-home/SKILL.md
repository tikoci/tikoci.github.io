---
name: tikoci-home
description: "Where tikoci tools keep files outside a checkout. Three roots share one layout (TOOL/ for config, secrets and state, run/TOOL/ for runtime): the user root TIKOCI_HOME (default ~/.tikoci, %LOCALAPPDATA%\\tikoci on Windows, no XDG), the only one that evicts the shared cache or manages host resources; a project's .tikoci/ workspace, found by walking up and committed like .claude/ apart from local files; and TIKOCI_SANDBOX, a disposable guest for tests and CI that shares the cache but reads no user state, workspace, legacy path or keychain. A tool's own variable (QUICKCHR_HOME) wins over TIKOCI_* for that tool. Committed workspace settings set only allowlisted keys; local files and project data count only once a person enrolls the workspace, never via MCP. A supplied env without HOME has no user root. Legacy data stays in charge until an explicit migrate. Use when adding a file a tool keeps outside the checkout, an env override, a settings layer, a cache or a test that touches user state."
---

# tikoci tool files

Where tikoci tools (quickchr, centrs, rosetta and the rest) keep config,
secrets, state, caches and runtime files; how a project and a test run fit
next to the user's own setup.

This is the target layout. No tool uses it yet: each repo adopts it on its own
schedule, and until then the tool's current paths stand. The per-tool map of
what exists today and where it goes is
[references/layout.tsv](references/layout.tsv), explained in
[references/layout.md](references/layout.md).

## Three roots, one layout

A root is a directory with the same shape wherever it lives:

```text
<root>/
  <tool>/            config (<tool>.env), secrets, state
  run/<tool>/        sockets, pid files, live locks
```

| Root | Where | Role |
| --- | --- | --- |
| user | `TIKOCI_HOME`, default `~/.tikoci` (`%LOCALAPPDATA%\tikoci` on Windows) | The owner. One per user, like `~/.claude`. Holds the shared cache (`cache/<tool>/`), evicts it, and manages host resources. |
| workspace | `<project>/.tikoci/`, found by walking up | A persistent guest, like a project's `.claude/` or `.github/`. Layers over the user root. |
| sandbox | `TIKOCI_SANDBOX` | A disposable guest for a test or CI run. Isolated from the user root. |

A run has a user root (unless its env has no home; see Resolving paths), at
most one workspace, and is either sandboxed or not. **Guests share the user's
cache but never evict from it, never manage host services, and never take a
host resource the owner holds.**

## Variables

| Variable | Default | Sets |
| --- | --- | --- |
| `TIKOCI_HOME` | `~/.tikoci` | the user root (relocation only) |
| `TIKOCI_CACHE_DIR` | `$TIKOCI_HOME/cache` | the shared cache root |
| `TIKOCI_RUNTIME_DIR` | `<root>/run` | the runtime root of this run |
| `TIKOCI_WORKSPACE` | discovered | a project directory holding `.tikoci/`, or `none` |
| `TIKOCI_SANDBOX` | unset | a sandbox root: this run is a guest |
| `<TOOL>_HOME` | `<root>/<tool>` | one tool's directory |
| `<TOOL>_CACHE_DIR` | `<cache root>/<tool>` | one tool's cache |
| `<TOOL>_<KEY>` | the settings files | one setting, same name as in `<tool>.env` |

`<TOOL>` is the tool name in upper case with `-` as `_` (`ROUTEROS_MUSE`).

- **Precedence is always** flag, then the tool's variable, then the
  `TIKOCI_*` variable, then the default. Single-file variables stay the
  tool's own (`CENTRS_CDB_FILE`, rosetta's `DB_PATH`).
- **Existing tool variables keep their meaning.** `QUICKCHR_DATA_DIR` acts as
  `QUICKCHR_HOME` and still moves the cache with it unless a cache variable is
  set, as today. Deprecating one is that tool's CHANGELOG decision.
- **No XDG.** `~/.tikoci` is one visible place on Linux and macOS, as rosetta
  chose for `~/.rosetta`; set `TIKOCI_HOME` to put it elsewhere. Windows uses
  `%LOCALAPPDATA%` because the rest of the profile roams, and VM disks and
  caches are gigabytes.
- **Absolute paths only.** An empty value counts as unset; a relative one, or
  a Windows path without a drive or UNC prefix, is an error.

## Where a file goes

Ask in order:

| Question | If yes |
| --- | --- |
| Can it be rebuilt without loss, and is it the same for everyone? (images, rosetta DBs, MIBs) | **cache**: `$TIKOCI_CACHE_DIR/<tool>/` |
| Does it claim a host resource? (ports, disk space, running VMs, system services) | **user root** (or host, if root-owned), never a project directory |
| Does it describe a project, and should it live with it? (settings defaults, a project CDB, a lab manifest) | **workspace** `.tikoci/<tool>/` |
| Does it exist only while a process runs? | **runtime** `run/<tool>/` of the run's root |
| Otherwise (config, credentials, durable state) | **user root** `<tool>/` |

Rules per class:

- **config** is `<tool>.env`: `KEY=value` with the variable names, so a
  setting has one name everywhere. Never a file called `.env`. No secrets.
- **secrets** are owner-only (directory 0700, file 0600). No OS keychain in a
  sandbox.
- **state** is written atomically (temp file, rename). Nothing a tool creates
  needs a manual `rm -rf` to clear.
- **cache** is immutable, named by version, without secrets, capped, and
  evicted oldest first, **only by an owner run**, using the size policy in the
  user root. State never refers to a cache entry by path: an entry that state
  needs again later (quickchr's factory image for reset and rollback) is
  re-fetched on demand or protected by a lease. Locks and leases for a cache
  live in the cache root, so every root sharing it sees them; a CI cache step
  excludes leases.
- **runtime** files follow the root of the run that made them. A long-running
  process records the absolute paths it started with in its state, and later
  commands read them from there instead of resolving the env again. Unix
  socket paths stay within 103 bytes (macOS `sun_path` is 104 with the NUL):
  check at creation and name the variable to change in the error.
- **host-wide** resources (TCP ports, named pipes, system services) are shared
  by every root. Allocate ports by probing the host and reading the owner's
  claims, not only the current root's state.
- **install** files (completions, a binary and its assets) are written by an
  installer, not at run time. A portable layout with data beside a binary is
  an explicit opt-in.
- **checkout** files (dev databases, extractor caches) stay in the checkout,
  gitignored; temp files go in `os.tmpdir()`, removed by whoever made them.
- A lock lives beside the file it guards, on the same filesystem.

## Resolving paths

- One function per tool resolves its directories, and every caller uses it.
  Workflows and docs name that function or the variable, never a literal path.
- Read the environment at call time from an `env` argument that defaults to
  `process.env`; never resolve a path once at import.
- **A library takes the env (or resolved paths) from its caller**, and a tool
  that calls another tool's library passes its own env through (centrs calling
  `QuickCHR.get()`). Otherwise a sandboxed caller reaches the real setup.
- The home directory is `HOME` (`USERPROFILE` on Windows). Fall back to
  `os.homedir()` only when reading the process environment itself. A supplied
  env with neither the home variable nor `TIKOCI_HOME` has no user root, so no
  default file resolves rather than the developer's real one
  ([centrs#654](https://github.com/tikoci/centrs/issues/654)).
- [scripts/tikoci-paths.ts](scripts/tikoci-paths.ts) is a dependency-free
  reference resolver: copy it, or write the same rules in the tool.

## Workspaces

A workspace is a project directory holding `.tikoci/`, the way a repo holds
`.claude/` or `.github/`.

- **Discovery** walks up from the working directory to the nearest real
  `.tikoci/` directory (not a symlink), stopping before the home directory so
  `~/.tikoci` is never a workspace. `TIKOCI_WORKSPACE` names one, or `none`
  turns discovery off. One workspace per run; workspaces never merge.
- **Created by an explicit command**, never on first use. The command creates
  `.tikoci/` and `<tool>/` owner-only, writes the `.tikoci/.gitignore`, and
  enrolls the workspace.
- **Committed and local files.** As with a project's committed Claude Code
  settings beside a gitignored local file, a project may commit each tool's
  `<tool>/<tool>.env`. Everything else stays local: `<tool>.local.env`
  (personal overrides), secrets, state, project data and `run/`. The
  `.gitignore` the tool writes does exactly that. A tool never syncs a
  workspace.
- **Settings layer, data replaces.** Settings files layer over the user's key
  by key. Workspace data replaces the user's data of the same kind for the run
  (one CDB per run, never a merge), and the tool reports which source it used.
- **Trust follows how a file arrives.** Anything that can come with a clone or
  a `git pull` is limited: the committed `<tool>.env` may set only keys the
  tool allowlists, never credentials or their sources, paths outside the
  workspace, a protocol or transport, weaker connection security, wider agent
  reach, skipped validation, or the `TIKOCI_*` variables. Local files and
  project data (a project CDB, a lab manifest) are not read at all until a
  person enrolls the workspace; then they mean what the user's own would,
  `insecure` or `mcp=rw` included. Enrollment is state in the user root, keyed
  by the workspace's canonical path, and losing it fails closed.
- **Enrollment is never reachable from an agent surface.** An MCP server
  started in the project discovers the workspace too, so no MCP tool or other
  agent-callable API may enroll a workspace or widen its own grants.
- **Host resources stay with the owner.** Machines, ports and services live in
  the user root; a workspace refers to them by name or tags them. A tool that
  does keep guest-held resources in a workspace makes them visible to owner
  runs through the enrollment record.
- **Paths in workspace files** are relative to the project directory and must
  stay inside it once symlinks are followed, including through directories
  that exist when the file does not yet; absolute paths and `~` are refused.
  `.tikoci/` and its tool directories are real directories with mode 0700.
- **Bun loads `.env` from the working directory**, even for a CLI whose
  shebang is `#!/usr/bin/env bun`
  ([centrs#666](https://github.com/tikoci/centrs/issues/666)), which bypasses
  every rule above. Use `#!/usr/bin/env -S bun --no-env-file`, and pass
  `--no-env-file` when running `bun <file>`, which ignores the shebang.

## Sandboxes

`TIKOCI_SANDBOX=<dir>` makes the run a disposable guest of the user's setup:

- config, secrets and state come only from `<dir>/<tool>/`, runtime files go
  under `<dir>/run/`, and nothing is read from the user root except host
  resource claims (read-only) and the cache location;
- no workspace discovery (unless `TIKOCI_WORKSPACE` names one), no legacy
  path, no OS keychain;
- the shared cache is read and added to, never evicted;
- no host service is created, restarted or removed (no sudo), and ports are
  never taken from the owner's machines, stopped ones included;
- no other program's files are written (`~/.ssh/known_hosts`, shell rc files).

A harness builds the child's env from an allowlist instead of copying
`process.env`, since the tool cannot tell an inherited `CENTRS_CDB_FILE` from
one the test set. CI uses a fixed sandbox path (`$RUNNER_TEMP/tikoci-sandbox`)
so upload steps can find failure reports and logs. Details and acceptance
cases: [references/isolation.md](references/isolation.md).

## Settings precedence

1. CLI flags and API arguments
2. Environment variables
3. Workspace `<tool>.local.env` (enrolled), then committed `<tool>.env` (allowlisted)
4. User `$TIKOCI_HOME/<tool>/<tool>.env`, or the sandbox's own
5. Built-in defaults

A sandbox has no user layer. Tool-specific layers slot in where the tool has
them (centrs' CDB comment `key=value` sits below the environment). Per tool:
[references/settings.md](references/settings.md).

## Legacy paths and migration

- **The tool picks the unit**: an item (centrs' CDB) or a whole tree
  (quickchr's data dir, so machines never split across two trees).
- **The legacy unit stays in charge until migrated.** The tool reads and
  writes it there and prints a one-line notice on stderr naming the migrate
  command. While it exists, first-run auto-create and first writes go to the
  legacy path too, so a first run never makes a second, empty copy.
- **Migration is explicit**, safe to re-run, copies then verifies, and refuses
  while the unit is in use (a running VM, a held lock).
- **Older copies keep working.** Other tools bundle older versions (centrs,
  restraml and tikbook each bundle quickchr). Where they must keep finding the
  data, migrate leaves a symlink at the legacy path pointing to the new
  location, so there is still one live copy; otherwise it renames the legacy
  unit. Never delete legacy data automatically.
- **Sandboxes never read legacy paths.** Dropping legacy support is a
  CHANGELOG entry, at least one release after migrate ships.

## Sources

[references/sources.md](references/sources.md) lists the code, docs, reviews
and survey rows behind each rule. Planning: Phase 2 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
