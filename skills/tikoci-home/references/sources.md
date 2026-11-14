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
| One root, one directory per tool | centrs MATRIX "Workspace and local state"; issue #21 | Settles `tool-path-roots`. |
| No XDG; same path on Linux and macOS | rosetta DESIGN.md ("same path on all OSes, visible and predictable") | quickchr and centrs half-follow XDG today. |
| `%LOCALAPPDATA%` on Windows | quickchr `getDataDir`, quickchr-120 | quickchr already keeps multi-gigabyte data there. |
| Cache separate and shared by every root | quickchr-131, quickchr integration tests (warm image cache), centrs#654, rosetta per-version DB files | Settles `test-home-isolation`. |
| Cache entries that state needs again | quickchr `cache.ts` eviction guard, reset and rollback (PR #24 review) | |
| Locks with what they guard | quickchr-127, quickchr storage leases, centrs CDB lock, rosetta download lock | |
| Nothing needs a manual `rm -rf` | quickchr-037 | |
| Socket path limit | quickchr DESIGN.md and qemu instructions (checked at create for networks), centrs#654 reproduction | |
| Host-wide resources | quickchr macOS network services; quickchr port allocation per data dir | |
| Precedence | quickchr-088, centrs CONSTITUTION, rosetta `resolveDbPath` | Per tool in [settings.md](settings.md). |
| Workspace discovery, allowlist, owner-only, `.gitignore` | centrs MATRIX "Workspace and local state" and "Auth and secrets" | Refused keys come from what centrs honors today. |
| Workspace data needs enrollment; no transport choice | centrs `src/resolver/cdb.ts`, `src/resolver/target.ts`, `src/transfer.ts` (PR #24 review) | |
| Bun `.env` loading | `bun --no-env-file`; centrs survey (CLI runs under `bun`) | Not tested in a tool yet. |
| Pinned runs, harness allowlist | centrs#654, centrs `HERMETIC_ENV`, quickchr testing instructions (pass explicit `env` to spawned workers), rosetta `homedir()` preload | |
| Keychain only in the default root | quickchr credentials (instance credentials kept out of the keychain; web account in `Bun.secrets`) | |
| Legacy per item, explicit migrate, never delete | rosetta legacy `ros-help.db` handling; quickchr `.start-lock` and `efi-vars.fd` migrations | Changes the issue's "read-only fallback": that would fail ordinary writes to legacy data. |
