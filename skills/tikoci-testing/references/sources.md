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
| Tiers: unit, smoke, sweep, dispatch, lab | centrs-16, mikropkl-23, restraml-05, restraml-37, quickchr-085 | centrs `ci-test-tiers-and-release-versioning.instructions.md` is the strong source and names quickchr as the reference scheme. Settles `integration-cadence`. |
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
