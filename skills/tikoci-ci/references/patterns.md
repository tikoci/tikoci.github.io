# CI patterns

Longer patterns behind [tikoci-ci](../SKILL.md), each from a tikoci repo that
runs it. Copy the shape, then check the names against the repo you copy into.

## Docs-only classification

The `changes` job in [ci.example.yml](../assets/ci.example.yml) is a start:
it reads the PR's file list (or the pushed range), and answers `heavy=false`
only when every path matches a docs pattern. centrs
[`scripts/ci-changes.ts`](https://github.com/tikoci/centrs/blob/main/scripts/ci-changes.ts)
is the version to grow into:

- **A path is docs-only when nothing but people and agents read it.** Prose
  a test parses (centrs `docs/MATRIX.md`), generated docs, pages the build
  assembles and executable specs (`commands/<name>/examples.md`) are code.
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

## The gate job

Branch protection names checks by job name, and a matrix job's name changes
with the matrix. One job that `needs` the rest gives a stable name:

```yaml
gate:
  name: CI gate
  if: ${{ always() }}
  needs: [changes, lint, unit, smoke]
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

Both are required checks with "require branches to be up to date" off. The
override when the PR is the fix is in
[tikoci-github](https://tikoci.dev/house/skills/tikoci-github/SKILL.md).
Never fix the check by weakening its verdict.

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

## A recorded retry

For the device integration sweep only (tikoci-ci, "Retries and flakes").
Each file runs alone; a failure runs once more, and the record says how many
attempts it took. Under `shell: bash` the pipeline's status is `bun test`'s,
not `tee`'s. The record names the RouterOS version that booted, not the
channel asked for: resolve the channel once before the tests (a plan job, or
a step like centrs `scripts/chr-cache-key.ts`) and pass the version in, so
records from before and after a release stay apart.

```yaml
- name: Integration sweep
  env:
    EXAMPLE_INTEGRATION: "1"
    EXAMPLE_ROUTEROS: ${{ steps.resolve.outputs.version }} # e.g. 7.21.2, not "stable"
  run: |
    status=0
    for f in test/integration/*.test.ts; do
      if bun test "$f" 2>&1 | tee -a "$RUNNER_TEMP/integration-output.txt"; then
        continue
      fi
      echo "::warning title=Retried::$f failed; running it once more"
      if bun test "$f" 2>&1 | tee -a "$RUNNER_TEMP/integration-output.txt"; then
        outcome=passed-on-retry
      else
        outcome=failed-twice
        status=1
      fi
      echo "- \`$f\`: $outcome" >> "$GITHUB_STEP_SUMMARY"
      printf '{"file":"%s","attempts":2,"outcome":"%s","routeros":"%s","platform":"%s-%s","run":"%s"}\n' \
        "$f" "$outcome" "$EXAMPLE_ROUTEROS" "$RUNNER_OS" "$RUNNER_ARCH" "$GITHUB_RUN_ID" \
        >> "$RUNNER_TEMP/retries.ndjson"
    done
    exit "$status"
```

A file that passes first time writes no record, so a record always means
two attempts: `passed-on-retry` (the second passed) or `failed-twice`.
Upload `retries.ndjson` as an artifact, or fold it into the history the
sweep already keeps (centrs `qa-history`, quickchr `ci-data`). Counting
`passed-on-retry` per file and RouterOS version over a few weeks is the
flake statistic; a file that keeps appearing gets an issue.

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
