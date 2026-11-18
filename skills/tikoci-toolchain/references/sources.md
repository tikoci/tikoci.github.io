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
| One exact pin in `packageManager`, read by `setup-bun` | site-03, centrs-20, quickchr-110 | Settles `bun-pin-location`; quickchr moves from `.bun-version` on adoption, which changes shipped code: `.bun-version` is in its npm `files` and `quickchr doctor` reads it (`src/lib/platform.ts`). |
| `engines.bun` is the published floor; `@types/bun` and Dockerfile follow the pin | - | centrs `engines.bun` `>=1.4.4 <2`, `@types/bun` exact and ignored by Dependabot (#438); quickchr `>=1.4.3` against a 1.4.4 pin (CHANGELOG 0.5.5). From the centrs and quickchr review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26#issuecomment-6901659551). |
| Shipped CLI: `--no-env-file` shebang | - | centrs #666; checked on Bun 1.4.4 (a `.env` value reaches `#!/usr/bin/env bun` and not `-S bun --no-env-file`). |
| Bun-only published packages ship `.ts`; Node packages ship a build | - | quickchr `main: src/index.ts`, centrs `bin: src/cli.ts`; Node does not strip types under `node_modules`. |
| Publishing uses the npm CLI | - | quickchr `release.yml` runs `bunx npm publish --provenance` after `setup-node`; centrs `release.yaml` also sets up Node to publish. |
| CI records unpinned host tool versions; `doctor` as the tool list | - | quickchr `integration.yml` job summary, `quickchr doctor`. |
| PowerShell copies of examples | - | quickchr `examples/**/*.ps1`, `lint-powershell.yml`. |
| Why pin; upgrade in its own PR; never pin backwards | quickchr-110 | quickchr `.github/instructions/ci.instructions.md`, quickchr #148. |
| Pin checked mechanically | quickchr-110 | quickchr `scripts/check-bun-pin.ts`, which checks `.bun-version` (and that `actions/checkout` runs before `setup-bun`) and needs adapting to `packageManager`. |
| CI against the latest Bun | - | Settles `bun-ci-version` (maintainer, 2026-11-16); the workflow side is in tikoci-ci. |
| Commit `bun.lock` with the dependency change; frozen install in CI | centrs-51, restraml-41 | |
| TypeScript default; Python only for tooling, via uv | user-15, user-16, centrs-45, quickchr-047 | centrs `python-uv.instructions.md` is the strong source. |
| Other languages by recorded decision | user-15, user-20 | |
| Code shape: simple, consistent, self-documenting | user-13 | Mapped here in the survey and added in 3h (#21), after the Phase 4 review found it only in user-level notes. |
| Crash early in all code | user-31 | 3h: the house had it only in tikoci-cli-mcp; the Phase 4 review found the general rule in user-level notes. |
| No other task runner unless the repo already has one | user-21 | 3h, from the Phase 4 review of #41. |
| Web pages: semantic HTML and plain CSS first; a build step is fine; a framework only by recorded decision | user-17, user-67 | 3h (maintainer, 2026-11-18): "no build step" dated from single-file pages posted to the MikroTik forum; Bun and CI now build. Pico is a style guide. The rest of the deferred `tikoci-web` rows are in #40. |
| Bun-only repos use package scripts; a Makefile for several runtimes; CI calls the same entry point | user-21, rosetta-17, mikropkl-34 | Settles `task-runner`. 3h (maintainer, 2026-11-18): a short step may stay a package script, but package.json and CI do not hold substantive non-Bun build logic. routeros-skills has a Makefile that wraps `bun run check`; under this rule it can go. |
| `package.example.json` sketch of the referenced package.json parts | PR #26 review | Run with Bun 1.4.4 on sample code: `check`, `lint:fix`, `test:coverage`, `test:integration`. |
| `.gitattributes`: LF, CRLF for batch files, generated files marked | PR #26 review | routeros-skills and lsp-routeros-ts mark generated files today. |
| Tools outside `bun install` listed in the developer docs | PR #26 review | The maintainer's review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26), 2026-11-15. |
| POSIX sh; a Bun script once logic gets clever | mikropkl-21, PR #26 review | |
| POSIX sh; octal escapes; `LC_ALL=C` | mikropkl-21 | mikropkl `CLAUDE.md` "Common Pitfalls". |
| `nohup sh -c "exec CMD"`; temp files and background children | mikropkl-18, mikropkl-05 | mikropkl `qemu.sh` background mode. |
| QEMU for local VMs; images built and tested in CI and under RouterOS `/container`, no local Docker requirement | user-24, PR #26 review | |
