# Sources

The rules in [tikoci-testing](../SKILL.md) come from the November 2026 survey
of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Rows | Notes |
| --- | --- | --- |
| `bun:test`, `describe`/`test`, `*.test.ts` | quickchr-064, user-29 | |
| Integration behind an env flag; existing names kept | quickchr-064, centrs-28 | quickchr `QUICKCHR_INTEGRATION`, centrs `CENTRS_RUN_FAST_INTEGRATION`. |
| RouterOS target as an env knob | quickchr-064 | quickchr `QUICKCHR_TEST_TARGET`, centrs `CENTRS_CHR_CHANNEL`. |
| `bunfig.toml` for test settings; coverage tracked, never a gate | centrs-33, quickchr-128, PR #26 review | centrs: coverage is a trend, not a gate; quickchr's thresholds are warn-only. The maintainer's review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26) (2026-11-15) sets "tracker, not gate". `bunfig.example.toml` was run with Bun 1.4.4. |
| Tiers: unit, smoke, sweep, dispatch, lab | centrs-16, mikropkl-23, restraml-05, restraml-37, quickchr-085 | centrs `ci-test-tiers-and-release-versioning.instructions.md` is the strong source and names quickchr as the reference scheme, but quickchr's CI differs: `ci.yml` runs lint, unit, Windows unit and an integration-freshness check per PR, integration runs on push to main (`main.yml`), and labs run as non-gating dispatch jobs (`lab.yml`). quickchr moves integration to code PRs on adoption. Settles `integration-cadence`. |
| Docs-only changes skip the integration tier | centrs-16 | |
| Every behavior change ships a test | rosetta-14, quickchr-074 | |
| Device behavior needs an integration test | quickchr-074, centrs-25, centrs-28 | |
| Anchor tests | user-29, mikropkl-23 | |
| Examples are canaries | quickchr-052 | |
| Watch a new assertion fail | quickchr-084 | quickchr's `.part` assertions. |
| Assert what the code decides | quickchr-084 | Bun 1.3 to 1.4 header and message changes (quickchr #148). |
| Exit 0 is not evidence; output markers | quickchr-050, restraml-47 | quickchr #102. |
| No catch-all around the call; grow stubs | quickchr-075 | |
| Declare version splits; gate on the running version | - | centrs `test/AGENTS.md` "Device-dependent expectations" (#297, #296); not in the survey. |
| Sandbox the user scope; tool overrides until adoption | quickchr-065 | tikoci-home `references/isolation.md`; settled as `test-home-isolation`. |
| Explicit child env | quickchr-065 | quickchr #214 review. |
| Windows env case | quickchr-065 | quickchr #226. |
| No side effects at import; structural guard | rosetta-36 | rosetta #98. |
| Port 0; no fixed router address; boot through quickchr | quickchr-045, quickchr-055, centrs-28 | |
| Reapable names; cleanup in `finally` | quickchr-045, quickchr-064 | |
| Short socket paths | quickchr-065 | FUSE mounts (Multipass) lack Unix sockets. |
| Module mocks leak in Bun | quickchr-076 | Bun 1.4.4, quickchr #224. |
| Mock HTTP at the layer the code uses | quickchr-055 | |
| Timeouts derived from the operation's budget | quickchr-071 | quickchr `test/integration/timeouts.ts` (#106). |
| Name a channel, not a version; pin only when the version is the point | quickchr-066, quickchr-123 | Maintainer, 2026-11-17 (read of #37): CI moves with RouterOS through channels; a pin only where a specific version is the point of the test. |
| Versions from `NEWESTa7.<channel>` or tikoci.dev `ros-versions.json` | restraml-20 | quickchr `src/lib/versions.ts` (`UPGRADE_BASE`); tikoci.github.io `src/dashboard-schema.md` (`/data/ros-versions.json`). Feeds read 2026-11-17: stable and testing `7.25.1`, long-term `7.24.6`, development `7.26beta5`. |
| Use quickchr's version helpers; RouterOS versions are not SemVer | user-73 | quickchr `src/index.ts` exports `resolveVersion`, `resolveAllVersions`, `compareRouterOsVersion`, `parseVersionParts`, `selectActiveChannels`; routeros-skills `routeros-fundamentals/references/version-parsing.md`. Who can use them, the vectors, and `parseVersionParts` dropping the suffix: quickchr review of #37, round 2, which ran restraml's `docs/restraml-shared.js` `compareVersions` (ranks `7.24rc1` below every beta) and vscode-tikbook's `chr-metadata.ts` `semver.coerce` (`7.24beta2` equals `7.24`). The vectors pass against quickchr's `compareRouterOsVersion` (2026-11-17). The reference's `compareVersions` sorts newest first and returns `NaN` for `7.22` vs `7.22.0`: CodeRabbit review of #37, checked against routeros-skills `origin/main`. |
| Type what you use, not what RouterOS returns | quickchr-062 | quickchr `routeros-rest.instructions.md` "Type Safety Around RouterOS Shapes". Planned for `tikoci-interfaces`; moved here in 3f (#21). Values as strings: the RouterOS manual's REST API page, "Values" section (centrs review of #38). |
| Channels are not ordered; the active set; must-pass is the repo's call | centrs-16 | centrs `scripts/qa-active-channels.ts` (the boundary: quickchr answers what is worth booting, centrs what must pass). Boot each version once: quickchr review of #37, round 2 (`testing` and `stable` both `7.25.1`). RouterOS 6 by version only: quickchr `isRouterOs6`; `NEWEST6.long-term` answered `6.49.23`. |
| A new RouterOS version is a trigger | quickchr-113 | tikoci-ci patterns, "A new RouterOS version". |
