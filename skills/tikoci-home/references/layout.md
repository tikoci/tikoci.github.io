# Layout map

[layout.tsv](layout.tsv) lists every kind of file a tikoci tool keeps outside
its checkout: what exists today and where it goes under the
[tikoci-home](../SKILL.md) layout. It is the reviewed data; this page explains
the columns and the open questions. Surveyed in November 2026 from quickchr
`d0102c8`, centrs `6a69595` and rosetta `a51b201` (`main`), plus a pass over
routeros-muse, lsp-routeros-ts, vscode-tikbook, restraml and mikropkl.

## Columns

| Column | Holds |
| --- | --- |
| `tool` | The repo and tool name, which is also its directory under each root. |
| `item` | One kind of file or directory. |
| `class` | `config`, `secret`, `state`, `cache`, `runtime`, `host-wide` or `install` (see the SKILL.md table). |
| `scope` | `user`, `workspace`, `checkout`, `install`, `host` or `process` (temp files). |
| `path` | Where it goes. `unchanged` or `same` means it stays put; `open:` marks a decision left to the tool. |
| `today` | The current default on Linux (macOS is the same unless the notes say otherwise). On adoption this becomes the legacy path. |
| `owner` | The code that resolves or writes it, at the surveyed commit. |
| `lifecycle` | Who creates and deletes it, locking, eviction. |
| `backup` | Whether a user backup should include it. |
| `override` | The variables and flags that move or replace it today. |
| `migration` | The repo that moves it, or `-` when nothing moves. |
| `notes` | Constraints the move has to respect. |

Placeholders are upper case: `NAME`, `SLUG`, `SLOT`, `VERSION`, `PID`,
`WORKSPACE` (the directory holding `.tikoci/`), `CHECKOUT`, `DATA`.

## What the survey found

- **Three schemes today.** quickchr splits XDG-like data
  (`~/.local/share/quickchr`, ignoring `XDG_DATA_HOME`) from config
  (`~/.config/quickchr`, ignoring `XDG_CONFIG_HOME`). centrs keeps a shared
  `~/.config/tikoci/` whose CDB ignores `XDG_CONFIG_HOME` while `centrs.env`
  honors it. rosetta chose `~/.rosetta` on every OS on purpose. routeros-muse
  follows XDG. One root settles all four.
- **Overrides move different things.** `QUICKCHR_DATA_DIR` moves data but not
  config or credentials; `CENTRS_CDB_FILE` moves one file; rosetta has no
  variable for its managed directory and its tests mock `os.homedir()`.
- **Tests isolate three ways.** quickchr unit tests set `QUICKCHR_DATA_DIR`
  and `HOME` per file, while integration keeps the real home for the image
  cache; centrs unit tests sandbox `HOME`, while integration keeps it and reads
  the developer's CDB ([centrs#654](https://github.com/tikoci/centrs/issues/654));
  rosetta uses `DB_PATH=:memory:` and a preload that mocks `homedir()`. A
  pinned `TIKOCI_HOME` with a shared cache replaces all three.
- **Some stores are not per root today.** quickchr's instance credentials are
  keyed by machine name only, so two data dirs overwrite each other's entries.
  Keychain items are global. Moving credentials under the root and keeping the
  keychain to the default root fixes both.
- **No tool keeps a workspace yet.** centrs' MATRIX leans to `.tikoci/centrs/`
  and is ready to start; that theme drives the workspace rules.

## Open questions for adoption

Each is the adopting repo's call; the house rule only says what must hold.

- **quickchr machine sockets.** Moving sockets and the pid file out of the
  machine directory into `$TIKOCI_RUNTIME_DIR/quickchr/NAME/` separates
  runtime from state and gives one place to check the length. Keeping them in
  the machine directory is fine if the length check covers them.
- **quickchr machine disks on Windows.** They stay under `%LOCALAPPDATA%`
  either way, since that is the Windows default root.
- **rosetta compiled binaries.** The DB beside the executable is a portable
  layout, but it fails in a read-only install directory. Options: keep it as an
  explicit portable mode, or default compiled builds to
  `$TIKOCI_CACHE_DIR/rosetta/` like package mode.
- **rosetta and `TIKOCI_CACHE_DIR`.** A shared managed directory means one
  version's eviction must respect readers from another root. rosetta's
  per-file SQLite locks already do; the collector must also stop comparing
  against a fixed `~/.rosetta`.
- **centrs `known_hosts`.** Default runs keep using OpenSSH's file. A pinned run
  should pass `UserKnownHostsFile` under the root; the option exists but
  nothing sets it.
- **routeros-muse workspace config** is kept in the user root, keyed by a
  workspace id, so a clone cannot change it. That is a reasonable exception to
  "workspace data lives in `.tikoci/`": note it under `## House exceptions`.
