---
name: tikoci-ci
description: "tikoci CI recipes, with example workflows in assets/: jobs run the package scripts; fast PR gates; docs-only diffs skip heavy jobs by a job if, never paths: on a required workflow; one gate job is the required check; Bun pin with a bun-version dispatch input, latest Bun weekly for tools on users' Bun; dispatch QA from any branch; summaries and artifacts agents can read; red is a finding, retries only investigate a tracked flake; bun audit on a PR or push that changes bun.lock or any package.json, weekly, and before every release or publish, never on an ordinary PR or push; soft gates get a periodic signal; zizmor to code scanning. Use when writing or debugging a workflow or waiting on a run."
---

# CI

The preferred paths for tikoci GitHub Actions workflows, catalogued from
what the repos have already paid for: how they are laid out, what they run
and what they report. A repo picks the ones it needs. The example workflows
show them together as working files, not as a structure every repo copies:
a CLI tool that runs on its users' Bun and boots CHRs (quickchr, centrs)
needs more of this than a container project that ships its own Bun.

Repository settings (protection, the read-only token, code scanning) are in
[tikoci-github](https://tikoci.dev/house/skills/tikoci-github/SKILL.md);
action pins in
[tikoci-dependencies](https://tikoci.dev/house/skills/tikoci-dependencies/SKILL.md);
the test tiers CI runs in
[tikoci-testing](https://tikoci.dev/house/skills/tikoci-testing/SKILL.md);
the linters in
[tikoci-linting](https://tikoci.dev/house/skills/tikoci-linting/SKILL.md);
the Bun pin in
[tikoci-toolchain](https://tikoci.dev/house/skills/tikoci-toolchain/SKILL.md).
Examples: [ci.example.yml](assets/ci.example.yml) and
[zizmor.example.yml](assets/zizmor.example.yml). Recipes (the docs-only
classifier, a device smoke job, a new RouterOS version as a trigger,
caches, a flake investigation, failure evidence, bot data, waiting) are in
[references/patterns.md](references/patterns.md).

## Workflows

| Workflow | Triggers | Runs | Gates |
| --- | --- | --- | --- |
| CI | PR and push to `main`, dispatch, weekly where it applies | lint, unit on each OS with coverage, smoke integration on code changes where the repo has device behavior | yes, through one gate job |
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
- **On Windows, know which shell a test step runs in.** Git Bash is not
  neutral: it sets `HOME` and MSYS path handling, which a PowerShell session
  usually lacks, so code that reads `env.HOME` takes a different branch from
  the one most Windows users hit. tikoci Bun code is meant to work on every
  platform either way: a fallback such as `env.HOME ?? homedir()` (centrs)
  is a reasonable safeguard, and a unit test with `HOME` set and unset
  covers both branches from one `bash` script. Where the users' shell
  matters more than one script, the Windows test step runs under
  `shell: pwsh` and checks `$LASTEXITCODE` itself.
- **Untrusted values reach a script through `env:`**, never as `${{ }}`
  inside `run:`: a PR title, branch name or dispatch input is shell code
  there (zizmor `template-injection`).
- **`timeout-minutes` on every job**, from the measured duration plus
  headroom. A timeout rises only once you know why the job got slower
  ([tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md)).
- **Timeouts nest, each leaving room for the reporting after it**: job,
  then the long step, then each test file. A job timeout cancels the job,
  so its summary and upload steps never run; a step timeout fails only that
  step. The job's timeout covers setup, the step's cap and the reporting
  together, so a hang reaches the step timeout first: budget from the
  measured setup time, not only the test. quickchr sets the test step 10
  minutes under the job, after weeks of hung legs with no artifacts (#76,
  #144).
- **`concurrency` per PR, with `cancel-in-progress` for PR runs.** A
  test-only workflow on `main` may also cancel a superseded run when
  everything that reads its results skips cancelled runs (quickchr
  `main.yml` and `ci-freshness.ts`): it saves runner time, while finishing
  gives every `main` commit a verdict to bisect with. Data, deploy and
  history-writing jobs never cancel: that can drop a commit or a record.
  Their group also sets `queue: max`: with `cancel-in-progress: false`
  alone, a newer pending run still replaces the one already pending.
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
- **Per PR: lint, unit on each OS the tool supports, coverage, and, for a
  repo with device behavior, the smoke integration tier on code changes**
  (`tikoci-testing`; the job is a recipe in patterns.md). Minutes, not tens
  of minutes. The channel sweep runs nightly, not per PR.
- **A smoke test checks the final form from the product's side**: a quick,
  broad "does the built thing work the way someone uses it", where unit and
  integration tests aim at the code and the systems it talks to. Its shape
  follows the product: a CLI against a CHR (centrs), a container installed
  as a RouterOS `/app` (app-t3code).
- **Stage the device job behind the cheap ones**: smoke `needs` lint and
  the Linux unit job and runs only when they passed, so a lint failure does
  not boot a CHR for ten minutes (centrs `chr-smoke`).
- **Docs-only diffs skip the heavy jobs** through a `changes` job and a
  job-level `if:`, **never a workflow-level `paths:` or `paths-ignore:`** on a
  workflow with a required check: a required check whose workflow never
  started stays pending forever, while a job skipped by `if:` reports
  success. `paths:` is fine on a workflow no required check depends on
  (quickchr `main.yml`).
- **A skip must be earned**, since it reads as green. The classifier answers
  "run everything" on any error, a partial file list, a schedule or a
  dispatch, and checks both names of a renamed file, and the `if:` tests
  `!= 'false'` so a missing answer runs too. A file read by a job the
  classifier can skip is code, not docs; a README only lint reads stays
  docs, since lint and spelling always run. The recipe's inline step is a
  start; centrs `scripts/ci-changes.ts` is the tested version, with a unit
  test that fails when a test starts reading a path it calls docs-only.
- **One gate job is the required check** (`CI gate` in the example): it
  `needs` every job and fails if any failed or was cancelled. Branch
  protection names one stable check whatever the matrix holds; whether to
  require it at all is `tikoci-github`'s rule about bot pushes.
- **A `main`-health check stays outside the gate**, as its own required
  check, so a red `CI gate` always means the PR broke something, and an
  agent waiting on the gate never chases a failure that lives on `main`.
- **A `main`-health check is optional**: a PR check that fails while the
  latest scheduled sweep (centrs) or `main` integration run (quickchr) is
  red, so a red `main` cannot rot quietly. The PR that fixes `main` runs the
  integration workflow on its branch and, where the check reads one,
  carries its override label (centrs `fixes-main`), which passes the health
  check and keeps every other required check. Without a label (quickchr's
  `Integration freshness` reads none), an admin merge, which skips them
  all, is the path (`tikoci-github`). The check says which runs count:
  centrs counts only scheduled sweeps, while quickchr counts any completed
  `main.yml` run on `main`, so a dispatched run on `main` there is a manual
  refresh. A latest-Bun run never feeds it: keep that leg in a workflow or
  job the check does not read.

## The Bun version

Settles `bun-ci-version`. CI runs the `packageManager` pin. Every repo
needs a way to run another Bun on demand; a schedule on `latest` is the
default for a tool that runs on its users' Bun.

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
  empty (`src/index.ts`, v2.2.0), so pushes and PRs get the pin. Without a
  schedule, `BUN_VERSION` is just `${{ inputs.bun-version }}`.
- **A `bun-version` dispatch input on every workflow that tests** (CI, QA,
  integration, lab), empty by default, taking `latest` or an exact
  version. Release and deploy workflows build on the pin only: no input,
  no `BUN_VERSION`, and a release that calls the QA sweep passes no Bun
  override, so nothing published is built on an unpinned Bun. It is how a
  Bun bump is tried before the pin moves, and how a "breaks on Bun X"
  report is reproduced. Good dispatch inputs are the core of this rule; see
  "Dispatch for QA".
- **A weekly scheduled CI run on `latest`, for a tool that runs on its
  users' Bun**: a CLI or library people install with `bunx` or npm (centrs,
  quickchr), where a developer machine or sandbox brings whatever Bun it
  has. The same jobs, not a second mechanism; never on a PR, never
  required. A repo that ships its own Bun (a container image built with it,
  app-t3code) keeps the input and can skip the schedule, since its users
  never meet another Bun.
- **Red is the signal, and something has to file it.** GitHub mails a
  scheduled run's failure only to whoever last edited the cron line, so the
  example's `report` job opens an issue, or comments on the open one. Our
  bug gets fixed; a Bun regression gets an upstream issue linked from ours,
  and the pin stays until Bun fixes it.
- **Tell Bun from the rest**: a scheduled run also meets whatever else
  floats that week (RouterOS `stable` in a device job, the runner image).
  Dispatch the same commit with `bun-version` empty. If that fails the same
  jobs with the same errors, the cause is not Bun; a different failure (an
  infrastructure one, say) settles nothing, so compare before ruling Bun
  out.
- **Keep the badge on the pin**: a README badge shows the workflow's latest
  run, so filter it, `badge.svg?branch=main&event=push`.
- **GitHub disables the schedules of a public repo after 60 days without
  activity**, without a failure: a quiet repo loses its weekly run until
  someone re-enables it in the Actions tab.
- A repo with a nightly sweep may run the latest-Bun leg there instead,
  outside the must-pass set and outside whatever its `main`-health check
  reads. A sweep that skips itself when nothing changed (centrs fingerprints
  the commit and the resolved RouterOS versions) adds the resolved latest
  Bun to that fingerprint, or the leg skips in exactly the quiet weeks a new
  Bun lands; otherwise keep the leg on CI's weekly schedule.
- **The pin check** (`tikoci-toolchain`) accepts exactly this
  `bun-version: ${{ env.BUN_VERSION }}` line next to `bun-version-file`, and
  no other inline version, and only while `BUN_VERSION` is defined once, at
  the workflow level, as one of the two expressions above, with no job or
  step `env:` redefining it; otherwise a PR could set it to anything and
  still pass. In a release or deploy workflow it rejects `BUN_VERSION`
  outright.

## Dispatch for QA

- **Every workflow that runs tests has `workflow_dispatch`** (CI, QA,
  integration, lab), with an input for each thing it would otherwise
  assume: Bun version, RouterOS target, platforms, test filter. Release
  takes only what it publishes (the version), never a Bun override.
  Defaults are the safe, pinned choice, and each input's description says
  what it changes. Good inputs make a run's hidden assumptions visible and
  let anyone try a new Bun or RouterOS on a branch without editing a
  workflow.
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
  soon as the process has died (mikropkl). A step timeout, not a job
  timeout, is what lets the upload run ("Every workflow").
- **Machine-read values come from a `key=value` line or a JSON file**, never
  scraped from prose; artifact names say what they hold, not which harness
  made them (restraml).
- **Annotations** (`::error::`, `::warning::`) for the few things a reviewer
  must see. A warning nobody reads is not a gate.
- **Coverage is read, never a gate**: the table in the summary, `lcov` in an
  artifact, no threshold (`tikoci-testing`).

## Failures and flakes

Settles `ci-retry`. A red run is a finding. The house would rather leave a
run red than assume a flake: a retry hides the evidence
[tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md)
asks for.

- **No retry as a process**: not in the unit tier, not in anything that
  runs per PR, not as a standing step of a sweep. A test that fails
  sometimes is a bug to find, and a red sweep leg is something to read.
- **A retry is an investigation tool.** While an open issue investigates a
  flake in a device sweep's legs, the sweep may retry the files that issue
  names once, to collect data without losing the rest of the sweep's
  signal. The issue says what data would close it, and the retry goes when
  it closes. The recipe is in patterns.md.
- **Every file writes a record each run**, not only the retried ones: file,
  attempts, outcome, the RouterOS version the device reports rather than
  the channel, platform, run, workflow attempt and issue. Prefer the tool's
  own evidence writer (centrs `CENTRS_INTEGRATION_REPORT`) and add what it
  lacks: a file that fails before it writes still needs an outcome. Without
  the files that passed first time there is no rate: 3 retries could be 3
  of 4 runs or 3 of 400. Each retry also gets a `::warning::` and a job
  summary line.
- **Never retry a hang.** A timeout or watchdog kill, or any death by a
  signal, is a different failure from an assertion, and a retry doubles its
  worst case (quickchr's Intel Mac wedge hit the same file 7 times of 7). A
  per-file cap ends in SIGKILL (`timeout --kill-after`), or a test that
  ignores SIGTERM eats the step's budget and every later file's record.
  Budget the step for the retried files' second run.
- **Reap after every failure, and stop when the reap fails.** A tool that
  detaches its VMs (quickchr) leaves one running when `bun test` dies, and
  the next file, or the retry, fails or passes beside it. Stop leftover
  machines after each failed file, wait until they have exited, and end the
  loop with an `::error::` when they will not (quickchr's file watchdog,
  #77).
- **Clearing a read flake is a rerun, tracked in an issue.** Without a
  standing retry, a red scheduled sweep can freeze merges in a repo whose
  `main`-health check reads it, and a sweep that skips unchanged nights
  keeps it red. Once someone has read the failure and opened an issue, or
  added to an existing one, rerun the failed jobs of that run
  (`gh run rerun <id> --failed`): attempt 1's logs stay, the records carry
  the attempt, and the health check reads the run's latest attempt. A rerun
  nobody read first is a retry by hand.
- **Best-effort legs** (pre-release channels in centrs) are declared in one
  policy place, use `continue-on-error`, and record their failures. A gating
  job never has `continue-on-error`.

## zizmor

- **Start from [zizmor.example.yml](assets/zizmor.example.yml)**: zizmor
  uploads SARIF to code scanning (category `zizmor`) beside CodeQL default
  setup, with `security-events: write` on that job only. In SARIF mode it
  exits 0 with findings (zizmor 1.32.0), so the workflow reports and never
  gates.
- **Triage first** (`tikoci-github`), before the Security tab fills: fix
  each finding, or suppress it as narrowly as it allows, with the reason
  beside it. A trailing `# zizmor: ignore[unpinned-uses]` covers one line; a
  policy (`rules.unpinned-uses.config.policies`) exempts one action and
  keeps the rest pinned. Disable a rule in `zizmor.yml` (repo root or
  `.github/`) only when it is wrong for the whole repo.
- **Then gate in the lint script**: `uvx zizmor@<version> --offline .` exits
  non-zero on findings (14 for high). CI installs uv. A local run without uv
  says so and skips, but with `CI` set a missing tool fails, or the gate
  disappears the day an install step breaks (`tikoci-linting`). Pin the
  zizmor version in both places once it gates, so new audits arrive in a
  reviewed bump.

## Soft gates get a periodic signal

A check that does not gate every PR still needs a routine run and a signal
someone sees when it is red. Examples: an audit of unchanged dependencies,
zizmor's online audits, the latest Bun, a device sweep. By default the
signal is the scheduled run's `report` job, which opens or updates an issue.
Another scheme works if a person reads it (a `main`-health check, a
dashboard). The principle weighs most for what a repo ships (an npm
package, a container image), where a finding that escapes reaches users.
Internal CI and dev tooling still get the routine run, at lower priority.

## Dependency audit

`bun audit` is the vulnerability check for Bun packages, which Dependabot
security updates do not cover
([tikoci-dependencies](https://tikoci.dev/house/skills/tikoci-dependencies/SKILL.md)).
Advisories arrive without a commit, so an audit on every PR would fail
unrelated work. Settles `audit-gating` (maintainer, 2026-11-17): the audit
runs when dependencies change, routinely out of band, and before anything
ships. The `audit` job in [ci.example.yml](assets/ci.example.yml) decides
whether to audit; the audit itself is one script,
[audit.example.ts](assets/audit.example.ts) (`bun run audit`), which the
release workflow runs too, so the checks and the ignore list exist once:

- **Never on an ordinary PR.** A PR or push that changes neither
  `bun.lock` nor any `package.json` (each workspace has its own) does not
  call `bun audit` at all. One that changes them is audited, and any finding
  fails it: updating
  dependencies is the time to check them. A PR compares its merge commit
  with the first parent (`fetch-depth: 2`); a push compares its whole range
  from `github.event.before`. A new branch, or a base that cannot be
  fetched, audits in full.
- **Routinely, out of band.** The example's weekly scheduled run audits
  everything, and the `report` job opens or updates its issue. Where the
  routine audit lives is the repo's choice (its own weekly workflow, a
  nightly sweep), as long as one exists.
- **Before anything ships.** A release or publish workflow (npm package,
  container image) runs the same script first and stops on findings; `tikoci-release` owns that workflow. A deploy that
  publishes on a timer (tikoci.github.io deploys hourly snapshots) may rely
  on the routine audit instead, noted under `## House exceptions`; an npm
  package or container never does.
- **An audit that did not complete fails** wherever it runs. Bun exits 1
  both for advisories and when the registry is unreachable or answers with
  an error object; a scoped registry that fails only prints a `warn:` that
  its packages were skipped, and exits 0. So any `warn:` or `error:` line
  from `bun audit` fails the script, and the advisory-report check (every
  package mapping to advisories with an `id` and a `severity`) only says
  which failure it was.
- **It needs no `bun install`**: `bun audit` reads `bun.lock`, and the
  script uses only Bun.
- **An advisory with no fixed release in range** goes in the script's
  ignore list by its id (`GHSA-...`), with the reason and the removal
  condition beside it
  ([tikoci-linting suppressions](https://tikoci.dev/house/skills/tikoci-linting/references/suppressions.md)).

## Container apps

A repo that ships a RouterOS `/app` container (app-t3code, rosetta) tests
the image where it runs: under RouterOS `/container` on a CHR, not Docker
(`tikoci-toolchain`). The pattern is young, mostly from app-t3code, so it
is a pointer, not a settled rule; the logic is in patterns.md ("A RouterOS
`/app` container"):

- **PRs build, `main` publishes a candidate, a later job promotes it.** The
  release tags move only after the candidate passed, and only while its
  commit is still `main`'s head.
- **The CHR test runs after the publish**, from the published image, on
  each architecture, and on a schedule and by dispatch with the RouterOS
  version as an input.
- **The Bun inside the image is the product's Bun**: a `bun-version` input
  to try a new one, no weekly latest-Bun run.
- rosetta's dispatch-only `app-integration.yml` is the CHR install test on
  its own; a repo whose `/app` YAML points at someone else's image can take
  that stage alone.

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

## Adoption

What each repo changes when it adopts, and the fixes the skill's reviews
found in other repos, are in
[references/adoption.md](references/adoption.md). They are point-in-time
and leave as each repo adopts.

## Sources

[references/sources.md](references/sources.md) lists the survey rows, repo
files and docs behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
