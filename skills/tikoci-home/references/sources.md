# Sources

[tikoci-home](../SKILL.md) is drawn mostly from code: the November 2026 survey
found one instruction row on tool paths, so Phase 2 read quickchr, centrs and
rosetta directly ([layout.md](layout.md) gives the commits). Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 2 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Sources | Notes |
| --- | --- | --- |
| Two scopes (user, project); one directory per tool in each | centrs MATRIX "Workspace and local state"; issue #21; PR #24 clean-sheet round (maintainer) | Settles `tool-path-roots`. tikoci defines `.tikoci/`, not the directory around it or how it is shared. |
| Tools integrate through libraries and CLIs, never each other's files; nothing shared at the top of `.tikoci/` | maintainer, PR #24 clean-sheet round | Shared files wait for a written standard. |
| No XDG; same path on Linux and macOS | rosetta DESIGN.md ("same path on all OSes, visible and predictable") | quickchr and centrs half-follow XDG today. |
| `%LOCALAPPDATA%` on Windows | quickchr `getDataDir`, quickchr-120 | quickchr already keeps multi-gigabyte data there. |
| Cache separate and shared by every scope; only the user's own runs evict | quickchr-131, quickchr integration tests (warm image cache), quickchr `cache.ts` `inUseSet`, centrs#654, rosetta per-version DB files | Settles `test-home-isolation`. A private cache inside a sandbox is the sandbox's to evict (PR #24 Codex review). |
| Cache identity, atomic publication, leases | quickchr `.part` downloads and storage leases, rosetta staging and rename; PR #24 Codex review | |
| Cache entries that state needs again | quickchr `cache.ts` eviction guard, reset and rollback (PR #24 quickchr review) | |
| Locks with what they guard | quickchr-127, quickchr storage leases, centrs CDB lock, rosetta download lock | |
| Nothing needs a manual `rm -rf` | quickchr-037 | |
| Sockets in `run/`, socket path limit, recorded paths | quickchr DESIGN.md and qemu instructions (checked at create for networks), centrs#654 reproduction, quickchr `qemu.ts` | Moved out of the machine directory in the clean-sheet quickchr review. |
| Process records carry boot id and start time | quickchr network guard (reads QEMU's arguments); app-t3code container replacement notes | PR #24 clean-sheet quickchr review. |
| Host-wide allocation lock outside any scope, sandbox port range | quickchr `findAvailablePortBlock`, `.allocate.lock` (per data dir today) | PR #24 Codex and clean-sheet quickchr reviews. |
| Host services never from a sandbox or a project file | quickchr macOS network services, `machinesOnManagedNetwork` | |
| Precedence, sandbox over tool home variables | quickchr-088, centrs CONSTITUTION, rosetta `resolveDbPath` | Sandbox exception from the clean-sheet centrs review. Per tool in [settings.md](settings.md). |
| Project discovery: nearest `.tikoci/`, below home, passed to libraries | centrs MATRIX "Workspace and local state"; clean-sheet centrs review | Every tool stops at the same `.tikoci/`. |
| Allowlisted traveling settings; no transport choice | centrs `src/resolver/cdb.ts`, `src/resolver/target.ts`, `src/transfer.ts` (PR #24 centrs review) | Refused keys come from what centrs honors today. |
| `local/` read only when private and matched by a trust record; copies and moves | OpenSSH key-file mode checks; clean-sheet centrs and quickchr reviews | A force-added or synced `local/` proves nothing. |
| Trust only at the CLI, never MCP; cooperative threat model | centrs#664; PR #24 Codex review | |
| One scope per item; project CDB instead of the user CDB | centrs CONSTITUTION (one resolution source); clean-sheet centrs review | |
| Fail closed on unreadable project data | centrs device names are not unique across CDBs; second centrs pass on 168abf6 | Falling back to the user CDB could reach another router with the same name. |
| `.tikoci/` owned by the current user | git `safe.directory`; second centrs pass on 168abf6 | Discovery walks to `/` when the working directory is outside home. |
| Worktrees inherit an enclosing project's `local/` | maintainer, second centrs pass on 168abf6; Claude Code `.claude/worktrees/` | Worktrees outside the project (T3's `~/.t3/worktrees/`) use `TIKOCI_PROJECT` or their own trust. |
| Trust record kept although POSIX modes catch clones | Windows has no mode check (maintainer, second centrs pass) | |
| centrs `known_hosts` first, `~/.ssh/known_hosts` after | OpenSSH `UserKnownHostsFile`; clean-sheet centrs review | |
| Bun `.env` loading | [centrs#666](https://github.com/tikoci/centrs/issues/666), reproduced with Bun 1.4.4 | `#!/usr/bin/env -S bun --no-env-file` blocks it; `bun <file>` ignores the shebang. |
| Sandbox replaces the user scope; harness allowlist | centrs#654, centrs `HERMETIC_ENV`, quickchr testing instructions (pass explicit `env` to spawned workers), rosetta `homedir()` preload | Separate from moving `TIKOCI_HOME` (PR #24 centrs and quickchr reviews). |
| Tool variables win; existing ones keep their meaning | quickchr `QUICKCHR_DATA_DIR` (MANUAL §8) (PR #24 quickchr review) | |
| Libraries take env and cwd from the caller | centrs `quickchr-provider.ts`; quickchr `qemu.ts` (PR #24 quickchr reviews) | |
| Migration unit per tool; compatibility symlink | quickchr bundled by centrs, restraml and tikbook (PR #24 quickchr review) | |
| No `os.homedir()` fallback for a supplied env | centrs#654 second comment (`noEnv = {}` reaching the real CDB) | PR #24 centrs reviews. |
| Legacy wins over auto-create and first write; project data never auto-created | centrs `createEmptyCdbNoClobber`, `settings set` | PR #24 centrs reviews. |
| No keychain in a sandbox | quickchr credentials (instance credentials kept out of the keychain; web account in `Bun.secrets`) | |
| Legacy per item, explicit migrate, never delete | rosetta legacy `ros-help.db` handling; quickchr `.start-lock` and `efi-vars.fd` migrations | Changes the issue's "read-only fallback": that would fail ordinary writes to legacy data. |
