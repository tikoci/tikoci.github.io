# Layout map

[layout.tsv](layout.tsv) lists every kind of file a tikoci tool keeps outside
its checkout: what exists today and where it goes under the
[tikoci-home](../SKILL.md) layout. It is the reviewed data; this page explains
the columns and the open questions. Surveyed in November 2026 from quickchr
`d0102c8`, centrs `6a69595` and rosetta `a51b201` (`main`), plus a pass over
lsp-routeros-ts, vscode-tikbook, restraml and mikropkl.

## Columns

| Column | Holds |
| --- | --- |
| `tool` | The repo and tool name, which is also its directory in each scope. |
| `item` | One kind of file or directory. |
| `class` | `config`, `secret`, `state`, `cache`, `runtime`, `host-wide` or `install` (see SKILL.md). |
| `scope` | `user`, `project`, `checkout`, `install`, `host` or `process` (temp files). |
| `path` | Where it goes. `unchanged` or `same` means it stays put; `open:` marks a decision left to the tool. |
| `today` | The current default on Linux (macOS is the same unless the notes say otherwise). On adoption this becomes the legacy path. |
| `owner` | The code that resolves or writes it, at the surveyed commit. |
| `lifecycle` | Who creates and deletes it, locking, eviction. |
| `backup` | Whether a user backup should include it. |
| `override` | The variables and flags that move or replace it today. |
| `migration` | The repo that moves it, or `-` when nothing moves. |
| `notes` | Constraints the move has to respect. |

Placeholders are upper case: `NAME`, `SLUG`, `SLOT`, `VERSION`, `PID`, `ID`
(a project's identity for that tool; a worktree has its main checkout's),
`INSTANCE` (the checkout a machine was realized for), `LABEL` (a project's
label in a qualified name), `SHORT-ID`, `PROJECT` (the directory holding
`.tikoci/`), `CHECKOUT`, `DATA`. In the `project` scope, secrets and state
are always under `local/`; everything else there is config that travels (a
test checks this).

## What the survey found

- **Three schemes today.** quickchr splits XDG-like data
  (`~/.local/share/quickchr`, ignoring `XDG_DATA_HOME`) from config
  (`~/.config/quickchr`, ignoring `XDG_CONFIG_HOME`). centrs keeps a shared
  `~/.config/tikoci/` whose CDB ignores `XDG_CONFIG_HOME` while `centrs.env`
  honors it. rosetta chose `~/.rosetta` on every OS on purpose. One user
  scope settles all three.
- **Overrides move different things.** `QUICKCHR_DATA_DIR` moves data but not
  config or credentials; `CENTRS_CDB_FILE` moves one file; rosetta has no
  variable for its managed directory and its tests mock `os.homedir()`.
- **Tests isolate three ways.** quickchr unit tests set `QUICKCHR_DATA_DIR`
  and `HOME` per file, while integration keeps the real home for the image
  cache; centrs unit tests sandbox `HOME`, while integration keeps it and reads
  the developer's CDB ([centrs#654](https://github.com/tikoci/centrs/issues/654));
  rosetta uses `DB_PATH=:memory:` and a preload that mocks `homedir()`. A
  sandbox (`TIKOCI_SANDBOX` with the shared cache) replaces all three.
- **Some stores are not per scope today.** quickchr's instance credentials
  are keyed by machine name only, so two data dirs overwrite each other's
  entries. Keychain items are global. Keeping credentials in each machine's
  directory and keeping sandboxes off the keychain fixes both.
- **Host resources are tracked per data dir.** quickchr's port allocation,
  cache in-use set and managed-network guards read only the current data dir,
  so today a second `QUICKCHR_DATA_DIR` can take a stopped machine's ports or
  shrink the shared cache to the default size. The host scope (one lock and
  one claims registry per OS account, which sandboxes join) and eviction by
  the cache root's owner come from this.
- **No tool keeps project files yet.** centrs' MATRIX leans to
  `.tikoci/centrs/` and is ready to start.

## Adoption notes and open questions

Each is the adopting repo's call; the house rule only says what must hold.
The house's own open decisions are listed in SKILL.md; background for them
is at the end of this page.

- **quickchr's profile order** (fifth quickchr review). First `user`,
  `cache`, `sandbox` and `host`, which fix bugs quickchr has today:
  quickchr#276 (with `HOME` unset, the data dir follows the working
  directory), test roots shrinking the shared cache or taking a stopped
  machine's ports, and the managed-network guard that reads one data dir
  (quickchr#256). The host scope is also where quickchr#56 lands. Then
  `names`, since `user:NAME` works before projects exist. Then `project`,
  `project-data` and `per-checkout`, when a real lab needs them.
- **centrs' profile order** (third centrs review). First `user` and
  `sandbox`, which fix bugs centrs has today: integration tests reading the
  developer's real CDB ([centrs#654](https://github.com/tikoci/centrs/issues/654))
  and the installed CLI loading a working directory's `.env`
  ([centrs#666](https://github.com/tikoci/centrs/issues/666)). Then
  `project` and `project-data` together, as the MATRIX Workspace theme, after
  the constitution changes listed in [settings.md](settings.md); centrs never
  ships `project` alone, since everything it would read from a project is
  project data. `names` comes with them, because `user:NAME` only matters
  once a project CDB can hide the user's. `cache` when the SNMP theme brings
  the MIB cache. Not `host` or `per-checkout`: centrs claims no host resource
  and realizes nothing per checkout.
- **quickchr machine sockets move to `run/`.** The first review kept them in
  the machine directory. With project machines under
  `projects/ID/INSTANCE/machines/NAME/`, that path has no bounded length (about 128
  bytes for a 64-character name on macOS), so sockets and `qemu.pid` go in
  `$TIKOCI_RUNTIME_DIR/quickchr/SHORT-ID/` and `machine.json` records them.
- **quickchr in a worktree**: how to name one worktree's instance, whether
  `list` in a project also shows the user's own machines, how a definition
  opts into sharing the main checkout's machine, how an instance tells a
  reused worktree path from the original (fourth quickchr review), and
  `quickchr prune` for checkouts that are gone, releasing their host-scope
  claims.
- **What makes a project hold quickchr data.** The fourth quickchr review
  suggests "`.tikoci/quickchr/` exists": `quickchr add` in such a project
  makes a project machine (and writes or offers a definition), and
  `user:NAME` or `--user` reaches the user's own.
- **quickchr machine definitions**: the TOML format, and what happens when a
  definition changes after its machine exists.
- **quickchr's host-scope formats**: the claims registry (owner context,
  durable or live lifetime, release, finding stale claims) and the
  managed-network registry. The location is settled (`~/.tikoci/host/quickchr/`);
  the earlier "fixed path outside any scope" had no portable answer on macOS
  without a shared sticky directory.
- **quickchr's `machine.json` compatibility**: bundled older copies read it,
  so keeping it readable across versions has to be a written promise.
- **quickchr factory images in a shared cache** (settled in the third quickchr
  review). `cache.ts` protects an image while a machine in the same data dir
  references it. Durable leases from stopped machines in every scope would
  need cleanup nobody owns, so only live leases remain: reset fetches the
  image again by name, and an offline lab keeps an opt-in pristine copy in
  its machine directory.
- **quickchr migration unit** is the whole data dir; `quickchr migrate`
  refuses while any machine runs, then leaves a symlink at
  `~/.local/share/quickchr` so bundled older versions keep finding machines.
- **quickchr machine disks on Windows.** They stay under `%LOCALAPPDATA%`
  either way, since that is the Windows default.
- **centrs device files without credentials.** Almost nothing of centrs
  travels: the CDB mixes addresses with credentials. A device file with no
  credentials, kept with the project, plus credentials in `local/`, would be
  centrs' equivalent of a quickchr machine definition. It needs the trust
  step and a constitution change; it belongs to centrs' Workspace theme, not
  this round.
- **rosetta compiled binaries.** The DB beside the executable is a portable
  layout, but it fails in a read-only install directory. Options: keep it as an
  explicit portable mode, or default compiled builds to
  `$TIKOCI_CACHE_DIR/rosetta/` like package mode.
- **rosetta and `TIKOCI_CACHE_DIR`.** A shared managed directory means one
  version's eviction must respect readers from another scope. rosetta's
  per-file SQLite locks already do; the collector must also stop comparing
  against a fixed `~/.rosetta`.

## Background for the open decisions

- **How trust is recorded.** The reference resolver keeps one record per
  tool and project. quickchr's third review proposed one shared record at
  `~/.tikoci/trust/` with per-tool grants, so a lab needs one trust step
  instead of one per tool. Deferred by the maintainer: the harder question is
  how tikoci trust lines up with harness permission schemes (an agent allowed
  everything, a container that already holds every file), which needs its
  own research. Nothing in the layout or the variables depends on where
  records live.
- **Links other than git worktrees.** git's own files prove a worktree's main
  checkout without running git. jj workspaces and plain copies have no such
  proof yet; until one is chosen, they are separate projects, trusted on
  their own or named with `TIKOCI_PROJECT`.
