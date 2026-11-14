---
name: tikoci-home
description: "Where tikoci tools keep files: the user scope TIKOCI_HOME (default ~/.tikoci, %LOCALAPPDATA%\\tikoci on Windows, no XDG) and a project's .tikoci/, the nearest one above the working directory and below home. Each tool owns TOOL/ in each scope and every format in it; other tools use it through its library or CLI, never its files. tikoci does not define the directory around .tikoci/ or how it is shared. .tikoci/TOOL/ travels (no secrets, allowlisted settings); .tikoci/TOOL/local/ never does, and is read only when private to the user and its id matches a trust record in the tool's user scope, made at the CLI, never via MCP. Cache in TIKOCI_CACHE_DIR, runtime in run/TOOL/. TIKOCI_SANDBOX replaces the user scope for tests: no project, legacy path or keychain, and no eviction of the shared cache. A supplied env without HOME has no user scope. Use when adding a file a tool keeps outside the checkout, an env override, a settings layer, a cache or a test that touches user state."
---

# tikoci tool files

Where tikoci tools (quickchr, centrs, rosetta and the rest) keep config,
secrets, state, caches and runtime files, for the user and for a project.

This is the target layout. No tool uses it yet: each repo adopts it on its own
schedule, and until then the tool's current paths stand. Every file each tool
keeps, today and under this layout, is in
[references/layout.tsv](references/layout.tsv), explained in
[references/layout.md](references/layout.md).

## Two scopes

```text
~/.tikoci/                    user scope (TIKOCI_HOME)
  <tool>/                     the tool's own files
    <tool>.env                user settings
  cache/<tool>/               files that can be fetched again
  run/<tool>/                 sockets, pid files and live locks

<dir>/.tikoci/                project scope
  <tool>/
    <tool>.env                settings that travel with the directory
    ...                       the tool's other traveling files
    .gitignore                "local/", written by the tool
    local/                    this user on this machine; never travels
      id                      the project's id for this tool
      <tool>.env              personal settings
      ...                     credentials, state
```

- **Each tool owns `<tool>/` in each scope** and every format in it. No tool
  reads or writes another tool's directory. A tool that builds on another
  (centrs on quickchr, anything on centrs) calls its library or CLI and
  passes its env along.
- **tikoci defines `.tikoci/`, not the directory around it.** How a project
  is organized, and whether it is shared through git, Dropbox, an SMB share
  or not at all, is up to its owner.
- **Nothing is shared at the top of `.tikoci/`.** Files that several tools
  read wait until there is a written standard for them. `cache` and `run` are
  not tool names.

Every file has one of four lives:

| Life | Where | Holds | Secrets |
| --- | --- | --- | --- |
| travels | `.tikoci/<tool>/` | what the directory means to the tool: settings defaults, machine definitions | never |
| local | `~/.tikoci/<tool>/`, `.tikoci/<tool>/local/` | credentials, state, personal settings, trust records | owner-only |
| cache | `$TIKOCI_CACHE_DIR/<tool>/` | images, docs databases, MIBs | never |
| run | `$TIKOCI_RUNTIME_DIR/<tool>/` | sockets, pid files, live locks | never |

## Variables

| Variable | Default | Sets |
| --- | --- | --- |
| `TIKOCI_HOME` | `~/.tikoci` | the user scope (moving it, nothing else) |
| `TIKOCI_CACHE_DIR` | `$TIKOCI_HOME/cache` | the cache root |
| `TIKOCI_RUNTIME_DIR` | `<user scope>/run` | the runtime root |
| `TIKOCI_PROJECT` | discovered | a directory holding `.tikoci/`, or `none` |
| `TIKOCI_SANDBOX` | unset | a sandbox that replaces the user scope (tests) |
| `<TOOL>_HOME` | `<user scope>/<tool>` | one tool's user directory |
| `<TOOL>_CACHE_DIR` | `<cache root>/<tool>` | one tool's cache |
| `<TOOL>_<KEY>` | the settings files | one setting, same name as in `<tool>.env` |

`<TOOL>` is the tool name in upper case with `-` as `_` (`ROUTEROS_MUSE`).

- **Precedence**: flag, then the tool's variable, then the `TIKOCI_*`
  variable, then the default. **A sandbox is the exception**: it replaces the
  whole user scope, so `TIKOCI_SANDBOX` wins over `TIKOCI_HOME` and over every
  tool home variable (`<TOOL>_HOME`, `QUICKCHR_DATA_DIR`). File and cache
  variables a test sets on purpose (`CENTRS_CDB_FILE`, `<TOOL>_CACHE_DIR`)
  still win.
- **Existing tool variables keep their meaning.** `QUICKCHR_DATA_DIR` acts as
  `QUICKCHR_HOME` and still moves the cache with it unless a cache variable is
  set, as today. Deprecating one is that tool's CHANGELOG decision.
- **No XDG.** `~/.tikoci` is one visible place on Linux and macOS, as rosetta
  chose for `~/.rosetta`. Windows uses `%LOCALAPPDATA%` because the rest of the
  profile roams, and VM disks and caches are gigabytes.
- **Absolute paths only.** An empty value counts as unset; a relative one, or
  a Windows path without a drive or UNC prefix, is an error.

## Finding the project

- **The nearest `.tikoci/`** above the working directory is the project,
  whether or not it has a directory for this tool, so every tool in a run
  agrees on it. A nested `.tikoci/` replaces an outer one; projects never
  stack. `.tikoci/` must be a real directory, not a symlink.
- **The walk stops before the home directory.** `~/.tikoci` is the user
  scope, and reading it as a project would treat the user's own files as
  untrusted ones. Without a known home, nothing is discovered.
- **`TIKOCI_PROJECT`** names a project explicitly, or turns discovery off with
  `none`. A tool that calls another tool's library passes the project it
  found (`TIKOCI_PROJECT=<dir>`), so the two cannot pick different projects.
- **A library takes `{ env, cwd }`** (or an explicit project) from its caller
  and never reads `process.cwd()`: an MCP server or an editor extension runs
  from anywhere.
- **Report the project used**, or that there was none, in the tool's
  effective-settings output.

## What travels and what stays local

**Traveling files** (`.tikoci/<tool>/` outside `local/`) can come from
anyone. They hold no secrets. The settings file may set only the keys the
tool allowlists: never credentials or their sources, paths outside the
project, a protocol or transport, weaker connection security, wider agent
reach, skipped validation, host or cache policy, or `TIKOCI_*` variables.
A traveling file that can reach outside the tool (a network address, a
provisioning script, a disk size, a port forward, a network) is read only
when the project is trusted.

**`local/` is read only when both hold:**

1. it is a real directory owned by the current user with mode 0700 (secret
   files 0600), checked as OpenSSH checks key files. Most sync tools reset
   modes, so a synced `local/` fails by default. Windows relies on the
   inherited ACL.
2. its `id` matches a trust record in the tool's user scope
   (`<tool>/projects/<id>/project.json`) that names this project's canonical
   path.

Otherwise the tool ignores everything in `local/`, settings included, and
says why. Being gitignored proves nothing: a repo can force-add `local/`.

| What happened | Result |
| --- | --- |
| Fresh clone, new worktree, or `local/` arrived from elsewhere | untrusted: no record for this id |
| `cp -r`, a restore, or a sync that carried `local/` | copied: the id's record names another path that still has it; trusting gives a new id |
| The directory was moved | moved: the recorded path no longer has the id; trusting keeps the id, so machines and records follow |
| `local/` readable by others or a symlink | unsafe; trusting tightens it and gives a new id |

- **Trust is a person's act at the CLI**: the tool's `trust` command, or an
  init command that creates project data (centrs' `devices init`). It asks
  for confirmation on a terminal, has a distinct name so a harness can deny
  it, and is never reachable from MCP or another agent API. Each tool keeps
  its own records. Trusting lets the tool read the project's files; using
  credentials, provisioning or writing to devices is still each tool's own
  decision and its own gates.
- **This is cooperative, not a security boundary.** An agent with an
  unrestricted shell as the same OS user can edit the user scope directly.
  Containing that is the harness's permission rules, a separate OS user or a
  container.
- **One scope per item.** In a project, a tool uses the project's data of a
  kind instead of the user's for that run (centrs' project CDB, quickchr's
  project machines). It never merges the two, reports which scope it used,
  and when a name is not found says if the other scope has it.
- **Things keyed by a project** (quickchr's project machines) get a qualified
  name that works from anywhere.
- **The `.gitignore`** each tool writes in `.tikoci/<tool>/` contains
  `local/`, so a git user is covered without tikoci assuming git. Anything
  else that copies a project should leave out `local/` too.

## Where a file goes

| Question | If yes |
| --- | --- |
| Can it be fetched or rebuilt again, and is it the same for everyone? (images, rosetta databases, MIBs) | **cache** |
| Does it exist only while a process runs? | **run** |
| Does it say what a project means to the tool, with no secrets? | **travels**: `.tikoci/<tool>/` |
| Is it about a project, but only for this user on this machine? Small? | **local**: `.tikoci/<tool>/local/` |
| Large, or must it outlive a moved or deleted directory? (VM disks) | the **user scope**, under `<tool>/projects/<id>/` |
| Otherwise (config, credentials, durable state) | the **user scope**: `<tool>/` |

Rules per class:

- **config** is `<tool>.env`: `KEY=value` with the variable names, so a
  setting has one name everywhere. Never a file called `.env`. Files people
  edit by hand (machine definitions) are TOML; a tool's own state is JSON.
- **secrets** are owner-only (directory 0700, file 0600), never in a
  traveling file, never in a sandbox keychain.
- **state** is written atomically (temp file, rename). Nothing a tool creates
  needs a manual `rm -rf` to clear. State that other versions of the same
  tool read (bundled copies of a library) stays readable by them.
- **cache** entries are immutable and named by everything that matters
  (version, architecture, digest), written under a temporary name and
  renamed, with no secrets. Readers hold a lease, kept in the cache root so
  every scope sharing it sees it. Only the user's own runs evict, with the
  tool's own policy; a sandbox evicts only a cache inside itself. State never
  refers to a cache entry by path: an entry it needs later is leased or
  fetched again.
- **run** files go in `$TIKOCI_RUNTIME_DIR/<tool>/`, under short names, not in
  a state directory whose length grows. A long-running process records the
  paths it started with in its state, and later commands read them there. A
  record of a process holds its pid, the boot id and the process start time
  or arguments, since pids are reused (in a replaced container especially).
  Unix socket paths stay within 103 bytes (macOS `sun_path` is 104 with the
  NUL): check at creation and name the variable to change in the error.
- **host-wide** resources (ports, system services) are not in any scope. The
  tool that allocates ports (quickchr) computes claims from durable state in
  its user scope, serializes allocation with a lock at a fixed host path
  outside any scope and the temp directory, and probes before use; sandboxes
  allocate from their own range. Host services are never touched from a
  sandbox and never created by a project file.
- **install** files (completions, a binary and its assets) are written by an
  installer, not at run time.
- **checkout** files (dev databases, extractor caches) stay in the checkout,
  gitignored; temp files go in `os.tmpdir()`, removed by whoever made them.
- A lock lives beside the file it guards, on the same filesystem.

## Resolving paths

- One function per tool resolves its directories, and every caller uses it.
  Workflows and docs name that function or the variable, never a literal path.
- Read the environment at call time from an `env` argument that defaults to
  `process.env`; never resolve a path once at import.
- **A library takes the env and cwd from its caller**, and a tool that calls
  another tool's library passes its own through (centrs calling
  `QuickCHR.get()`). Otherwise a sandboxed caller reaches the real setup.
- **The home directory** is `HOME` (`USERPROFILE` on Windows). Fall back to
  `os.homedir()` only when reading the process environment itself. A supplied
  env with neither the home variable nor `TIKOCI_HOME` has no user scope: no
  default file resolves, no project is discovered and nothing is trusted
  ([centrs#654](https://github.com/tikoci/centrs/issues/654)).
- [scripts/tikoci-paths.ts](scripts/tikoci-paths.ts) is a dependency-free
  reference resolver (`resolveTikociPaths`, `checkProject`, `trustProject`,
  `hermeticEnv`): copy it, or write the same rules in the tool.
- **Bun loads `.env` from the working directory**, even for a CLI whose
  shebang is `#!/usr/bin/env bun`
  ([centrs#666](https://github.com/tikoci/centrs/issues/666)), which bypasses
  every rule above. Use `#!/usr/bin/env -S bun --no-env-file`, and pass
  `--no-env-file` when running `bun <file>`, which ignores the shebang.

## Sandboxes

`TIKOCI_SANDBOX=<dir>` replaces the user scope for a test or CI run:

- config, secrets, state and trust records come only from `<dir>/<tool>/`,
  runtime files go under `<dir>/run/`;
- no project is discovered (`TIKOCI_PROJECT` can name one, whose `local/` is
  then read only with a trust record made inside the sandbox);
- no legacy path, no OS keychain, no host service, no sudo, and no other
  program's files (`~/.ssh/known_hosts`, shell rc files);
- the shared cache is read and added to, never evicted, unless the test
  points `TIKOCI_CACHE_DIR` inside the sandbox to own a private one.

A harness builds the child's env from an allowlist instead of copying
`process.env`, since a tool cannot tell an inherited variable from one the
test set. CI uses a fixed sandbox path (`$RUNNER_TEMP/tikoci-sandbox`) so
upload steps find logs and failure reports; macOS harnesses start from `/tmp`
to keep socket paths short. Details and acceptance cases:
[references/isolation.md](references/isolation.md).

## Settings precedence

1. CLI flags and API arguments
2. Environment variables
3. Tool-specific layers (centrs' CDB comment `key=value`)
4. Project `local/<tool>.env` (trusted)
5. Project `<tool>.env` (allowlisted keys)
6. User `<tool>.env`, or the sandbox's own
7. Built-in defaults

Host and cache policy (`cache-max-size`, `accel`) comes only from layers 1, 2
and 6. Per tool: [references/settings.md](references/settings.md).

## Legacy paths and migration

- **The tool picks the unit**: an item (centrs' CDB) or a whole tree
  (quickchr's data dir, so machines never split across two trees).
- **The legacy unit stays in charge until migrated.** The tool reads and
  writes it there and prints a one-line notice on stderr naming the migrate
  command. While it exists, first-run auto-create and first writes go to the
  legacy path too, so a first run never makes a second, empty copy. Project
  data is never auto-created.
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
