# Sources

The rules in [tikoci-toolchain](../SKILL.md) come from the November 2026
survey of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Rows | Notes |
| --- | --- | --- |
| Bun replaces node, npm, npx, jest and the listed packages | user-18, centrs-51, rosetta-23, quickchr-025, restraml-44 | user-18 has the full substitution table. |
| ESM with `.ts` extensions in imports | quickchr-025, rosetta-23 | Also true of centrs `src/`. |
| Look up Bun APIs instead of recalling them | user-19 | |
| `Bun.*` in tests and tools; Node only where shipped code runs on Node, with a recorded reason | restraml-44 | The Node smoke check is in tikoci-testing. |
| Bun bugs re-measured on the current Bun | quickchr-054, quickchr-056 | quickchr `.github/instructions/bun-http.instructions.md`; the survey notes the pool bug was not reproduced on Bun 1.3.11 and later. |
| One exact pin in `packageManager`, read by `setup-bun` | site-03, centrs-20, quickchr-110 | Settles `bun-pin-location`; quickchr moves from `.bun-version` on adoption. |
| Why pin; upgrade in its own PR; never pin backwards | quickchr-110 | quickchr `.github/instructions/ci.instructions.md`, quickchr #148. |
| Pin checked mechanically | quickchr-110 | quickchr `scripts/check-bun-pin.ts`, which checks `.bun-version` and needs adapting to `packageManager`. |
| CI against the latest Bun (open) | - | `bun-ci-version` in the conflicts table, maintainer direction in #21. |
| Commit `bun.lock` with the dependency change; frozen install in CI | centrs-51, restraml-41 | |
| TypeScript default; Python only for tooling, via uv | user-15, user-16, centrs-45, quickchr-047 | centrs `python-uv.instructions.md` is the strong source. |
| Other languages by recorded decision | user-15, user-20 | |
| Bun-only repos use package scripts; a Makefile for several runtimes; CI calls the same entry point | user-21, rosetta-17, mikropkl-34 | Settles `task-runner`. routeros-skills has a Makefile that wraps `bun run check`; under this rule it can go. |
| Tools outside `bun install` listed in the README | PR #26 review | The maintainer's review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26), 2026-11-15. |
| POSIX sh; a Bun script once logic gets clever | mikropkl-21, PR #26 review | |
| POSIX sh; octal escapes; `LC_ALL=C` | mikropkl-21 | mikropkl `CLAUDE.md` "Common Pitfalls". |
| `nohup sh -c "exec CMD"`; temp files and background children | mikropkl-18, mikropkl-05 | mikropkl `qemu.sh` background mode. |
| QEMU for local VMs; images built and tested in CI and under RouterOS `/container`, no local Docker requirement | user-24, PR #26 review | |
