---
name: tikoci-home
description: "Where tikoci tools keep files outside a checkout. Config, secrets and state go in one directory per tool under TIKOCI_HOME (default ~/.tikoci; %LOCALAPPDATA%\\tikoci on Windows; no XDG); caches under TIKOCI_CACHE_DIR; sockets, pid files and live locks under TIKOCI_RUNTIME_DIR, within the socket path limit. A workspace is the nearest .tikoci/ above the working directory, never ~/.tikoci; its settings file may set only allowlisted keys (no credentials, outside paths, transport or weaker security), and its data (a project CDB) is read only once enrolled, then replaces the user data. TIKOCI_PINNED=1 with TIKOCI_HOME pins a test run: no workspace, legacy paths or keychain, cache reused. A supplied env without HOME has no user root. Each legacy item stays authoritative until an explicit migrate. Use when adding a file a tool keeps outside the checkout, an env override, a settings file or layer, a cache, a test that touches user state, or a move from ~/.config, ~/.local/share or ~/.rosetta."
---

# tikoci tool files

Where tikoci tools (quickchr, centrs, rosetta and the rest) keep config,
secrets, state, caches and runtime files, how a project workspace adds to
them, and how a test run keeps away from the developer's own files.

This is the target layout. No tool uses it yet: each repo adopts it on its own
schedule, and until then the tool's current paths stand. The per-tool map of
what exists today and where it goes is
[references/layout.tsv](references/layout.tsv), explained in
[references/layout.md](references/layout.md).

## Roots

| Variable | Default | Holds |
| --- | --- | --- |
| `TIKOCI_HOME` | `~/.tikoci`; `%LOCALAPPDATA%\tikoci` on Windows | `<tool>/`: config, secrets, state |
| `TIKOCI_CACHE_DIR` | `$TIKOCI_HOME/cache` | `<tool>/`: reusable caches |
| `TIKOCI_RUNTIME_DIR` | `$TIKOCI_HOME/run` | `<tool>/`: sockets, pid files, live locks |
| `TIKOCI_WORKSPACE` | discovered (see Workspaces) | a directory holding `.tikoci/`, or `none` |
| `TIKOCI_PINNED` | unset | `1` pins a run to its `TIKOCI_HOME` (see Pinned runs) |

- **One directory per tool**, named after the tool's package or command
  (`quickchr`, `centrs`, `rosetta`). A tool reads and writes only its own
  directory in each root; it reaches another tool's data through that tool's
  library or CLI, never its files.
- **Same layout on Linux and macOS, no XDG.** `~/.tikoci` is one visible place
  on every machine, as rosetta chose for `~/.rosetta`. `XDG_*` variables are
  ignored; set `TIKOCI_HOME` to put the tree elsewhere.
- **Windows uses `%LOCALAPPDATA%`**, because everything else in the profile
  roams, and VM disks and caches are gigabytes.
- **Variables must be absolute paths.** An empty value counts as unset; a
  relative one is an error, not a path from the current directory.
- **`TIKOCI_HOME` only relocates.** A user who sets it in a shell profile keeps
  workspaces, legacy paths and the keychain; isolating a run is a separate
  switch, `TIKOCI_PINNED`.

## Classes of file

| Class | Where | Back up | Rules |
| --- | --- | --- | --- |
| config | `$TIKOCI_HOME/<tool>/<tool>.env`, workspace `.tikoci/<tool>/<tool>.env` | yes | `KEY=value` with the env variable names, so every setting has one name. Never a file called `.env`. |
| secret | `$TIKOCI_HOME/<tool>/` or the workspace tool directory | yes | Owner-only: directory 0700, file 0600. No OS keychain in a pinned run. |
| state | `$TIKOCI_HOME/<tool>/` or the workspace tool directory | per item | Written atomically (temp file, rename). Nothing the tool creates needs a manual `rm -rf` to clear. |
| cache | `$TIKOCI_CACHE_DIR/<tool>/` | no | Can be rebuilt; immutable, named by version, no secrets. Shared by every root. |
| runtime | `$TIKOCI_RUNTIME_DIR/<tool>/` | no | Exists only while a process runs; removed or replaced on the next start. |
| host-wide | the OS's system locations | no | Root-owned services and files shared by every user. Never under a user root. |
| install | where the installer or shell puts it | no | Read at run time, not written: completions, a compiled binary and its assets. |

Checkout files (dev databases, extractor caches) stay in the checkout,
gitignored, and temp files go in `os.tmpdir()`, removed by whoever made them.

- **A cache is anything safe to share between roots.** State never refers to a
  cache entry by path. An evictor in one root cannot see another root's state,
  so state that needs an entry again later (quickchr's reset and rollback need
  the factory image) either fetches it again on demand or holds a lease in the
  cache root. The locks and leases that guard a cache live in the cache root,
  so every root sharing it sees them. Each cache is capped and evicts oldest
  first.
- **A lock lives beside the file it guards** (centrs' CDB lock, rosetta's
  download lock), on the same filesystem, so rename stays atomic.
- **Keep Unix socket paths within 103 bytes** (macOS `sun_path` is 104 with
  the terminating NUL). Check the length when the socket is created and fail
  with an error that names `TIKOCI_RUNTIME_DIR`; do not let QEMU or the OS fail
  later with a vague one.
- **Host-wide resources are not partitioned by root.** TCP ports, named pipes
  and system services are shared by every root on the host, so allocate them
  by probing the host, not only by reading one root's state.
- **Do not write other programs' files** in a pinned run: `~/.ssh/known_hosts`,
  shell rc files, editor settings. Use a file under the root instead.

## Resolving paths

- One function per tool resolves its directories, and every caller uses it.
  Workflows and docs name that function or the variable, never a literal path.
- Read the environment at call time, from an `env` argument that defaults to
  `process.env`. Never resolve a path once at import: tests change the
  environment after import, and spawned children get only what they are given.
- The home directory is `HOME` on Linux and macOS, `USERPROFILE` on Windows.
  Fall back to `os.homedir()` only when reading the process environment
  itself. A caller-supplied env with neither the home variable nor
  `TIKOCI_HOME` has no user root: no default file resolves, rather than the
  developer's real one (the unit-test half of
  [centrs#654](https://github.com/tikoci/centrs/issues/654)). Bun also reads
  `os.homedir()` once at startup, so it misses later changes to `HOME`.
- [scripts/tikoci-paths.ts](scripts/tikoci-paths.ts) is a dependency-free
  reference resolver: copy it, or write the same rules in the tool. The text
  here is the contract.

## Workspaces

A workspace is a project directory holding `.tikoci/`, with one subdirectory
per tool (`.tikoci/centrs/` holds a project CDB, `centrs.env` and `centrs.db`).

- **Discovery** walks up from the working directory to the nearest directory
  containing a real `.tikoci/` directory (a symlink does not count). It stops
  before the user's home directory, so `~/.tikoci` is never a workspace.
  `TIKOCI_WORKSPACE` names one directly, or `none` turns discovery off.
- **The nearest workspace wins**, and there is one per run. Workspaces do not
  merge with each other.
- **Settings layer, data replaces.** A workspace settings file layers over the
  user's key by key. Workspace data replaces the user's data of the same kind
  for the run instead of merging with it: one CDB per run, never two, so
  names cannot collide. The tool reports which source it used (centrs'
  `meta.settings`).
- **Created only by an explicit command**, never on first use. The tool creates
  `.tikoci/` with mode 0700 and a `.gitignore` containing `*`, so its contents
  are never committed. A tool never syncs a workspace; a push/pull scheme is a
  separate tool's job.
- **Paths in workspace files are relative to the workspace** (the directory
  holding `.tikoci/`) and must stay inside it once symlinks are followed,
  including through directories that exist when the file does not yet.
  Absolute paths and `~` are refused. `.tikoci/` and its tool directories must
  be real directories, not links; the tool tightens their modes to 0700.
- **Trust boundary.** A cloned repo can ship a `.tikoci/`, so its files are
  untrusted input. A workspace settings file applies without enrollment, so
  each tool lists the keys it may set; every other key is refused with a
  warning. Never allowed from a workspace settings file:
  - credentials, or anything that names where credentials come from
    (password commands, key files, CDB passwords, a CDB outside the workspace);
  - weaker connection security (TLS verification or host key checks off), or
    a choice of protocol or transport, which can downgrade one;
  - wider reach for agents (MCP ad hoc targets, read-write grants) or skipped
    validation gates;
  - the tikoci root variables themselves.
- **Workspace data needs enrollment, and then is trusted.** Filtering keys does
  not make data safe: a cloned project CDB can map a familiar device name to
  another address, and the user's own credentials would follow it. A tool does
  not read workspace data (targets, identities, credentials, authorization)
  at all until the user enrolls that workspace from outside it. Once
  enrolled, it has the same meaning as the user's own data: a project lab CDB
  can say `insecure` for self-signed CHR certificates or grant an agent
  read-write. The explicit command that creates a workspace enrolls it; one
  that arrived with a clone needs a separate trust command. Enrollment is
  state in `$TIKOCI_HOME/<tool>/`, keyed by the workspace's canonical path;
  losing it fails closed.
- **Enrollment is never reachable from an agent surface.** An MCP server
  started in the project directory discovers the workspace too, so no MCP tool
  (or other agent-callable API) may enroll a workspace or widen its own
  grants. Only a person running the CLI does.
- **Bun loads `.env` from the working directory**, and a CLI whose shebang is
  `#!/usr/bin/env bun` gets it too
  ([centrs#666](https://github.com/tikoci/centrs/issues/666)), past the
  workspace allowlist. Use `#!/usr/bin/env -S bun --no-env-file`, and pass
  `--no-env-file` explicitly when running `bun <file>`, which ignores the
  shebang.

## Settings precedence

Storage and precedence are separate questions. The house order is:

1. CLI flags and API arguments
2. Environment variables
3. Workspace `.tikoci/<tool>/<tool>.env` (allowlisted keys)
4. User `$TIKOCI_HOME/<tool>/<tool>.env`
5. Built-in defaults

Tool-specific layers slot in where the tool already has them (centrs' CDB
comment `key=value` sits between environment and the files). Where each tool's
layers are today, and what adoption changes, is in
[references/settings.md](references/settings.md).

## Pinned runs and test isolation

`TIKOCI_PINNED=1` together with `TIKOCI_HOME` pins a run to that root:

- config, secrets and state come only from `$TIKOCI_HOME/<tool>/`;
- no workspace discovery, unless `TIKOCI_WORKSPACE` names one;
- no legacy path is read;
- no OS keychain: secrets stay in owner-only files under the root;
- no other program's files are written (`~/.ssh/known_hosts`, shell rc files);
- cache and runtime files go where `TIKOCI_CACHE_DIR` and
  `TIKOCI_RUNTIME_DIR` say, else under the root.

`TIKOCI_PINNED=1` without `TIKOCI_HOME` is an error. A test harness builds the
child's environment from an allowlist rather than copying `process.env`
(the tool cannot tell an inherited `CENTRS_CDB_FILE` from one the test set),
then sets `TIKOCI_HOME` to a temp directory, `TIKOCI_PINNED=1`, and
`TIKOCI_CACHE_DIR` to the cache the developer already has. The run cannot see
the developer's CDB, settings, machines or workspace, and still reuses
gigabytes of images and databases. The contract, the acceptance cases and a
harness sketch are in [references/isolation.md](references/isolation.md).

## Legacy paths and migration

- **New items go to the new layout** once a tool adopts it, but only when no
  legacy item of the same kind exists. A first-run auto-create (centrs' empty
  default CDB) or a first write (`centrs settings set`) targets the legacy
  path while that holds the live item; otherwise the first run would make a
  second, empty copy.
- **Each existing item stays where it is until migrated**: the tool reads and
  writes it at the legacy path, so there are never two live copies. It prints a
  one-line notice on stderr, once per run, naming the migrate command.
- **Migration is explicit** (`<tool> migrate` or similar), safe to re-run,
  copies then verifies, and leaves the legacy item in place, renamed or marked.
  It skips items in use (a running VM, a held lock) and says so.
- **Never delete legacy data automatically.** Older installed versions keep
  using the old paths (rosetta's shared `~/.rosetta/ros-help.db`).
- **Pinned runs never read legacy paths.**
- Dropping legacy support is a CHANGELOG entry, at least one release after
  migrate ships.

## Sources

[references/sources.md](references/sources.md) lists the code, docs and survey
rows behind each rule. Planning: Phase 2 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
