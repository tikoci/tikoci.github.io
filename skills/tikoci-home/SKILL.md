---
name: tikoci-home
description: "Where tikoci tools keep files outside a checkout. Config, secrets and state go in one directory per tool under TIKOCI_HOME (default ~/.tikoci; %LOCALAPPDATA%\\tikoci on Windows; XDG is not used). Reusable caches go under TIKOCI_CACHE_DIR, shared by every root; sockets, pid files and live locks under TIKOCI_RUNTIME_DIR, within the socket path limit. A workspace is the nearest .tikoci/ above the working directory, never ~/.tikoci itself; it may set only allowlisted keys, never credentials, paths outside it, a transport or weaker connection security, and its data (a project CDB) counts only once enrolled. Setting TIKOCI_HOME pins a run: no workspace discovery, legacy paths or OS keychain, but the cache is reused, which is how tests isolate. Each legacy item stays authoritative until an explicit migrate. Use when adding a file a tool keeps outside the checkout, an env override, a settings file or layer, a cache, a test that touches user state, or a move from ~/.config, ~/.local/share or ~/.rosetta."
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
| `TIKOCI_CACHE_DIR` | the default root's `cache/` | `<tool>/`: reusable caches |
| `TIKOCI_RUNTIME_DIR` | `$TIKOCI_HOME/run` | `<tool>/`: sockets, pid files, live locks |
| `TIKOCI_WORKSPACE` | discovered (see Workspaces) | a directory holding `.tikoci/`, or `none` |

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
- **The cache root does not follow `TIKOCI_HOME`.** Moving the home for a test
  keeps the cache where it was. Set `TIKOCI_CACHE_DIR` to move it too.

## Classes of file

| Class | Where | Back up | Rules |
| --- | --- | --- | --- |
| config | `$TIKOCI_HOME/<tool>/<tool>.env`, workspace `.tikoci/<tool>/<tool>.env` | yes | `KEY=value` with the env variable names, so every setting has one name. Never a file called `.env`. |
| secret | `$TIKOCI_HOME/<tool>/` or the workspace tool directory | yes | Owner-only: directory 0700, file 0600. OS keychain only in the default root. |
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
- The home directory is `HOME` on Linux and macOS, `USERPROFILE` on Windows,
  then `os.homedir()`. Bun reads `os.homedir()` once at startup, so a test that
  changes `HOME` later is seen only through the variable.
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
  merge; a workspace layers over the user root key by key.
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
  untrusted input. Each tool lists the keys a workspace may set; every other
  key is refused with a warning. Never allowed from a workspace:
  - credentials, or anything that names where credentials come from
    (password commands, key files, CDB passwords, a CDB outside the workspace);
  - weaker connection security (TLS verification or host key checks off), or
    a choice of protocol or transport, which can downgrade one;
  - wider reach for agents (MCP ad hoc targets, read-write grants) or skipped
    validation gates;
  - the tikoci root variables themselves.
- **Workspace data needs enrollment.** Filtering keys does not make a
  workspace's data safe: a cloned project CDB can map a familiar device name to
  another address, and the user's own credentials would follow it. A tool uses
  workspace data as a source of targets, identities, credentials or
  authorization only after the user enrolls that workspace from outside it: the
  explicit command that creates the workspace enrolls it, and so does a
  separate `<tool> trust`-style command for one that arrived with a clone.
  Enrollment is state in `$TIKOCI_HOME/<tool>/`, keyed by the workspace's
  canonical path. An unenrolled workspace still gets its allowlisted
  settings.
- **Bun loads `.env` from the working directory** for scripts it runs. A tool
  started by `bun` inside a cloned repo can be handed variables that way, past
  the workspace allowlist. Tools that read security-relevant variables should
  run with `--no-env-file` or refuse those from a `.env`.

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

Setting `TIKOCI_HOME` pins a run to that root:

- config, secrets and state come only from `$TIKOCI_HOME/<tool>/`;
- no workspace discovery, unless `TIKOCI_WORKSPACE` names one;
- no legacy path is read;
- no OS keychain: secrets stay in owner-only files under the root;
- the cache is still the user's, unless `TIKOCI_CACHE_DIR` says otherwise;
- runtime files follow the root, unless `TIKOCI_RUNTIME_DIR` says otherwise.

A test sets one variable and gets a run that cannot see the developer's CDB,
settings, machines or workspace, while reusing gigabytes of images and
databases. The tool cannot tell an inherited variable from one the test set,
so the test builds the child's environment from an allowlist rather than
copying `process.env`. The contract, the acceptance cases and a harness
sketch are in [references/isolation.md](references/isolation.md).

## Legacy paths and migration

- **New items go to the new layout** once a tool adopts it.
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
