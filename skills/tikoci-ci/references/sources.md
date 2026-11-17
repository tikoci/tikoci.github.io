# Sources

The rules in [tikoci-ci](../SKILL.md) come from the November 2026 survey of
tikoci instruction files and skills, the workflows of centrs, quickchr,
rosetta, restraml, mikropkl and this repo (read on 2026-11-16; one retired
restraml rule is linked at its last commit), and the
documentation of GitHub Actions, setup-bun and zizmor. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

## Rules

| Rule | Rows | Notes |
| --- | --- | --- |
| The workflow set | centrs-32, quickchr-112, quickchr-115 | centrs `ci.yaml`, `qa.yaml`, `verify-extended.yaml`, `lab.yaml`, `codeql.yaml`; quickchr `ci.yml`, `main.yml`, `sweep.yml`, `integration.yml`, `lab.yml`. |
| `permissions:`, SHA pins, `persist-credentials: false` | - | From 3c (`tikoci-github`) and 3b (`tikoci-dependencies`); centrs `SECURITY.md` for `persist-credentials`. |
| Explicit `bash` for pipefail | - | quickchr `ci.instructions.md` "Pipefail rule" (CI run #1, arm64 green with every test failing). GitHub's [supported shells](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsshell): unspecified is `bash -e {0}`, explicit `bash` is `bash --noprofile --norc -eo pipefail {0}`. |
| Untrusted values through `env:` | - | zizmor `template-injection` audit. |
| Timeouts from measured duration | restraml-48 | restraml `CLAUDE.md` CI anti-pattern 1; tikoci-grounding. |
| `cancel-in-progress` for PRs only | site-11 | This repo's `deploy-pages.yaml` sets `cancel-in-progress: false`; centrs `ci.yaml` cancels by ref. |
| Short `run:` blocks; local equivalents | quickchr-129, rosetta-12, site-04 | quickchr `ci.instructions.md` "Local Equivalents". |
| One mechanism per job kind | restraml-48 | restraml `CLAUDE.md` CI anti-pattern 9 (#96). |
| Setup verifies; steps assert their effect | quickchr-121 | quickchr `choco install` 504 (run 30798858483); restraml anti-pattern 8. |
| Quiet installs and downloads | mikropkl-27 | mikropkl `CLAUDE.md` "CI conventions for apt-get and downloads". |
| Which shell a Windows test step runs | - | centrs `env.HOME ?? homedir()` (`src/devices.ts`, `src/resolver/config-file.ts`); `unit-cross` runs under the default `pwsh` today (centrs review of PR #28). The fallback as a safeguard and code that works either way: maintainer, light lean. Whether a `windows-latest` runner's `pwsh` has `HOME` set is unchecked. |
| Smoke is the product's side; container apps | - | Maintainer, PR #28. app-t3code `ci.yml` (contract test, image classifier, `container-replacement.test.ts`, candidate, native arm64, `promote` with the head check), `integration.yml` (`workflow_run` after `promote`, the races in its header, CHR per arch, `/app` install, web UI probe), `freshness.yml` (`scripts/freshness-issue.sh`). rosetta `release.yml` (`smoke-oci` before `promote-oci`, rosetta #246) and `app-integration.yml` (rosetta #245, dispatch-only). Young. |
| Jobs run package scripts | site-04, rosetta-12 | `tikoci-toolchain` (task entry points), `tikoci-linting` (one gate). |
| Per-PR tiers; the smoke recipe | quickchr-014, quickchr-112 | `integration-cadence` (3a): smoke per code PR, sweep nightly. centrs `ci.yaml` `chr-smoke`: staged behind `checks` and `unit-linux`, resolve with `scripts/chr-cache-key.ts`, cache, `chr:prefetch` (#468), then `test:integration:smoke` (centrs review of PR #28). The KVM open probe: quickchr `integration.yml` (`linux-arm64` had `/dev/kvm` and failed `-accel kvm` 12 of 12). The smoke job moved to patterns.md (maintainer, PR #28: recipes over structure). |
| Docs-only by job `if:`, not `paths:` | - | A README only lint reads stays docs: quickchr `validate-examples.ts`, `main.yml` `paths-ignore`. centrs `scripts/ci-changes.ts` header and `test/unit/ci-changes.test.ts`; `tikoci-pr-flow` (path detection is the default). quickchr `main.yml` uses `paths-ignore` and is not a required check. File-list caps, as centrs uses them (`PR_FILES_CAP = 3000`, `COMPARE_FILES_CAP = 300`, `previous_filename` for renames): [list pull request files](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files), [compare two commits](https://docs.github.com/en/rest/commits/commits#compare-two-commits) (Codex review of PR #28). |
| One gate job; `main` health outside it | - | Preferred path, not yet centrs practice: centrs requires six checks by name (`Repo checks`, `Unit tests & coverage`, `Build`, `CHR smoke (stable)`, `Main health (nightly QA)`, `CodeRabbit`), and `Unit tests & coverage` aggregates only the unit matrix (centrs review of PR #28). `tikoci-github` (gate jobs, not a bot's check). |
| Codex round 2 on PR #28 | - | Compare `status` must be `ahead` (centrs `scripts/ci-changes.ts`); the probe's answer through `QUICKCHR_ACCEL` (quickchr `src/lib/platform.ts`, `detectAccel`); `timeout --kill-after`; `GITHUB_RUN_ATTEMPT` increments on a rerun while `GITHUB_RUN_ID` stays ([default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#default-environment-variables)); app-t3code `bun run test` runs `test/app-yaml.test.ts`. |
| Timeouts nest | - | quickchr `integration.yml` header and test step (step = job − 10 min), #76, #144. |
| Cancelling superseded runs on `main`; `queue: max` | - | quickchr `ci.yml` and `main.yml` `concurrency`; `ci-freshness.ts` skips cancelled runs. One pending run per group by default, `queue: max` for up to 100 and never with `cancel-in-progress: true` ([workflow syntax: `concurrency`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency); CodeRabbit on PR #28). |
| `main`-health check | quickchr-014, quickchr-112 | quickchr `scripts/ci-freshness.ts` reads any completed `main.yml` run on `main`, dispatches included; centrs `scripts/qa-nightly.ts` (`Main health (nightly QA)`) counts only scheduled sweeps (Codex review of PR #28). |
| The Bun version | - | Settles `bun-ci-version` (maintainer, 2026-11-16, and the PR #28 reviews): the dispatch input on workflows that test; the weekly run on `latest` for tools on users' Bun, not for a repo that ships its own (app-t3code); red files an issue. Scheduled-run notifications go only to the cron line's last editor, and public-repo schedules stop after 60 days without activity ([events: `schedule`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)); the badge's `event` filter ([status badges](https://docs.github.com/en/actions/how-tos/monitor-workflows/add-a-status-badge)). The pin-check loophole is from the quickchr agent's review. No Bun override on release or deploy: centrs `release.yaml` and `pages.yaml` run setup-bun. A skip-if-unchanged nightly: centrs `scripts/qa-nightly.ts` `Fingerprint` is `{ sha, versions }`. setup-bun v2.2.0 `src/index.ts` reads `bun-version`, then `bun-version-file`, then package.json. Latest Bun on every run today: see [adoption.md](adoption.md). |
| Dispatch inputs with safe defaults | centrs-32 | centrs `github-actions-dispatch.instructions.md`. |
| Agents dispatch to ground; one reusable workflow; plan job | quickchr-115 | quickchr `integration.yml` (#29). |
| Lab never gates | centrs-32 | centrs `lab.yaml`, quickchr `lab.yml`. |
| Summary for the verdict, artifacts for depth | centrs-33 | centrs `github-actions-rich-data.instructions.md`; quickchr "Artifacts — Where to Look After a Failure". |
| `include-hidden-files` | quickchr-126 | |
| Capture before cleanup | mikropkl-28 | mikropkl "Boot diagnostics"; quickchr `failures/boot-failure-*.json`. |
| Machine-read values from a marker line | restraml-40 | Retired practice: restraml removed its nightly build in 0d35b78 (#121, 2026-10-28); the rule is in the [pre-removal `CLAUDE.md`](https://github.com/tikoci/restraml/blob/5f1e490037144d655c2c1ad503f4761043658f34/CLAUDE.md#L1013-L1019). |
| Coverage read, never a gate | centrs-33 | `coverage-gate` (3b, `tikoci-testing`). |
| Failures and flakes | - | Settles `ci-retry` (maintainer, 2026-11-16, and the PR #28 reviews: red is a finding, a retry only investigates a tracked flake). centrs's standing retry: `qa.yaml` lines 295–313, Linux legs including must-pass `stable` and `long-term`; its Windows and Intel Mac legs are in `verify-extended.yaml`, dispatch-only. Why a read flake needs a cheap clear: `Main health` reads only scheduled sweeps and the pre-flight skips unchanged nights. centrs evidence writer: `recordIntegrationEvidence`, `CENTRS_INTEGRATION_REPORT`. Every-file records: quickchr `ci-data` `test-file` rows. No retry on a hang, budget, reap: quickchr #77, #110. centrs `qa.yaml` "Commit accumulated history" still rebases. centrs `qa.yaml` retries each failed integration file once with annotations; its pre-release legs are `continue-on-error`, defined in `scripts/qa-results-db.ts` (`channelPolicy`). quickchr `integration.yml` has no `continue-on-error`. |
| zizmor report, triage, gate | - | From 3b (`tikoci-linting`) and 3c (`tikoci-github`). Narrow suppressions (`# zizmor: ignore[...]`, `unpinned-uses` policies) checked with zizmor 1.32.0 in the PR #28 review; quickchr PR #223 floats `setup-node`. A missing tool fails under `CI`: quickchr `scripts/lint-shell.sh` skips today. zizmor-action v0.8.1 `action.yml` (SARIF upload, category `zizmor`; its README: no failure on findings in this mode). zizmor [exit codes](https://docs.zizmor.sh/usage/#exit-codes): 0 in SARIF mode, 11 to 14 by highest severity; checked with zizmor 1.32.0 on this repo (SARIF 0, plain 14). centrs `codeql.yaml` runs zizmor this way today. |
| Rejected bot push stays failed | restraml-27, site-11 | Settles `rejected-bot-push`. |
| Side branch for bot data; fold, never rebase | - | quickchr `ci-data` (`ci.instructions.md` "CI metrics", #126). |
| Never rerun a Pages deploy | site-11 | This repo's `deploy-pages.yaml` and `docs/refresh-data.md`. |
| Waiting on runs | user-112, user-113 | The id recorded before a dispatch: CodeRabbit on PR #28. Absorbs the user-level `gh-actions-waiting` skill (from its survey `intent`; the file is not on every machine). |
| Caches keyed on the resolved version | quickchr-130 | quickchr `scripts/ci-cache-key.ts`, #91, #101, #104. |
| Dependency audit: the scheduled run reports, a PR fails on its own lockfile change | - | tikoci.github.io #31: Codex noted a per-PR gate turns unrelated PRs red when an advisory is published. `bun audit` read `bun.lock` with no `node_modules` (Bun 1.4.4); the step ran under `bash -eo pipefail` against a stub `bun` for pull_request, push, schedule and dispatch. #33 review (Codex): `HEAD^1` missed a lockfile change earlier in a multi-commit push, and a registry error (`.npmrc` pointing at a closed port) also exits 1, with no JSON report; both fixed and re-run. |

## Starting files

Both, and the workflow recipes in `patterns.md` assembled into one
workflow, run clean with actionlint 1.7 (with shellcheck 0.11.0) and zizmor
1.32.0 (`--persona pedantic`, online audits on). The action SHAs are the latest
releases on 2026-11-16: actions/checkout v7.0.1, oven-sh/setup-bun v2.2.0,
actions/upload-artifact v7.0.2, zizmorcore/zizmor-action v0.8.1. The
`changes` step was run under `bash -eo pipefail` against the live API (this
PR and a rename commit) and a stubbed `gh` (a code-to-docs rename, a list at
the 300 cap, docs only, an API error, a schedule); the flake-investigation
loop in `patterns.md` was run against a stubbed `bun` (pass, flaky, failing
twice, hanging, a failure outside the issue's files). The `report` job's
issue lookup was run against this repo's issues.

## Not taken

- user-92 (choosing CodeQL default or advanced setup) and user-93 (a
  dependency-review workflow) are settled in `tikoci-github`: default setup,
  and dependency review off.
- user-94 (a CI probe for AI findings) depends on Code Quality, a paid
  feature the house does not use (`paid-features`).
