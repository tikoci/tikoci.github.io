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
(a project's id for that tool), `SHORT-ID`, `PROJECT` (the directory holding
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
  shrink the shared cache to the default size. A host-wide allocation lock,
  a separate sandbox port range and user-only eviction come from this.
- **No tool keeps project files yet.** centrs' MATRIX leans to
  `.tikoci/centrs/` and is ready to start.

## Open questions for adoption

Each is the adopting repo's call; the house rule only says what must hold.

- **quickchr machine sockets move to `run/`.** The first review kept them in
  the machine directory. With project machines under
  `projects/ID/machines/NAME/`, that path has no bounded length (about 128
  bytes for a 64-character name on macOS), so sockets and `qemu.pid` go in
  `$TIKOCI_RUNTIME_DIR/quickchr/SHORT-ID/` and `machine.json` records them.
- **quickchr's qualified machine names** (`NAME@ID` or similar), and whether
  `list` in a project also shows the user's own machines.
- **quickchr machine definitions**: the TOML format, and what happens when a
  definition changes after its machine exists.
- **quickchr's host-wide lock path**: a fixed path outside any scope, not
  `os.tmpdir()` (per user on macOS, and a harness may set `TMPDIR`).
- **quickchr's `machine.json` compatibility**: bundled older copies read it,
  so keeping it readable across versions has to be a written promise.
- **quickchr factory images in a shared cache.** `cache.ts` protects an image
  from eviction while a machine in the same data dir references it, because
  reset and provisioning rollback need it again. With project machines and
  sandboxes sharing the cache, that becomes a lease per referenced image in
  the cache root, or a re-fetch when reset finds one missing.
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
