---
name: tikoci-home
description: "Where tikoci tools keep files: the user scope TIKOCI_HOME (default ~/.tikoci, %LOCALAPPDATA%\\tikoci on Windows, no XDG) and a project's .tikoci/, the nearest one above the working directory and below home. Each tool owns TOOL/ in each scope; other tools use it through its library or CLI, never its files. tikoci does not define the directory around .tikoci/ or how it is shared. .tikoci/TOOL/ travels (no secrets, allowlisted settings); .tikoci/TOOL/local/ never does, is read only when private and trusted at the CLI, and a git worktree uses its main checkout's. Cache in TIKOCI_CACHE_DIR, runtime in run/TOOL/, port claims in the host scope. TIKOCI_SANDBOX replaces the user scope for tests: no project, legacy path or keychain, no eviction of the shared cache. Names across scopes: name, user:name, label:name. Repos adopt it in profiles. Use when adding a file a tool keeps outside the checkout, an env override, a settings layer, a cache, a cross-tool reference or a test that touches user state."
---

# tikoci tool files

Where tikoci tools (quickchr, centrs, rosetta and the rest) keep config,
secrets, state, caches and runtime files, for the user and for a project.

This is the target layout. No tool uses it yet: each repo adopts it on its own
schedule, and until then the tool's current paths stand. Every file each tool
keeps, today and under this layout, is in
[references/layout.tsv](references/layout.tsv), explained in
[references/layout.md](references/layout.md).

## Adopting in profiles

A repo adopts the parts it needs, not the whole skill: rosetta needs the user
scope and a cache, centrs project data first, quickchr the host scope long
before projects. The rules are grouped into profiles. A repo names the ones
it implements in its AGENTS.md `## House skills` entry, for example
`tikoci-home (copied): user, cache, sandbox, host`.

| Profile | Rules | Needs |
| --- | --- | --- |
| `user` | [Variables](#variables), the user scope, [Resolving paths](#resolving-paths), [Legacy paths and migration](#legacy-paths-and-migration) | — |
| `cache` | the cache class in [Where a file goes](#where-a-file-goes): immutable entries, live leases, the root's owner evicts, state never depends on an entry | `user` |
| `sandbox` | [Sandboxes](#sandboxes) and [references/isolation.md](references/isolation.md) | `user` |
| `host` | the host-wide class: host-scope claims, attach but never create a host service | `user` |
| `project` | [Finding the project](#finding-the-project), traveling files and their allowlist, [Settings precedence](#settings-precedence) with project layers, definitions are not settings | `user` |
| `project-data` | `local/`, both `.gitignore` files, trust, fail closed, "holds data", git worktrees using the main checkout's `local/` | `project` |
| `per-checkout` | state realized per checkout, reused paths, prune releasing host claims | `project-data`, `host` |
| `names` | [Names across scopes](#names-across-scopes), label rules and derivation | a tool with named things in two scopes |

- **A tool that has not adopted `project` ignores `.tikoci/` entirely.** It
  never discovers a project halfway or reads part of one. Being user-only is
  an aligned state, not drift; half an adoption (discovery without the trust
  rules) is the case to avoid.
- **Mixed runs work through reporting.** In one project, centrs at
  `project-data` uses the project CDB while a quickchr at `user` uses the
  user's machines; each reports the scope it used. A library without
  `project` ignores a `TIKOCI_PROJECT` it is passed. A tool without `names`
  rejects `label:name` with an error that says so, rather than reading it as
  a literal name.
- **Conformance cases carry profiles.** Each case in
  [references/conformance.json](references/conformance.json) lists the
  profiles it needs, and each field it checks belongs to a profile; a repo
  runs the cases it can and compares only its profiles' fields.
- **Open items belong to no profile** (how trust is recorded, naming one
  worktree's instance) until a later revision of this skill adds them, so
  nobody implements a guess.

## Two scopes

```text
~/.tikoci/                    user scope (TIKOCI_HOME)
  <tool>/                     the tool's own files
    <tool>.env                user settings
  cache/<tool>/               files that can be fetched again
  run/<tool>/                 sockets, pid files and live locks
  host/<tool>/                claims on this host's ports and services


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
  read wait until there is a written standard for them. `cache`, `run` and
  `host` are not tool names. The first shared standard is how tools name each
  other's things ([Names across scopes](#names-across-scopes)), not a file.

Every file has one of these lives:

| Life | Where | Holds | Secrets |
| --- | --- | --- | --- |
| travels | `.tikoci/<tool>/` | what the directory means to the tool: settings defaults, machine definitions | never |
| local | `~/.tikoci/<tool>/`, `.tikoci/<tool>/local/` | credentials, state, personal settings, trust records | owner-only |
| cache | `$TIKOCI_CACHE_DIR/<tool>/` | images, docs databases, MIBs | never |
| run | `$TIKOCI_RUNTIME_DIR/<tool>/` | sockets, pid files, live locks | never |
| host | `~/.tikoci/host/<tool>/` | the allocation lock, port claims, which context made a host service | never |

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
  stack. `.tikoci/` must be a real directory, not a symlink, and on POSIX
  owned by the current user (as git's `safe.directory` asks); the walk skips
  any other, so a `.tikoci/` planted in `/tmp` cannot hide the user's data.
- **The walk stops before the home directory.** `~/.tikoci` is the user
  scope, and reading it as a project would treat the user's own files as
  untrusted ones. Without a known home, nothing is discovered.
- **The walk never leaves a git worktree into its own main checkout.** A
  worktree in `.worktrees/` or `.claude/worktrees/` on a branch with no
  `.tikoci/` (one cut before adoption) has no project, the same as a worktree
  anywhere else. A directory above an unrelated checkout (a lab folder holding
  several repos) still counts. The tool reports the project the main checkout
  uses at the same place, so the user sees that the main checkout has project
  data and how to name it; nothing is read from it.
- **`TIKOCI_PROJECT`** names a project explicitly, or turns discovery off with
  `none`. A tool that calls another tool's library passes the project it
  found (`TIKOCI_PROJECT=<dir>`), so the two cannot pick different projects.
- **A library takes `{ env, cwd }`** (or an explicit project) from its caller
  and never reads `process.cwd()`: an MCP server or an editor extension runs
  from anywhere.
- **Report the project used**, or that there was none, in the tool's
  effective-settings output, and any `.tikoci/` the walk passed over. On an
  SMB or NFS share, uid mapping can make a project look owned by someone
  else; skipping it silently would look like no project at all.

## What travels and what stays local

**Traveling files** (`.tikoci/<tool>/` outside `local/`) can come from
anyone. They hold no secrets. The settings file may set only the keys the
tool allowlists: never credentials or their sources, paths outside the
project, a protocol or transport, weaker connection security, wider agent
reach, skipped validation, host or cache policy, or `TIKOCI_*` variables.
A traveling file that can reach outside the tool (a network address, a
provisioning script, a disk size, a port forward, a network) is read only
when the project that holds it is trusted: itself or, for a git worktree,
through its main checkout, never through an enclosing project.

**`local/` is read only when both hold:**

1. it is a real directory owned by the current user with mode 0700 (secret
   files 0600), checked as OpenSSH checks key files. Most sync tools reset
   modes, so a synced `local/` fails by default. Windows relies on the
   inherited ACL.
2. this user trusted the project, at this path, in their own user scope.
   Nothing that arrives with the directory can say so.

Otherwise the tool ignores everything in `local/`, settings included, and
says why. Being gitignored proves nothing: a repo can force-add `local/`.
The mode check alone is not enough: Windows has none, and `cp -a`, restores
and some syncs keep modes. Whatever records trust must tell these apart:

| What happened | Result |
| --- | --- |
| Fresh clone, or `local/` arrived from elsewhere | untrusted |
| `cp -r`, a restore, or a sync that carried `local/` | copied: the original stays trusted; trusting the copy gives it its own identity, so it never shares the original's machines |
| The directory was moved | moved: trusting it again keeps its identity, so machines and records follow |
| `local/` readable by others or a symlink | unsafe; trusting tightens it and gives a new identity |

**How trust is recorded is open.** The reference resolver keeps one record
per tool and project (`<tool>/projects/<id>/project.json`, matched by an id in
`local/id`); a tool may do the same or better. A single record shared by all
tools, and how trust lines up with a harness's own permissions (an agent
allowed everything, a container that already holds every file), are left for
a later standard. What holds now:

- **Trust is a person's act at the CLI**: the tool's `trust` command, or an
  init command that creates project data (centrs' `devices init`). It asks
  for confirmation on a terminal, has a distinct name so a harness can deny
  it, and is never reachable from MCP or another agent API. Trusting lets the
  tool read the project's files; using credentials, provisioning or writing
  to devices is still each tool's own decision and its own gates.
- **This is cooperative, not a security boundary.** An agent with an
  unrestricted shell as the same OS user can edit the user scope directly.
  Containing that is the harness's permission rules, a separate OS user or a
  container.
- **One scope per item.** In a project, a tool uses the project's data of a
  kind instead of the user's for that run (centrs' project CDB, quickchr's
  project machines). It never merges the two, reports which scope it used,
  and when a name is not found says if the other scope has it.
- **Whether a project holds a tool's data comes from traveling files**, so
  every checkout and every tool in a run agrees. Each tool defines it; the
  house default is that `.tikoci/<tool>/` exists. It never depends on
  `local/` or on realized state: a fresh clone has neither, and two worktrees
  of one project could disagree.
- **Fail closed.** When the project holds the tool's data but it cannot be
  used (`local/` untrusted, unsafe, copied or moved, or not created yet in
  this clone), the tool stops with an error that names the state and the
  command that fixes it (`trust`, an init command). It never falls back to
  the user's data, where the same name can be a different device. A project
  that does not hold the tool's data uses the user scope, and says so.
- **Two `.gitignore` files** keep `local/` out of git without tikoci
  assuming git. `.tikoci/<tool>/.gitignore` contains `local/`, but it is
  tracked, so it disappears when the checkout switches to a branch without
  it, and the untracked `local/` stays behind. So whatever creates `local/`
  also writes `local/.gitignore` containing `*`: it ignores everything in
  `local/`, itself included, on every branch. Anything else that copies a
  project should leave out `local/` too.

### Worktrees and nested projects

- **Git worktrees use their main checkout's `local/`.** A worktree carries
  the committed `.tikoci/` but never `local/`. When the project has no
  `.tikoci/<tool>/local/` of its own and is in a git worktree, the tool uses
  the `.tikoci/` at the same place in the main checkout: same git common dir,
  same path inside the checkout. git's own files prove the link, wherever the
  worktree is (inside the checkout, beside it, in `/tmp` or
  `~/.t3/worktrees/`), and nothing needs git installed. The worktree is
  trusted through the main checkout, and its own traveling files (its
  branch's machine definitions) are read as the main checkout's are: trust is
  by path, not content, so a `git pull` changes them too. Trusting from a
  worktree trusts the main checkout.
- **Everything else is a separate project.** A nested `.tikoci/` that is not
  a worktree (`examples/<lab>/`) never inherits from an enclosing one, and a
  `local/` that exists but fails the checks is reported, never skipped. A
  copy outside git is trusted on its own, or named with `TIKOCI_PROJECT`.
  Other ways to prove a link (jj workspaces, an explicit link command) can be
  added later.
- **Realized state is per checkout.** `project` (the worktree) and the
  project `local/` comes from are distinct: credentials, device inventories
  and personal settings come from the main checkout, while state a tool
  creates for the checkout it runs in (quickchr's VMs) is keyed by that
  checkout, so two agents in two worktrees never reset one VM. A tool may let
  a definition share the main checkout's instead.
- **A checkout's path is not enough to key that state.** Worktree paths are
  reused (`/tmp/...`, `.claude/worktrees/<name>`, a harness's worktree
  directory after a cleanup), and a new worktree must not pick up the last
  one's VMs. State realized for a checkout records something that tells a
  reused path from the original; for a git worktree, the per-worktree admin
  directory (`<common dir>/worktrees/<name>/`, made by `git worktree add` and
  removed by `remove` and `prune`) does, without writing into `.git`. A tool
  that realizes state per checkout offers a prune for checkouts that are gone,
  and the prune releases their host-scope claims too.

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
  renamed, with no secrets. Only live leases (a read or a download in flight)
  protect an entry, kept in the cache root so every scope sharing it sees
  them; a stopped machine holds none. **State never depends on a cache entry
  being there**: it fetches the entry again by its name, or keeps its own
  copy as state (quickchr's opt-in pristine image for an offline lab). The
  size policy belongs to the cache root: the user's settings for the shared
  cache, the sandbox's for a cache inside it. Only the cache root's owner
  evicts.
- **run** files go in `$TIKOCI_RUNTIME_DIR/<tool>/`, under short names, not in
  a state directory whose length grows. A long-running process records the
  paths it started with in its state, and later commands read them there. A
  record of a process holds its pid, the boot id and the process start time
  or arguments, since pids are reused (in a replaced container especially).
  Unix socket paths stay within 103 bytes (macOS `sun_path` is 104 with the
  NUL): check at creation and name the variable to change in the error.
- **host-wide** resources (ports, managed networks, system services) are
  claimed in the **host scope**, `host/<tool>/` beside the default user scope
  (`~/.tikoci/host/`, `%LOCALAPPDATA%\tikoci\host\`). It belongs to the OS
  account, not the run: neither `TIKOCI_HOME` nor `TIKOCI_SANDBOX` moves it.
  It is found from `HOME` (`USERPROFILE` on Windows), else `os.homedir()`
  even for a supplied env, so a test that fakes `HOME` gets its own. It holds the
  allocation lock, a claim per resource (the context that owns it; durable
  for a machine, live with pid, boot id and start time for a run; how a stale
  claim is found) and which context created which host service. Sandboxes and
  moved user scopes register there like any run, and a bind probe still
  catches other accounts and programs. A container with its own home is its
  own host scope. A project file or a sandbox may attach to a host service
  that exists, never create, restart or remove one.
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
- **Run the shared cases.** Copies drift, and two tools that disagree on the
  project or the main checkout break a run.
  [references/conformance.json](references/conformance.json) holds the
  resolution cases as data (a tree, an env, a working directory and the
  expected result); every adopting repo runs them against its own resolver.
  A published `@tikoci/home` package can follow once two tools implement
  project discovery.
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
- no legacy path, no OS keychain, no sudo, and no other program's files
  (`~/.ssh/known_hosts`, shell rc files);
- host resources are claimed in the host scope like any run; an existing host
  service can be attached to, never created, restarted or removed (tests
  that must create one are a separate, explicitly flagged tier);
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
and 6. **Definitions are not settings**: a value in a project's definition
file (a machine's RouterOS version) is the project's intent, and only a flag
overrides it, never an environment variable from a shell profile. Per tool:
[references/settings.md](references/settings.md).

## Names across scopes

Tools pass machine and device names to each other (centrs `--quickchr`, MCP
servers, tikbook), and a not-found tip has to name the other scope the same
way in each. One form, scope first:

| Form | Means |
| --- | --- |
| `edge1` | the current scope: the project if there is one, else the user scope |
| `user:edge1` | the user scope, from anywhere |
| `<label>:edge1` | the project with that label, from anywhere |

- **An unqualified name is the current scope only**, so one scope per item
  holds: nothing is looked up in the other scope without a qualifier.
- **Resolve in this order**, because names and addresses already contain
  `:` and `@` (centrs takes `core@site` as a CDB name, and `host:port`, IPv6
  and MAC addresses as targets):
  1. a literal address (IPv4, IPv6, MAC, `host:port` with a numeric port, a
     URL) is an address, never a qualified name;
  2. the whole string as a name in the current scope;
  3. `<scope>:<name>`, split at the first `:`, only when the scope is `user`
     or a label the tool knows.

  If 2 and 3 both match, the tool stops with an error that shows both
  spellings.
- **A label follows DNS label rules**, as RouterOS names and host names do:
  lowercase letters, digits and inner hyphens, at most 63 characters, and it
  starts with a letter so it never reads as an address or a number. `user` is
  reserved. A tool may let the user set a label; an explicit one must already
  be valid.
- **The default label is derived from the project directory's name**, the
  same way in every tool (`deriveLabel()` in the reference resolver, with
  cases in [conformance.json](references/conformance.json)): strip accents,
  lowercase, turn each run of other characters into one `-`, trim `-` from
  both ends, prefix `p-` when it starts with a digit, then cut to 63
  characters and trim a trailing `-`. So `tikoci.github.io` is
  `tikoci-github-io`, `Lab_2` is `lab-2` and `2026 lab` is `p-2026-lab`.
  When nothing usable is left (or the result is `user`), the tool asks for an
  explicit label.
- **A tool resolves a label** against the projects its user scope knows, and
  an ambiguous label (two directories called `lab`) is an error that lists
  their paths.
- **Labels are for people and stored references.** A library call carries
  the project path (`TIKOCI_PROJECT` in the env it passes), never a label,
  since two tools may know different projects. A tool that receives a
  qualified name for another tool's thing passes it on as given, and the
  owning tool resolves it.
- **Refer, don't copy.** A definition that needs another tool's thing names
  it (a quickchr twin of `lab:edge1`) and reaches it through that tool's
  library, rather than copying its address or credentials.
- How to name one worktree's instance is left until a tool needs it.

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
