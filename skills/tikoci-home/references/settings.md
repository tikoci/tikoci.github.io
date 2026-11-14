# Settings per tool

Storage decides where a settings file lives; precedence decides which value
wins. The house order (highest first) is flags and API arguments, environment,
tool-specific layers, the project's `local/<tool>.env` (trusted), its
`<tool>.env` (allowlisted keys), the user file (or, in a sandbox, the
sandbox's own), defaults. This page shows where each tool's existing layers
sit and what adopting [tikoci-home](../SKILL.md) changes. The adopting repo
makes the change; nothing here changes a tool by itself.

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

On adoption: the user file moves to `$TIKOCI_HOME/quickchr/quickchr.env`,
and the project files slot in above it. Allowlist for the traveling
`.tikoci/quickchr/quickchr.env`: `default-channel`, `default-arch`,
`timeout-extra`. Not allowed there: `secure-login` (it changes how machines
are secured). `accel`, `cache-max-size` and `storage-reserve` are host and
cache policy: they come only from flags, the environment and the user file,
never from a project (the personal `local/quickchr.env` included), and only
the user's own runs apply the cache size.

`QUICKCHR_DATA_DIR` keeps its meaning: it acts as `QUICKCHR_HOME` and, unless
`QUICKCHR_CACHE_DIR` or `TIKOCI_CACHE_DIR` is set, keeps the cache at
`$QUICKCHR_DATA_DIR/cache` as today. A sandbox overrides it like any tool
home variable.

**Machines in a project.** A project describes machines in
`.tikoci/quickchr/machines/<name>.toml` (the path is reserved; the format is
quickchr's design). quickchr realizes them under
`$TIKOCI_HOME/quickchr/projects/<id>/machines/<name>/`, keyed by the project
id in `.tikoci/quickchr/local/id`. Multi-GB disks, running QEMU processes and
host ports stay out of the project directory, and two projects that both
describe `edge1` get two machines. In a project, `quickchr list` shows that
project's machines; every machine also needs a qualified name that works
from anywhere (an MCP server started elsewhere, the VS Code extension host,
`centrs --quickchr`). The form is quickchr's call, for example `edge1@<id>`.
Definitions are read only when the project is trusted: provisioning scripts,
disk sizes, port forwards and networks all reach outside the VM. A definition
may attach to a host network service that already exists, never create one.

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

On adoption the order becomes:

1. CLI flags and API call arguments
2. `CENTRS_*` environment variables
3. CDB comment `key=value` on the matched device
4. `.tikoci/centrs/local/centrs.env` (trusted)
5. `.tikoci/centrs/centrs.env` (allowlisted)
6. `$TIKOCI_HOME/centrs/centrs.env`
7. Built-in defaults

Allowlist for the traveling `.tikoci/centrs/centrs.env`, from the keys centrs
honors (the trusted `local/centrs.env` is limited only as the user file is):

| Key | From a traveling file |
| --- | --- |
| `format`, `max-results`, `timeout` | allowed |
| `cdb-file` | refused: the project CDB has a fixed place in `local/` |
| `resolve`, `via`, `transfer-via`, `port`, `host`, `validate` | refused: they redirect targets, choose a protocol (and can downgrade SFTP to plaintext REST or native API) or skip the gate |
| `insecure`, `ssh-key`, `mcp-allow-adhoc` | refused: weaker security or wider reach |
| credentials, `cdb-password`, a password command, `skip-env-file` | refused, as in the user file |

**The project CDB** is `.tikoci/centrs/local/winbox.cdb`. It holds
credentials, so it never travels.

- **Only `devices init` creates one**, and that also trusts the project. It is
  never auto-created.
- **It is read only when the project is trusted for centrs** and `local/` is
  private: the directory 0700, the file 0600, both owned by the current user.
- **It replaces the user CDB for the run, never merged.** A merge would bring
  back name collisions and the question the constitution defers (how to
  combine two device sources). The envelope names the scope it used.
- **A not-found error says when the user CDB has the name**, for example
  "`home-gw` is in your user CDB; run outside the project or set
  `TIKOCI_PROJECT=none`".
- **Machines come from quickchr.** centrs takes a project's quickchr machines
  from quickchr's library, passing its env and the project it found, instead
  of copying them into a CDB.

The constitution changes first, in three places:

- the precedence list above;
- "the CDB is the only durable inventory": devices now come from sources (the
  user CDB, a project CDB, quickchr), one inventory per run, and later
  schemes may add more;
- the MATRIX SNMP theme's MIB cache policy (signed off 2026-06-06) says "XDG
  cache root"; its home becomes `$TIKOCI_CACHE_DIR/centrs/mib/VERSION/`.

**Host keys.** centrs passes `UserKnownHostsFile` with two files: its own
`$TIKOCI_HOME/centrs/known_hosts` first, then `~/.ssh/known_hosts`. Keys the
user already pinned still apply, and new keys go only into centrs' file, so
quickchr's reused `127.0.0.1:<port>` keys stay out of `~/.ssh`. A sandbox
lists only its own file.

Before any of that, centrs#654 can land in a forward-compatible shape: one
`centrsPaths(env)` resolver replacing `defaultCdbPath` and
`defaultSettingsPath` (which also ends today's split between the CDB and
`centrs.env`), no fallback to the real home for a caller-supplied env, and a
hermetic env built in the integration preload. Adopting tikoci-home later
then changes that one function, and the preload switches to `TIKOCI_SANDBOX`.

## rosetta

Today: no settings file. `DB_PATH`, then `--db`, then the mode default; `PORT`,
`HOST` and `TLS_*_PATH` with flags first; `ROSETTA_OFFLINE`.

On adoption: no settings file is needed. `TIKOCI_CACHE_DIR` moves the managed
DB directory; `DB_PATH` and `--db` stay above it. Order: `DB_PATH`, `--db`,
`$TIKOCI_CACHE_DIR/rosetta/`, then (outside a sandbox) the legacy `~/.rosetta/`
generations. A project could carry `.tikoci/rosetta/rosetta.env` with the
RouterOS version it targets, if rosetta ever wants one.
