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
| Names across scopes: `name`, `user:name`, `label:name`; refer, don't copy | third quickchr review on 703379a (centrs `--quickchr`, MCP servers, tikbook); maintainer; scope-first `:` form and resolution order from the third centrs review on 3fae699 (centrs `src/resolver/target.ts`: `core@site` is a CDB name) | The first shared standard is a naming form, not a file. Library calls carry the project path, not a label (fourth quickchr review). |
| Labels follow DNS label rules; one derivation for the default label | fifth quickchr review on bfb0642 (`tikoci.github.io` had no valid default label); maintainer (align with RouterOS and DNS naming); RFC 1035 label length | `deriveLabel()` and the `labels` cases in conformance.json. |
| Adopting in profiles; tools without `project` ignore `.tikoci/`; conformance cases and fields tagged by profile | fifth quickchr review on bfb0642 | Repos adopt over years and stay aligned; half an adoption is the case to avoid. |
| Walk stops at a worktree root before its own main checkout; main checkout's project reported | fourth quickchr review and third centrs review on 3fae699 | A name in both CDBs would otherwise reach the user's device silently. |
| A reused checkout path is not an instance key; prune releases claims | fourth quickchr review on 3fae699 | |
| "Holds data" from traveling files (`.tikoci/<tool>/` exists by default) | fourth quickchr review and third centrs review on 3fae699 | Closes a fresh clone silently using the user CDB. |
| One section per profile; open decisions listed once; a worktree's label is its main checkout's (`defaultLabel`) | maintainer and third centrs review on 53d2fbd | Reorganization only, apart from the label rule: a harness's worktree directory (`t3-6eb9a36a`) is not the project's name. |
| Nested worktrees step over the main checkout; worktrees always keep `local/` in the main checkout, created hidden before it adopts | final maintainer pass on c286e9e | Nested and beside worktrees in a lab folder found different projects; a branch adopting a tool put credentials in a deletable worktree, contrary to settings.md. |
| Worktree link checked against git's backlink; Windows variable names without case; legacy home variables; canonical paths through the nearest existing ancestor | CodeRabbit review on 6362d16; git repository layout (`worktrees/<id>/gitdir`), verified with git 2.56 including `worktree.useRelativePaths` | A copied worktree with an absolute `.git` pointer would otherwise inherit the main checkout's trust. |
| A known scope always makes a qualified name, numeric names included; `host:port` only after it; `resolveTarget()` and `targets` cases | Codex review on 0997b96 (`user:123` read as host `user` port 123) | A host named like a label is reached through a URL or an explicit address option. |
| `local/.gitignore` always rewritten; main checkout's project reported from any worktree | Copilot review on 9f84034 | A copied `local/` could bring an empty ignore file; sibling and `/tmp` worktrees missed the fallback warning. |
| `local/.gitignore` with `*` | third centrs review on 3fae699, reproduced with git (branch switch leaves `local/` untracked) | The tracked `.tikoci/<tool>/.gitignore` is per branch. |
| No XDG; same path on Linux and macOS | rosetta DESIGN.md ("same path on all OSes, visible and predictable") | quickchr and centrs half-follow XDG today. |
| `%LOCALAPPDATA%` on Windows | quickchr `getDataDir`, quickchr-120 | quickchr already keeps multi-gigabyte data there. |
| Cache separate and shared by every scope; only the user's own runs evict | quickchr-131, quickchr integration tests (warm image cache), quickchr `cache.ts` `inUseSet`, centrs#654, rosetta per-version DB files | Settles `test-home-isolation`. A private cache inside a sandbox is the sandbox's to evict (PR #24 Codex review). |
| Cache identity, atomic publication, leases | quickchr `.part` downloads and storage leases, rosetta staging and rename; PR #24 Codex review | |
| Live leases only; state never depends on a cache entry; size policy belongs to the cache root | quickchr `cache.ts` eviction guard, reset and rollback; third quickchr review | Replaces durable leases for factory images, which nobody would clean up. |
| Locks with what they guard | quickchr-127, quickchr storage leases, centrs CDB lock, rosetta download lock | |
| Nothing needs a manual `rm -rf` | quickchr-037 | |
| Sockets in `run/`, socket path limit, recorded paths | quickchr DESIGN.md and qemu instructions (checked at create for networks), centrs#654 reproduction, quickchr `qemu.ts` | Moved out of the machine directory in the clean-sheet quickchr review. |
| Process records carry boot id and start time | quickchr network guard (reads QEMU's arguments); app-t3code container replacement notes | PR #24 clean-sheet quickchr review. |
| Host scope `~/.tikoci/host/<tool>/` for the allocation lock, claims and the managed-network registry; sandboxes register live claims | quickchr `findAvailablePortBlock`, `.allocate.lock` (per data dir today), `machinesOnManagedNetwork`, quickchr#56, quickchr#256; third quickchr review | Replaces "a fixed path outside any scope" and the separate sandbox port range. |
| Host services: attach, never create, from a sandbox or a project file | quickchr macOS network services; third quickchr review | Managed-network tests can then run sandboxed. |
| Precedence, sandbox over tool home variables | quickchr-088, centrs CONSTITUTION, rosetta `resolveDbPath` | Sandbox exception from the clean-sheet centrs review. Per tool in [settings.md](settings.md). |
| Definitions are not settings | third quickchr review | A shell-profile default must not beat a project's pinned version. |
| Project discovery: nearest `.tikoci/`, below home, passed to libraries; skipped ones reported | centrs MATRIX "Workspace and local state"; clean-sheet centrs review; third quickchr review (uid mapping on shares) | Every tool stops at the same `.tikoci/`. |
| Allowlisted traveling settings; no transport choice | centrs `src/resolver/cdb.ts`, `src/resolver/target.ts`, `src/transfer.ts` (PR #24 centrs review) | Refused keys come from what centrs honors today. |
| `local/` read only when private and trusted at this path; copies and moves | OpenSSH key-file mode checks; clean-sheet centrs and quickchr reviews | A force-added or synced `local/` proves nothing. |
| How trust is recorded stays open | maintainer, third quickchr round | A shared `~/.tikoci/trust/` was proposed; aligning with harness permissions needs its own research first. |
| Trust only at the CLI, never MCP; cooperative threat model | centrs#664; PR #24 Codex review | |
| One scope per item; project CDB instead of the user CDB | centrs CONSTITUTION (one resolution source); clean-sheet centrs review | |
| Fail closed on unreadable project data | centrs device names are not unique across CDBs; second centrs pass on 168abf6 | Falling back to the user CDB could reach another router with the same name. |
| `.tikoci/` owned by the current user | git `safe.directory`; second centrs pass on 168abf6 | Discovery walks to `/` when the working directory is outside home. |
| Git worktrees use the main checkout's `local/` and trust; nested projects never inherit; realized state per checkout | git worktree layout (`.git` file, `commondir`); third quickchr review on 703379a; maintainer | Replaces the second centrs pass's nesting rule, which missed sibling and `~/.t3/worktrees/` worktrees and caught `examples/<lab>/`. |
| Trust record kept although POSIX modes catch clones | Windows has no mode check (maintainer, second centrs pass) | |
| centrs `known_hosts` first, `~/.ssh/known_hosts` after | OpenSSH `UserKnownHostsFile`; clean-sheet centrs review | |
| Shared conformance cases | third quickchr review | Copies of the resolver must agree in one run; a package can follow. |
| Bun `.env` loading | [centrs#666](https://github.com/tikoci/centrs/issues/666), reproduced with Bun 1.4.4 | `#!/usr/bin/env -S bun --no-env-file` blocks it; `bun <file>` ignores the shebang. |
| Sandbox replaces the user scope; harness allowlist | centrs#654, centrs `HERMETIC_ENV`, quickchr testing instructions (pass explicit `env` to spawned workers), rosetta `homedir()` preload | Separate from moving `TIKOCI_HOME` (PR #24 centrs and quickchr reviews). |
| Tool variables win; existing ones keep their meaning | quickchr `QUICKCHR_DATA_DIR` (MANUAL §8) (PR #24 quickchr review) | |
| Libraries take env and cwd from the caller | centrs `quickchr-provider.ts`; quickchr `qemu.ts` (PR #24 quickchr reviews) | |
| Migration unit per tool; compatibility symlink | quickchr bundled by centrs, restraml and tikbook (PR #24 quickchr review) | |
| No `os.homedir()` fallback for a supplied env | centrs#654 second comment (`noEnv = {}` reaching the real CDB) | PR #24 centrs reviews. |
| Legacy wins over auto-create and first write; project data never auto-created | centrs `createEmptyCdbNoClobber`, `settings set` | PR #24 centrs reviews. |
| No keychain in a sandbox | quickchr credentials (instance credentials kept out of the keychain; web account in `Bun.secrets`) | |
| Legacy per item, explicit migrate, never delete | rosetta legacy `ros-help.db` handling; quickchr `.start-lock` and `efi-vars.fd` migrations | Changes the issue's "read-only fallback": that would fail ordinary writes to legacy data. |
