---
name: tikoci-ci
description: "tikoci CI workflows, starting files in assets/: jobs run the package scripts; fast PR gates; docs-only diffs skip heavy jobs by a job if, never paths: on a required workflow; one gate job is the required check; Bun pin, plus latest Bun weekly and by dispatch input; dispatch QA from any branch; summaries and artifacts agents can read; one recorded retry in device sweeps, none per PR; zizmor to code scanning. Use when writing or debugging a workflow or waiting on a run."
---

# CI

How tikoci GitHub Actions workflows are laid out, what they run and what
they report. Repository settings (protection, the read-only token, code
scanning) are in
[tikoci-github](https://tikoci.dev/house/skills/tikoci-github/SKILL.md);
action pins in
[tikoci-dependencies](https://tikoci.dev/house/skills/tikoci-dependencies/SKILL.md);
the test tiers CI runs in
[tikoci-testing](https://tikoci.dev/house/skills/tikoci-testing/SKILL.md);
the linters in
[tikoci-linting](https://tikoci.dev/house/skills/tikoci-linting/SKILL.md);
the Bun pin in
[tikoci-toolchain](https://tikoci.dev/house/skills/tikoci-toolchain/SKILL.md).
Starting files: [ci.example.yml](assets/ci.example.yml) and
[zizmor.example.yml](assets/zizmor.example.yml). Longer patterns (caches,
retries, failure evidence, bot data, waiting) are in
[references/patterns.md](references/patterns.md).

## Workflows

| Workflow | Triggers | Runs | Gates |
| --- | --- | --- | --- |
| CI | PR and push to `main`, weekly, dispatch | lint, unit on each OS with coverage, smoke integration on code changes | yes, through one gate job |
| QA or sweep | nightly, dispatch, called by release | every active RouterOS channel, slow options | must-pass legs only; may feed a `main`-health check |
| Integration | dispatch, called by other workflows | any platform × RouterOS target × test filter, from any branch | never required |
| Lab | dispatch | experiments, with a `REPORT.md` | never |
| zizmor | PR and push to `main`, weekly, dispatch | workflow audit to code scanning | report first, then the lint gate |
| Release | dispatch from `main` | see `tikoci-release` | its own checks |
| Data or deploy | schedule, dispatch | collect, validate, commit, publish | n/a |

A repo has the rows it needs: a repo without device behavior has CI and
zizmor, and that is complete.

## Every workflow

- **`permissions: contents: read` at the top**, raised per job for what that
  job writes (`tikoci-github`). Every action pinned to a SHA
  (`tikoci-dependencies`).
- **`actions/checkout` with `persist-credentials: false`**, unless the job
  pushes (zizmor `artipacked`).
- **`defaults: run: shell: bash`.** An explicit `bash` runs
  `bash --noprofile --norc -eo pipefail`; the unspecified default runs
  `bash -e`, so `bun test | tee out.txt` reports the exit code of `tee`.
  quickchr's first arm64 run was green with every CHR test failing. On
  Windows, explicit `bash` is Git Bash instead of PowerShell, so one script
  serves every OS.
- **Untrusted values reach a script through `env:`**, never as `${{ }}`
  inside `run:`: a PR title, branch name or dispatch input is shell code
  there (zizmor `template-injection`).
- **`timeout-minutes` on every job**, from the measured duration plus
  headroom. A timeout rises only once you know why the job got slower
  ([tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md)).
- **`concurrency` per PR with `cancel-in-progress` for PR runs only.** A
  push to `main`, a schedule and a deploy finish; cancelling a data or deploy
  run can drop a commit.
- **`run:` blocks stay short.** Logic past a few lines moves to a
  `scripts/*.ts` a developer can run, and the workflow or the developer docs
  give each job's local command.
- **One mechanism per job kind.** Two jobs that do the same thing two ways
  rot apart, and the one nobody watches breaks unnoticed (restraml's x86 and
  arm64 package installs, four months). Debugging one platform never forks
  its mechanism "for now".
- **Setup verifies, it does not trust.** An installer can exit 0 having
  installed nothing (`choco install` on a 504): assert the binary exists and
  fail with `::error::` naming it infrastructure, so a setup failure never
  shows up as a test failure. A step whose purpose is to make something
  happen asserts that it happened.
- **Quiet, fail-fast installs and downloads**:
  `DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends`
  inside `::group::`, `curl -fsSL`.
- **Record versions CI does not pin** (QEMU, the runner image, the Bun that
  ran) in the job summary (`tikoci-toolchain`).

## Fast PR gates

- **Jobs run the package scripts**, not copies of their steps:
  `bun run lint`, `bun run test:coverage`, `bun run test:integration`, the
  parts of `bun run check`. A red job reproduces with one local command.
- **Per PR: lint, unit on each OS the tool supports, coverage, and the smoke
  integration tier on code changes** (`tikoci-testing`). Minutes, not tens of
  minutes. The channel sweep runs nightly, not per PR.
- **Docs-only diffs skip the heavy jobs** through a `changes` job and a
  job-level `if:`, **never a workflow-level `paths:` or `paths-ignore:`** on a
  workflow with a required check: a required check whose workflow never
  started stays pending forever, while a job skipped by `if:` reports
  success. `paths:` is fine on a workflow no required check depends on
  (quickchr `main.yml`).
- **A skip must be earned**, since it reads as green. The classifier answers
  "run everything" on any error, a partial file list, a schedule or a
  dispatch, and the `if:` tests `!= 'false'` so a missing answer runs too. A
  Markdown file a test or build reads is code, not docs. Lint and spelling
  always run. The example's inline step is a start; centrs
  `scripts/ci-changes.ts` is the tested version, with a unit test that fails
  when a test starts reading a path it calls docs-only.
- **One gate job is the required check** (`CI gate` in the example): it
  `needs` every job and fails if any failed or was cancelled. Branch
  protection names one stable check whatever the matrix holds; whether to
  require it at all is `tikoci-github`'s rule about bot pushes.
- **A `main`-health check is optional**: a PR check that fails while the
  latest scheduled sweep (centrs) or `main` integration run (quickchr) is
  red, so a red `main` cannot rot quietly. The PR that fixes `main` runs the
  integration workflow on its branch and is merged by an admin
  (`tikoci-github`). The check reads only the runs it means: a dispatched or
  latest-Bun run never clears or reddens it.

## The Bun version

Settles `bun-ci-version`. CI runs the `packageManager` pin, and checks the
latest Bun on a schedule, so a Bun regression shows up without a standing
chore and never on someone's unrelated PR.

- **Each `setup-bun` step reads the pin and an optional override**:

  ```yaml
  env:
    BUN_VERSION: ${{ github.event_name == 'schedule' && 'latest' || inputs.bun-version }}
  # ...
  - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
    with:
      bun-version: ${{ env.BUN_VERSION }}
      bun-version-file: package.json
  ```

  setup-bun reads `bun-version` first and falls back to the file when it is
  empty (`src/index.ts`, v2.2.0), so pushes and PRs get the pin.
- **A `bun-version` dispatch input** (empty by default) on the CI and QA
  workflows, so anyone can run a branch on `latest` or an exact version.
- **The weekly scheduled run of CI uses `latest`**: the same jobs, not a
  second mechanism, with the Bun that ran in the summary. It never runs on a
  PR and is never required. It may go red, and red is the signal: open an
  issue. Our bug gets fixed; a Bun regression gets an upstream issue linked
  from ours, and the pin stays until Bun fixes it. A repo with a nightly
  sweep may run the latest-Bun leg there instead, outside the must-pass set
  and outside whatever its `main`-health check reads.
- **The pin check** (`tikoci-toolchain`) accepts exactly this
  `bun-version: ${{ env.BUN_VERSION }}` line next to `bun-version-file`, and
  no other inline version. rosetta, restraml and vscode-tikbook install
  `latest` on every run today and move to the pin on adoption.

## Dispatch for QA

- **QA, integration, lab and release workflows have `workflow_dispatch`**
  with safe defaults, and each input says what it changes: RouterOS target,
  platforms, test filter, Bun version. Inputs make the hidden assumptions of
  a run visible.
- **Agents dispatch to ground a claim** on a platform they do not have:
  `gh workflow run integration.yml --ref <branch> -f platforms=macos-arm64 -f test-filter=exec.test.ts`
  (quickchr). Device integration runs are dispatchable so a PR can link the
  run that proves it (`tikoci-pr-flow` template).
- **One reusable workflow owns each heavy mechanism** (`workflow_call` plus
  `workflow_dispatch`); the PR, nightly and release workflows call it
  instead of defining their own runner logic (quickchr `integration.yml`).
- **A plan job validates the inputs** and fails on an unknown platform, a
  malformed target or two legs that resolve to the same thing, so a typo
  never produces an empty green run.
- **Lab jobs never gate**: findings go to the summary, an artifact and the
  lab's `REPORT.md`.

## Output agents can read

- **The job summary carries the verdict**: what ran, on which versions, the
  tail of a failure, the coverage table. Short enough to read in one pass.
- **Artifacts carry the depth**: full logs, `lcov.info`, machine logs,
  failure files, with `retention-days` set (7 to 14). Upload with
  `if: ${{ !cancelled() }}` or `failure()`, so the evidence of a failure
  survives it. `upload-artifact` drops dot paths unless
  `include-hidden-files: true`, and the upload is then silently empty.
- **Capture before cleanup.** On a timeout, dump the process state, logs
  and monitor output before tearing the machine down, and stop waiting as
  soon as the process has died (mikropkl).
- **Machine-read values come from a `key=value` line or a JSON file**, never
  scraped from prose; artifact names say what they hold, not which harness
  made them (restraml).
- **Annotations** (`::error::`, `::warning::`) for the few things a reviewer
  must see. A warning nobody reads is not a gate.
- **Coverage is read, never a gate**: the table in the summary, `lcov` in an
  artifact, no threshold (`tikoci-testing`).

## Retries and flakes

Settles `ci-retry`. A retry hides the evidence
[tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md)
asks for, unless it is recorded.

- **No retries in the unit tier or anything that runs per PR.** A unit test
  that fails sometimes is a bug.
- **The device integration sweep may retry a failed file once**, because a
  real CHR in a shared runner has timing CI cannot control. Each retry is
  recorded: a `::warning::` naming the file, a line in the job summary, and a
  record (file, attempt, outcome, RouterOS version, platform, run) in the
  run's history, an artifact or a data branch. A real regression fails both
  attempts and still gates.
- **Those records are the flake statistics.** A file that needs its retry
  repeatedly gets an issue and a local repro, never a raised timeout or a
  skip. centrs retries per file in `qa.yaml` with annotations only; it adds
  the record on adoption.
- **Best-effort legs** (pre-release channels in centrs) are declared in one
  policy place, use `continue-on-error`, and record their failures. A gating
  job never has `continue-on-error`.

## zizmor

- **Start from [zizmor.example.yml](assets/zizmor.example.yml)**: zizmor
  uploads SARIF to code scanning (category `zizmor`) beside CodeQL default
  setup, with `security-events: write` on that job only. In SARIF mode it
  exits 0 with findings (zizmor 1.32.0), so the workflow reports and never
  gates.
- **Triage first** (`tikoci-github`): fix each finding, or disable the rule in
  `.github/zizmor.yml` with the reason, before the Security tab fills.
- **Then gate in the lint script**: `uvx zizmor@<version> --offline .` exits
  non-zero on findings (14 for high). CI installs uv; a local run without uv
  says so and skips (`tikoci-linting`). Pin the zizmor version in both places
  once it gates, so new audits arrive in a reviewed bump.

## Bot data and deploys

- **A rejected bot push to `main` stays failed** and a fresh run starts.
  Never force-push, and never reset and retry (restraml's loop is existing
  practice, not the house model). Settled as `rejected-bot-push`.
- **Data that need not deploy from `main` can go to a side branch**
  (quickchr `ci-data`), so `main` keeps required checks (`tikoci-github`).
  Writers to a shared file there fold their record in, never rebase a
  rollup.
- **Never rerun a Pages deploy**: attempts share artifacts, and a second
  `github-pages` artifact blocks the deploy. The workflow rejects
  `GITHUB_RUN_ATTEMPT` other than 1 and says to start a fresh run.

## Waiting on runs

- **`gh run watch <id> --exit-status` and `gh pr checks <n> --watch`**, run
  in the background or through the harness's own wait, never a hand-rolled
  polling loop.
- **An empty or failed lookup is "not done"**, and a connection error is not
  a rate limit.
- **Read a failure in order**: `gh run view <id> --log-failed`, the job
  summary, then `gh run download <id>`. One red run is a lead
  ([tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md)).

## Sources

[references/sources.md](references/sources.md) lists the survey rows, repo
files and docs behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
