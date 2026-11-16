# CI patterns

Longer patterns behind [tikoci-ci](../SKILL.md), each from a tikoci repo that
runs it. Copy the shape, then check the names against the repo you copy into.

## Docs-only classification

A `changes` job answers `heavy=false` only when every path in the PR's file
list (or the pushed range) matches a docs pattern, and a heavy job skips on
that answer with a job-level `if:`. Any error, a list at GitHub's cap, a
schedule or a dispatch answers `heavy=true`:

```yaml
changes:
  name: Classify changes
  runs-on: ubuntu-latest
  timeout-minutes: 5
  permissions:
    contents: read
    pull-requests: read # the PR's file list
  outputs:
    heavy: ${{ steps.classify.outputs.heavy }}
  steps:
    - name: Classify the diff
      id: classify
      env:
        GH_TOKEN: ${{ github.token }}
        PR_NUMBER: ${{ github.event.pull_request.number }}
        BEFORE: ${{ github.event.before }}
        AFTER: ${{ github.sha }}
        # Paths only people, agents and the always-run lint jobs read.
        DOCS_ONLY: '^(docs/.*|[^/]*\.md|LICENSE)$'
      run: |
        # One line per changed file: its name and, for a rename, the old
        # name too, since either may be code. GitHub lists at most 3000
        # files for a PR and 300 for a compare; a list at the cap may be
        # partial, so it runs everything.
        records=""
        cap=0
        case "$GITHUB_EVENT_NAME" in
          pull_request)
            cap=3000
            records=$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/files?per_page=100" \
              --jq '.[] | [.filename, .previous_filename // empty] | join("\t")') || records="" ;;
          push)
            cap=300
            records=$(gh api "repos/$GITHUB_REPOSITORY/compare/$BEFORE...$AFTER" \
              --jq '.files[] | [.filename, .previous_filename // empty] | join("\t")') || records="" ;;
        esac
        count=$(grep -c . <<<"$records" || true)
        names=$(tr '\t' '\n' <<<"$records")
        # A here-string, not a pipe: under pipefail an early `grep -q` exit
        # can fail the writer, and the `!` would turn that into heavy=false.
        heavy=true
        if [ "$count" -gt 0 ] && [ "$count" -lt "$cap" ] && ! grep -qvE "$DOCS_ONLY" <<<"$names"; then
          heavy=false
        fi
        echo "heavy=$heavy" >> "$GITHUB_OUTPUT"
        echo "Heavy jobs: $heavy ($GITHUB_EVENT_NAME, $count files)" >> "$GITHUB_STEP_SUMMARY"
```

The heavy job tests `if: ${{ needs.changes.outputs.heavy != 'false' }}`, so
a missing answer runs it too, and the [gate job](#the-gate-job) adds
`changes` and the heavy job to its `needs`. The job needs `shell: bash` (the
example's `defaults`) for the here-strings and `pipefail`.

centrs
[`scripts/ci-changes.ts`](https://github.com/tikoci/centrs/blob/main/scripts/ci-changes.ts)
is the version to grow into once the rules grow:

- **A path is docs-only when no job the classifier can skip reads it.**
  Prose a test parses (centrs `docs/MATRIX.md`), generated docs, pages the
  build assembles and executable specs (`commands/<name>/examples.md`) are
  code. A README only a lint script reads (quickchr `validate-examples.ts`)
  stays docs-only, because lint always runs.
- **A test guards the list**: `test/unit/ci-changes.test.ts` fails when a
  test, script or source file starts reading a path the module calls
  docs-only.
- **The decision is per event**: a PR whose whole diff against its base is
  docs-only skips, and so does a push to `main` whose diff since the previous
  head is. A PR touching any code runs, even after a later docs-only commit.
  A dispatch, a force push and a lookup error run everything.
- **The script never exits non-zero**: an error prints a warning and answers
  `heavy=true`.
- **The repo checks still run** (lint, spelling), so a docs-only change is
  still checked for what applies to it.

## A device smoke job

For a repo with device behavior: a short integration tier against a real
CHR on code changes (`tikoci-testing`), behind the classifier above and
the cheap jobs. The logic to keep, whatever the shape:

- **Staged**: it runs only after lint and the Linux unit job passed, so a
  lint failure never boots a CHR. With a multi-OS unit matrix, split the
  Linux leg out (centrs `unit-linux`) or the smoke waits for the slowest OS.
- **Its own script**: the repo defines `test:integration:smoke` (centrs:
  `chr:prefetch`, then `chr-smoke.test.ts`); `test:integration` is the whole
  tier.
- **Resolve once, restore, prefetch, then test**: the channel resolves to a
  version that keys the image cache and is the version booted; the smoke
  job only restores (the full sweep owns the key, "Caches" below); and the
  download happens before the test step, never inside a test's timeout
  (centrs #468).
- **A real KVM probe and a step timeout under the job's**, so a hang still
  reports.

Once the repo has a reusable integration workflow, this job is
`uses: ./.github/workflows/integration.yml` with a smoke filter (quickchr:
`platforms: linux-x86` and its `anchor.test.ts` subset), not a second copy
of the QEMU setup. Add a `routeros` dispatch input (default `stable`) for
the target.

````yaml
smoke:
  name: Smoke integration (CHR)
  needs: [changes, lint, unit]
  if: >-
    ${{ !cancelled() && needs.lint.result == 'success' && needs.unit.result == 'success'
    && needs.changes.outputs.heavy != 'false' }}
  runs-on: ubuntu-latest
  timeout-minutes: 25
  steps:
    - name: Checkout
      uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      with:
        persist-credentials: false
    - name: Install QEMU
      run: |
        echo "::group::apt-get install"
        sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends qemu-system-x86 qemu-utils
        echo "::endgroup::"
        command -v qemu-system-x86_64 >/dev/null || { echo "::error::QEMU did not install (infrastructure)"; exit 1; }
    - name: Enable and probe KVM
      run: |
        if [ -e /dev/kvm ]; then sudo chmod 666 /dev/kvm; fi
        # /dev/kvm existing is not KVM working: open it for real.
        pid="$RUNNER_TEMP/kvm-probe.pid"
        if qemu-system-x86_64 -machine none -accel kvm -display none -nodefaults \
            -daemonize -pidfile "$pid" >"$RUNNER_TEMP/kvm-probe.log" 2>&1; then
          kill "$(cat "$pid")" 2>/dev/null || true
          accel=kvm
        else
          accel=tcg
          echo "::warning::KVM did not initialize; the CHR boots under TCG and is much slower."
          cat "$RUNNER_TEMP/kvm-probe.log"
        fi
        echo "- Accelerator: $accel" >> "$GITHUB_STEP_SUMMARY"
    - name: Setup Bun
      uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
      with:
        bun-version: ${{ env.BUN_VERSION }}
        bun-version-file: package.json
    - name: Install dependencies
      run: bun install --frozen-lockfile
    # The repo's resolver: a channel in, `version=<x.y.z>` out to
    # $GITHUB_OUTPUT (centrs scripts/chr-cache-key.ts, quickchr
    # scripts/ci-cache-key.ts). The cache key and the boot use this version.
    - name: Resolve the RouterOS version
      id: resolve
      env:
        ROUTEROS: ${{ inputs.routeros || 'stable' }}
      run: bun scripts/chr-cache-key.ts --channel "$ROUTEROS"
    # Restore only: the full sweep owns this key and saves it.
    - name: Restore the CHR image cache
      uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
      with:
        path: ~/.local/share/quickchr/cache
        key: chr-images-v1-${{ runner.os }}-${{ steps.resolve.outputs.version }}
    - name: Prefetch the CHR image
      env:
        EXAMPLE_ROUTEROS: ${{ steps.resolve.outputs.version }}
      run: bun run chr:prefetch
    - name: Record versions
      env:
        ROUTEROS: ${{ steps.resolve.outputs.version }}
      run: |
        {
          echo "- Bun $(bun --version), RouterOS $ROUTEROS"
          echo "- $(qemu-system-x86_64 --version | head -n 1)"
        } >> "$GITHUB_STEP_SUMMARY"
    # Integration tests boot, check and remove their own CHR (tikoci-testing).
    # The target is the repo's env knob; rename EXAMPLE_ to the tool's prefix.
    - name: Smoke integration
      # 10 minutes under the job's: a step timeout fails this step and the
      # report steps still run; a job timeout cancels them, and a hung CHR
      # leaves no evidence (quickchr #76, #144).
      timeout-minutes: 15
      env:
        EXAMPLE_ROUTEROS: ${{ steps.resolve.outputs.version }}
      run: bun run test:integration:smoke 2>&1 | tee "$RUNNER_TEMP/smoke-output.txt"
    - name: Summarize
      if: ${{ !cancelled() }}
      run: |
        {
          echo "### Smoke integration"
          echo '```text'
          tail -n 40 "$RUNNER_TEMP/smoke-output.txt"
          echo '```'
        } >> "$GITHUB_STEP_SUMMARY"
    # Add the tool's machine logs and failure files to `path`. A data root
    # under a dot directory needs include-hidden-files, or the upload is
    # silently empty.
    - name: Upload diagnostics
      if: ${{ failure() }}
      uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
      with:
        name: smoke-diagnostics
        path: |
          ${{ runner.temp }}/smoke-output.txt
          ${{ runner.temp }}/kvm-probe.log
        include-hidden-files: true
        retention-days: 7
````

A scheduled run on `latest` Bun also boots that week's `stable`, so a red
weekly run has two suspects; the Bun section of tikoci-ci has the dispatch
that tells them apart.

## The gate job

Branch protection names checks by job name, and a matrix job's name changes
with the matrix. One job that `needs` the rest gives a stable name:

```yaml
gate:
  name: CI gate
  if: ${{ always() }}
  needs: [changes, lint, unit, smoke] # every job, the classifier included
  runs-on: ubuntu-latest
  steps:
    - env:
        FAILED: ${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}
      run: '[ "$FAILED" != "true" ] || { echo "::error::A needed job failed or was cancelled."; exit 1; }'
```

`if: always()` makes it run after a failure, which a plain `needs` would
skip, and a skipped required check counts as passed. A job skipped on
purpose (docs-only smoke) has result `skipped` and passes the gate.

## A `main`-health check

When the slow tier does not run per PR, a PR check reports `main` instead:

- quickchr `Integration freshness` (`scripts/ci-freshness.ts`, unit-tested)
  reads the latest completed `main.yml` run on `main`, skipping cancelled
  runs, passes when it is green, and fails with the run's URL when it is red.
- centrs `Main health (nightly QA)` reads the latest scheduled `qa.yaml`
  sweep and fails while a must-pass channel failed. Only scheduled runs
  count, so a dispatched sweep does not clear it.

Both are required checks with "require branches to be up to date" off, and
neither is inside the CI gate. When the PR is the fix, the override is a
label the check reads (centrs `fixes-main`, read live by
`scripts/qa-nightly.ts` `mainHealth`, so rerun the check after labelling):
the PR still needs every other required check. An admin merge skips them
all and is the fallback
([tikoci-github](https://tikoci.dev/house/skills/tikoci-github/SKILL.md)).
After a read flake, rerunning the failed jobs of the red run clears it
when the check reads the run's latest attempt (tikoci-ci, "Failures and
flakes"). Never fix the check by weakening its verdict.

## Caches

From quickchr's CHR image cache (`scripts/ci-cache-key.ts`, issues #91, #101
and #104):

- **An entry is a function of its key.** Key on the resolved version
  (`chr-images-v6-<platform>-7.21.2`), not a channel name (a static key hits
  forever and every later release downloads on every run) and not a run id
  (a guaranteed miss writes on every leg: 11.49 GB against a 10 GB quota).
- **Resolve once.** A plan job resolves each channel to a version and passes
  it on, so the cache step and the boot use the same version.
- **One configuration writes.** The full, unfiltered leg owns the key; a
  filtered or smoke leg uses `actions/cache/restore` only, or its thinner
  content would hit for everyone.
- **Save only verified content**, with separate restore and save steps:
  prefetch every artifact the manifest declares, verify it, save, then test.
  A later test failure then does not leave the cache empty.
- **An unexpected download inside a test is a manifest bug.** Add it to the
  manifest and bump the key's generation; do not raise a test timeout to
  absorb it.
- `restore-keys` with the version prefix brings the last release's images
  along; prune what the manifest does not name, or each release grows the
  entry.

## Investigating a flake with a retry

Not a standing step (tikoci-ci, "Failures and flakes"). It runs while an
open issue investigates named files in a device sweep, and comes out when
the issue closes. Each file runs alone, and every file writes a record each
run, so a flake rate has a denominator. A file the issue names gets one
more attempt after an ordinary failure; a timeout is a hang, and is never
retried. The record names the RouterOS version that booted, not the channel
asked for: resolve the channel once before the tests (a plan job, or a step
like centrs `scripts/chr-cache-key.ts`) and pass the version in, so records
from before and after a release stay apart.

```yaml
- name: Integration sweep
  # The step's timeout leaves the job room to report. Budget: every file's
  # cap, twice for the files under investigation, plus a reserve.
  timeout-minutes: 50
  env:
    EXAMPLE_INTEGRATION: "1"
    EXAMPLE_ROUTEROS: ${{ steps.resolve.outputs.version }} # e.g. 7.21.2, not "stable"
    RETRY_ISSUE: "123"                                     # the open issue; empty: no retries
    RETRY_FILES: test/integration/exec.test.ts             # the files it names, space-separated
    FILE_CAP: 8m
  run: |
    out="$RUNNER_TEMP/integration-output.txt"
    record() {
      printf '{"file":"%s","attempts":%s,"outcome":"%s","routeros":"%s","platform":"%s-%s","issue":"%s","run":"%s"}\n' \
        "$1" "$2" "$3" "$EXAMPLE_ROUTEROS" "$RUNNER_OS" "$RUNNER_ARCH" "$RETRY_ISSUE" "$GITHUB_RUN_ID" \
        >> "$RUNNER_TEMP/files.ndjson"
    }
    status=0
    for f in test/integration/*.test.ts; do
      rc=0
      timeout "$FILE_CAP" bun test "$f" 2>&1 | tee -a "$out" || rc=$?
      if [ "$rc" -eq 0 ]; then record "$f" 1 passed; continue; fi
      # A hang (124) is never retried, and only the files the issue names are.
      if [ "$rc" -eq 124 ]; then
        record "$f" 1 timed-out; status=1; continue
      fi
      if [ -z "$RETRY_ISSUE" ] || [[ " $RETRY_FILES " != *" $f "* ]]; then
        record "$f" 1 failed; status=1; continue
      fi
      # Attempt 1 may have left a machine or a held port behind.
      reaped=$(pgrep -fc qemu-system || true)
      pkill -f qemu-system || true
      echo "::warning title=Retried (#$RETRY_ISSUE)::$f failed; reaped $reaped QEMU process(es) and running it once more"
      rc=0
      timeout "$FILE_CAP" bun test "$f" 2>&1 | tee -a "$out" || rc=$?
      if [ "$rc" -eq 0 ]; then outcome=passed-on-retry; else outcome=failed-twice; status=1; fi
      record "$f" 2 "$outcome"
      echo "- \`$f\`: $outcome (#$RETRY_ISSUE)" >> "$GITHUB_STEP_SUMMARY"
    done
    exit "$status"
```

Under `shell: bash` the pipeline's status is `timeout`'s, which is
`bun test`'s or 124, not `tee`'s. `timeout` is GNU coreutils: a Linux runner
has it, a macOS runner needs `gtimeout` or the tool's own per-file
watchdog. `pkill` there reaps every QEMU on the runner; with a tool that
names its machines, remove only those.

Prefer the tool's own evidence writer when it has one: centrs integration
tests append JSONL to `CENTRS_INTEGRATION_REPORT` (`recordIntegrationEvidence`
in `test/integration/chr.ts`) with the RouterOS version the device reports,
the board and the protocol, and quickchr's `ci-data` has a `test-file` row
for every file of every leg. centrs writes from inside passing tests, so a
file that fails early writes nothing there: the loop's `record()` adds the
outcome and attempts, and is the whole record in a repo with neither.
Upload `files.ndjson` as an artifact, or fold it into the history the sweep
already keeps (centrs `qa-history`, quickchr `ci-data`). `passed-on-retry` over all
records for a file, per RouterOS version and platform, is the flake rate
the issue needs; when it has enough data, the issue closes with a fix, and
the retry list empties.

## Failure evidence

- **Write failure files outside what the test cleans up.** quickchr writes
  `failures/boot-failure-<machine>-<time>.json` under its data directory, not
  the machine's own directory, so the test's `finally` cannot delete it.
- **Collect on timeout, not after**: process state, QEMU log, serial log,
  monitor output, listening ports (mikropkl `qemu-test.yaml`).
- **Stop waiting when the process is gone.** A boot loop that keeps polling
  a dead QEMU only burns the budget.
- **A platform info file** per leg (runner, CPU, memory, accelerator, tool
  versions) answers "what was different on that runner" without a rerun.
- **Hidden paths need `include-hidden-files: true`** on `upload-artifact`.
  quickchr's data root is under `~/.local/share`; without the flag only the
  non-hidden files upload, and `if-no-files-found` stays quiet while any
  file matches.

## Bot data on a side branch

quickchr pushes per-run metrics to an orphan `ci-data` branch and folds them
into shared rollups (`tested-versions.json`, `attempted-legs.json`):

- **Per-run files never conflict** (`runs/<run_id>-<platform>-<target>.ndjson`).
- **Shared rollups are rebuilt, not merged.** On a rejected push, reset to
  the fetched head and fold again; both writers are read-modify-write keyed
  by identity, which anchor tests pin. A `git pull --rebase` left a conflicted
  rebase in place and lost a completed leg's data (quickchr #126).
- **The data job is best-effort**: a fold or push failure warns and stays
  green, so side-band data cannot redden the workflow a required check reads.
  The raw data stays in the run's artifacts.

A data workflow that must deploy from `main` (this site's snapshots) instead
commits once, and a rejected push stays failed; start a fresh run.

## Pages deploys

From this repo's `deploy-pages.yaml`:

```yaml
- name: Check deployment request
  run: |
    if [ "$GITHUB_RUN_ATTEMPT" != "1" ]; then
      echo '::error::Deployment reruns are disabled. Start a fresh run: gh workflow run deploy-pages.yaml --ref main'
      exit 1
    fi
```

A rerun shares the first attempt's artifacts, and a second `github-pages`
artifact makes `deploy-pages` refuse. A Pages timeout after a successful
build and upload is usually a service stall: inspect the failed step, then
start a fresh run; do not change site code for it.

## Waiting and reading a run

```sh
gh workflow run integration.yml --ref my-branch -f test-filter=exec.test.ts
gh run list --workflow integration.yml --branch my-branch --limit 1 --json databaseId,status
gh run watch <run-id> --exit-status       # exits non-zero when the run fails
gh pr checks <pr> --watch                 # every check on a PR
gh run view <run-id> --log-failed         # the failed steps only
gh run download <run-id> -n unit-ubuntu-latest
```

- `gh run list` right after `gh workflow run` may not show the new run yet;
  an empty answer means "look again", not "no run".
- A loop around any of these treats an empty or failed answer as not done,
  and a connection error is not a rate limit.
- Run long waits in the background, or through the harness's own wait for
  background work, and do something useful meanwhile.
