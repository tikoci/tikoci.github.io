# Settings precedence per tool

Storage decides where a settings file lives; precedence decides which value
wins. The house order (highest first) is flags and API arguments,
environment, the workspace's local file (enrolled) then its committed file
(allowlisted), the user file (or, in a sandbox, the sandbox's own), defaults.
This page shows where each tool's existing layers sit and what adopting
[tikoci-home](../SKILL.md) changes. The adopting repo makes the change;
nothing here changes a tool by itself.

## quickchr

Today ([settings.ts](https://github.com/tikoci/quickchr/blob/main/src/lib/settings.ts)):

1. CLI flag
2. `QUICKCHR_<KEY>` environment variable
3. `~/.config/quickchr/quickchr.env`
4. Built-in default

Keys: `default-channel`, `default-arch`, `accel`, `cache-max-size`,
`storage-reserve`, `timeout-extra`, `secure-login`. The shutdown timeout has
no file tier. Credentials have their own chain (flags, environment, keychain,
file).

On adoption: the user file moves to `$TIKOCI_HOME/quickchr/quickchr.env`, and
the workspace files slot in as layer 3. Candidates for the committed
workspace allowlist: `default-channel`, `default-arch`, `timeout-extra`. Not
allowed: `accel`, `cache-max-size` and `storage-reserve` (they act on the
host and the shared cache, not the project) and `secure-login` (it changes
how machines are secured). `cache-max-size` is the shared cache's policy, so
it is read from the user root even in a sandbox, and only an owner run
applies it.

`QUICKCHR_DATA_DIR` keeps its meaning: it acts as `QUICKCHR_HOME` and, unless
`QUICKCHR_CACHE_DIR` or `TIKOCI_CACHE_DIR` is set, keeps the cache at
`$QUICKCHR_DATA_DIR/cache` as today.

**Machines and workspaces** (quickchr's position from the PR #24 review):
machines stay in the user root, with one set of names per user. Multi-GB
disks, running QEMU processes and host ports do not belong in a project
directory. A workspace may tag the machines it uses (recorded in
`machine.json`, used to filter `list`). A future workspace lab manifest that
describes machines to create is workspace data, not settings: it carries
provisioning scripts, port forwards, packages and bridged networks, so
quickchr reads it only once the workspace is enrolled.

## centrs

Today ([CONSTITUTION](https://github.com/tikoci/centrs/blob/main/docs/CONSTITUTION.md),
`src/resolver/settings.ts`):

1. CLI flags and API call arguments
2. `CENTRS_*` environment variables
3. CDB comment `key=value` on the matched device
4. `${XDG_CONFIG_HOME:-~/.config}/tikoci/centrs.env`
5. Built-in defaults

The `__default__` CDB record has its own per-field order: arguments,
environment, matched device, `__default__`, built-in. MCP reads arguments,
environment and `centrs.env`. Credentials and `CENTRS_SKIP_ENV_FILE` can never
come from the file.

On adoption: the user file moves to `$TIKOCI_HOME/centrs/centrs.env`, and a
workspace `centrs.env` becomes a layer between comment `key=value` and the user
file. The constitution changes first, in three places:

- the precedence list names `${XDG_CONFIG_HOME:-~/.config}/tikoci/centrs.env`,
  which becomes `$TIKOCI_HOME/centrs/centrs.env` plus the workspace layers
  (`centrs.local.env` when enrolled, committed `centrs.env` allowlisted);
- "the CDB is the only durable inventory; everything else is derived,
  deletable and secret-free" gains enrollment records, which are durable but
  fail closed when lost;
- the MATRIX SNMP theme's MIB cache policy (signed off 2026-06-06) says "XDG
  cache root"; its home becomes `$TIKOCI_CACHE_DIR/centrs/mib/VERSION/`
  (layout.tsv has a planned row).

Before any of that, centrs#654 can land in a forward-compatible shape: one
`centrsPaths(env)` resolver replacing `defaultCdbPath` and
`defaultSettingsPath` (which also ends today's split between the CDB and
`centrs.env`), no fallback to the real home for a caller-supplied env, and a
hermetic env built in the integration preload. Adopting `TIKOCI_HOME` later
then changes that one function and the preload.

Allowlist for the committed workspace `centrs.env`, from the keys centrs
honors (an enrolled workspace's local `centrs.local.env` is not limited):

| Key | From a workspace |
| --- | --- |
| `format`, `max-results`, `timeout` | allowed |
| `cdb-file` | only a path inside the workspace |
| `resolve`, `via`, `transfer-via`, `port`, `host`, `validate` | refused: they redirect targets, choose a protocol (and can downgrade SFTP to plaintext REST or native API) or skip the gate |
| `insecure`, `ssh-key`, `mcp-allow-adhoc` | refused: weaker security or wider reach |
| credentials, `cdb-password`, a password command, `skip-env-file` | refused, as in the user file |

That allowlist is for the committed settings file, which applies without
enrollment. A project CDB is different. Its records supply addresses, credentials and device
names, and centrs combines a record's address with credentials from higher
layers (`src/resolver/cdb.ts`, `src/resolver/target.ts`), so a cloned CDB that
maps a familiar name such as `edge1` to another address would receive the
user's credentials. CDB membership alone also registers a device for MCP. So:

- **An unenrolled workspace CDB is not read at all.** `devices init` enrolls
  the workspace it creates; a cloned one needs an explicit trust command, run
  by a person at the CLI and never exposed as an MCP tool (the same class of
  problem as an agent granting itself `mcp=rw`, centrs#664).
- **An enrolled workspace CDB has full CDB semantics**, comment keys included.
  Its main use is a project lab of quickchr CHRs driven by agents, which needs
  `insecure` for self-signed certificates, `mcp=rw` for agent work and an
  `ssh-key` inside the workspace. Filtering those after the user explicitly
  trusted the workspace would leave a CDB nobody uses.
- **One CDB per run.** An enrolled workspace CDB replaces the user CDB for the
  run rather than merging with it, so names cannot collide, and
  `meta.settings` reports which one won. Merging would be a second resolution
  source, which the constitution defers until one exists.

## rosetta

Today: no settings file. `DB_PATH`, then `--db`, then the mode default; `PORT`,
`HOST` and `TLS_*_PATH` with flags first; `ROSETTA_OFFLINE`.

On adoption: no settings file is needed. `TIKOCI_CACHE_DIR` moves the managed
DB directory; `DB_PATH` and `--db` stay above it. Order: `DB_PATH`, `--db`,
`$TIKOCI_CACHE_DIR/rosetta/`, then (owner runs only) the legacy `~/.rosetta/`
generations.
