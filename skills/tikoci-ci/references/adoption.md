# Adoption notes

What each repo changes when it adopts [tikoci-ci](../SKILL.md), and the
fixes the skill's reviews found in other repos, which are worth making
whether or not the repo adopts. These notes are point-in-time, as of PR #28
(2026-11-16). The cross-repo pass after
[#21](https://github.com/tikoci/tikoci.github.io/issues/21) works from this
file, and a repo's own issue replaces its section once it has one.

## centrs

- **Retry**: `qa.yaml` retries every failed integration file once on its
  Linux legs, must-pass `stable` and `long-term` included, with annotations
  only. Its Windows and Intel Mac legs are in `verify-extended.yaml`,
  dispatch-only and `continue-on-error`, with no retry. Open an issue for
  whichever must-pass files actually flake and scope the retry to them, or
  drop it; reap after every failure.
- **Clearing a read flake**: check that `Main health`
  (`scripts/qa-nightly.ts` `mainHealth`) reads a rerun's latest attempt.
- **Records**: `CENTRS_INTEGRATION_REPORT` is written from inside passing
  tests; add outcome, attempts and `runAttempt` for files that fail first.
  Fold `qa-history` instead of rebasing (the "Commit accumulated history"
  step) before adding records, or overlapping runs drop them.
- **Required checks**: six by name (`Repo checks`, `Unit tests & coverage`,
  `Build`, `CHR smoke (stable)`, `Main health (nightly QA)`, `CodeRabbit`).
  A gate job is the preferred path; `Main health` stays outside it, and the
  bot check goes (`tikoci-github`).
- **Latest Bun**: on CI's weekly schedule. In the nightly instead, the
  pre-flight `Fingerprint` (`{ sha, versions }`) would need the resolved
  Bun, or the leg skips in quiet weeks.
- **Windows**: `unit-cross` runs under `pwsh`; keep the
  `env.HOME ?? homedir()` fallback whichever shell it uses.

## quickchr

[tikoci/quickchr#279](https://github.com/tikoci/quickchr/issues/279) holds
its alignment: `scripts/lint-shell.sh` skipping silently without shellcheck
in CI, and cancelling superseded runs on `main` (test-only jobs may; the
`main.yml` job that pushes `ci-data` should not). Also:
`Integration freshness` reads no override label, so a PR that fixes `main`
is an admin merge until it does; and its data root moves with tikoci-home,
which the smoke recipe's explicit `QUICKCHR_DATA_DIR` already allows for.

## rosetta, restraml, vscode-tikbook

They install `bun-version: latest` on every run: rosetta `test.yml`,
`release-smoke.yml` and `device-map-refresh.yml`; restraml four workflows;
vscode-tikbook `build.yaml`. Move to the `packageManager` pin, with a
`bun-version` dispatch input on the workflows that test. rosetta's `/app`
formula can take the CHR install test ("Container apps").

## app-t3code

Pins Bun inline (`bun-version: "1.4.4"`) in each workflow. Move it to
`packageManager` with `bun-version-file`, add the dispatch input, and skip
the weekly latest-Bun run: the image ships its own Bun.

## This site

The `[ci]` item in BACKLOG.md: `check-pr.yaml` becomes the CI workflow,
with zizmor after the action pins.
