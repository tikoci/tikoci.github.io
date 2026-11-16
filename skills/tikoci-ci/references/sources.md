# Sources

The rules in [tikoci-ci](../SKILL.md) come from the November 2026 survey of
tikoci instruction files and skills, the workflows of centrs, quickchr,
rosetta, restraml, mikropkl and this repo (read on 2026-11-16), and the
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
| Jobs run package scripts | site-04, rosetta-12 | `tikoci-toolchain` (task entry points), `tikoci-linting` (one gate). |
| Per-PR tiers | quickchr-014, quickchr-112 | `integration-cadence` (3a): smoke per code PR, sweep nightly. |
| Docs-only by job `if:`, not `paths:` | - | centrs `scripts/ci-changes.ts` header and `test/unit/ci-changes.test.ts`; `tikoci-pr-flow` (path detection is the default). quickchr `main.yml` uses `paths-ignore` and is not a required check. The compare API pages its file list up to 3000 files: [compare two commits](https://docs.github.com/en/rest/commits/commits#compare-two-commits). |
| One gate job | - | centrs `Unit tests & coverage` aggregates the unit legs; `tikoci-github` (gate jobs, not a bot's check). |
| `main`-health check | quickchr-014, quickchr-112 | quickchr `scripts/ci-freshness.ts`; centrs `scripts/qa-nightly.ts` (`Main health (nightly QA)`). |
| The Bun version | - | Settles `bun-ci-version` (maintainer, 2026-11-16): a dispatch input, the weekly scheduled CI run on `latest`, red as the signal. setup-bun v2.2.0 `src/index.ts` reads `bun-version`, then `bun-version-file`, then package.json. `bun-version: latest` today: rosetta `test.yml`, `release-smoke.yml`, `device-map-refresh.yml`; restraml four workflows; vscode-tikbook `build.yaml`. |
| Dispatch inputs with safe defaults | centrs-32 | centrs `github-actions-dispatch.instructions.md`. |
| Agents dispatch to ground; one reusable workflow; plan job | quickchr-115 | quickchr `integration.yml` (#29). |
| Lab never gates | centrs-32 | centrs `lab.yaml`, quickchr `lab.yml`. |
| Summary for the verdict, artifacts for depth | centrs-33 | centrs `github-actions-rich-data.instructions.md`; quickchr "Artifacts — Where to Look After a Failure". |
| `include-hidden-files` | quickchr-126 | |
| Capture before cleanup | mikropkl-28 | mikropkl "Boot diagnostics"; quickchr `failures/boot-failure-*.json`. |
| Machine-read values from a marker line | restraml-40 | |
| Coverage read, never a gate | centrs-33 | `coverage-gate` (3b, `tikoci-testing`). |
| Retries and flakes | - | Settles `ci-retry` (maintainer, 2026-11-16). centrs `qa.yaml` retries each failed integration file once with annotations; its pre-release legs are `continue-on-error`, defined in `scripts/qa-results-db.ts` (`channelPolicy`). quickchr `integration.yml` has no `continue-on-error`. |
| zizmor report, triage, gate | - | From 3b (`tikoci-linting`) and 3c (`tikoci-github`). zizmor-action v0.8.1 `action.yml` (SARIF upload, category `zizmor`; its README: no failure on findings in this mode). zizmor [exit codes](https://docs.zizmor.sh/usage/#exit-codes): 0 in SARIF mode, 11 to 14 by highest severity; checked with zizmor 1.32.0 on this repo (SARIF 0, plain 14). centrs `codeql.yaml` runs zizmor this way today. |
| Rejected bot push stays failed | restraml-27, site-11 | Settles `rejected-bot-push`. |
| Side branch for bot data; fold, never rebase | - | quickchr `ci-data` (`ci.instructions.md` "CI metrics", #126). |
| Never rerun a Pages deploy | site-11 | This repo's `deploy-pages.yaml` and `docs/refresh-data.md`. |
| Waiting on runs | user-112, user-113 | Absorbs the user-level `gh-actions-waiting` skill (from its survey `intent`; the file is not on every machine). |
| Caches keyed on the resolved version | quickchr-130 | quickchr `scripts/ci-cache-key.ts`, #91, #101, #104. |

## Starting files

Both run clean with actionlint 1.7 (with shellcheck 0.11.0) and zizmor 1.32.0
(`--persona pedantic`, online audits on). The action SHAs are the latest
releases on 2026-11-16: actions/checkout v7.0.1, oven-sh/setup-bun v2.2.0,
actions/upload-artifact v7.0.2, zizmorcore/zizmor-action v0.8.1. The
`changes` step was checked with GNU grep under `bash -eo pipefail`, including
a 200,000-line list; the recorded retry in `patterns.md` was run against a
stubbed `bun`.

## Not taken

- user-92 (choosing CodeQL default or advanced setup) and user-93 (a
  dependency-review workflow) are settled in `tikoci-github`: default setup,
  and dependency review off.
- user-94 (a CI probe for AI findings) depends on Code Quality, a paid
  feature the house does not use (`paid-features`).
