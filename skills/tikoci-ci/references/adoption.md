# Adoption notes

What each repo changes when it adopts [tikoci-ci](../SKILL.md), and the
fixes the skill's reviews found in other repos, which are worth making
whether or not the repo adopts. These notes are point-in-time, as of PR #28
(2026-11-16). The cross-repo pass after
[#21](https://github.com/tikoci/tikoci.github.io/issues/21) works from this
file, and a repo's own issue replaces its section once it has one. Links
are pinned to the commit read; the review threads on PR #28 and
[sources.md](sources.md) carry the rest of the evidence.

## centrs

- **Retry**: [`qa.yaml`](https://github.com/tikoci/centrs/blob/80a6f9f12196b3ef84d1038a08b9aba04b315f66/.github/workflows/qa.yaml) retries every failed integration file once on its
  Linux legs, must-pass `stable` and `long-term` included, with annotations
  only. Its Windows and Intel Mac legs are in
  [`verify-extended.yaml`](https://github.com/tikoci/centrs/blob/80a6f9f12196b3ef84d1038a08b9aba04b315f66/.github/workflows/verify-extended.yaml),
  dispatch-only and `continue-on-error`, with no retry. Open an issue for
  whichever must-pass files actually flake and scope the retry to them, or
  drop it; reap after every failure.
- **Clearing a read flake**: check that `Main health`
  ([`scripts/qa-nightly.ts`](https://github.com/tikoci/centrs/blob/80a6f9f12196b3ef84d1038a08b9aba04b315f66/scripts/qa-nightly.ts) `mainHealth`) reads
  a rerun's latest attempt.
- **Records**: `CENTRS_INTEGRATION_REPORT` is written from inside passing
  tests ([`test/integration/chr.ts`](https://github.com/tikoci/centrs/blob/80a6f9f12196b3ef84d1038a08b9aba04b315f66/test/integration/chr.ts)); add outcome, attempts and `runAttempt` for files that fail first.
  Fold `qa-history` instead of rebasing (the "Commit accumulated history"
  step) before adding records, or overlapping runs drop them.
- **Required checks** (branch protection on `main`): six by name (`Repo checks`, `Unit tests & coverage`,
  `Build`, `CHR smoke (stable)`, `Main health (nightly QA)`, `CodeRabbit`).
  A gate job is the preferred path; `Main health` stays outside it, and the
  bot check goes (`tikoci-github`).
- **Latest Bun**: on CI's weekly schedule. In the nightly instead, the
  pre-flight `Fingerprint` (`{ sha, versions }`) would need the resolved
  Bun, or the leg skips in quiet weeks.
- **Windows**: `unit-cross` in [`ci.yaml`](https://github.com/tikoci/centrs/blob/80a6f9f12196b3ef84d1038a08b9aba04b315f66/.github/workflows/ci.yaml)
  runs under `pwsh`; keep the
  `env.HOME ?? homedir()` fallback whichever shell it uses.

## quickchr

[tikoci/quickchr#279](https://github.com/tikoci/quickchr/issues/279) holds
its alignment: [`scripts/lint-shell.sh`](https://github.com/tikoci/quickchr/blob/dd7e0ad99aa51acc79f086fe5d71e65efbb511eb/scripts/lint-shell.sh) skipping silently without shellcheck
in CI, and cancelling superseded runs on `main` (test-only jobs may; the
`main.yml` job that pushes `ci-data` should not). Also:
`Integration freshness` ([`scripts/ci-freshness.ts`](https://github.com/tikoci/quickchr/blob/dd7e0ad99aa51acc79f086fe5d71e65efbb511eb/scripts/ci-freshness.ts))
reads no override label, so a PR that fixes `main`
is an admin merge until it does; and its data root moves with tikoci-home,
which the smoke recipe's explicit `QUICKCHR_DATA_DIR` already allows for.

## rosetta, restraml, vscode-tikbook

They install the latest Bun on every run: rosetta
[`test.yml`](https://github.com/tikoci/rosetta/blob/a51b2014d3d94661842225c61f9f7666cd9f54c5/.github/workflows/test.yml), [`qa.yml`](https://github.com/tikoci/rosetta/blob/a51b2014d3d94661842225c61f9f7666cd9f54c5/.github/workflows/qa.yml),
[`release.yml`](https://github.com/tikoci/rosetta/blob/a51b2014d3d94661842225c61f9f7666cd9f54c5/.github/workflows/release.yml),
[`release-smoke.yml`](https://github.com/tikoci/rosetta/blob/a51b2014d3d94661842225c61f9f7666cd9f54c5/.github/workflows/release-smoke.yml),
[`app-integration.yml`](https://github.com/tikoci/rosetta/blob/a51b2014d3d94661842225c61f9f7666cd9f54c5/.github/workflows/app-integration.yml) and
[`device-map-refresh.yml`](https://github.com/tikoci/rosetta/blob/a51b2014d3d94661842225c61f9f7666cd9f54c5/.github/workflows/device-map-refresh.yml); restraml
[`appyamlschemas.yaml`](https://github.com/tikoci/restraml/blob/0e476cea72d28ef8564a78acdd063553b72fd95e/.github/workflows/appyamlschemas.yaml) and its manual
workflows (`bun-version: 'latest'`); vscode-tikbook
[`build.yaml`](https://github.com/tikoci/vscode-tikbook/blob/c8fddd232a66680a1ce30393836c05f538e364c2/.github/workflows/build.yaml). Move to the `packageManager` pin, with a
`bun-version` dispatch input on the workflows that test and none on
release. rosetta already has the container shape: `release.yml` gates its
OCI tags on `smoke-oci` (rosetta #246), and
[`app-integration.yml`](https://github.com/tikoci/rosetta/blob/a51b2014d3d94661842225c61f9f7666cd9f54c5/.github/workflows/app-integration.yml)
(rosetta #245) is the CHR `/app` test, dispatch-only today ("Container
apps").

## app-t3code

Pins Bun inline (`bun-version: "1.4.4"`) in each workflow
([`ci.yml`](https://github.com/tikoci/app-t3code/blob/037158bbf3c4776cf2be65b03e1d9a2536bceb67/.github/workflows/ci.yml), [`integration.yml`](https://github.com/tikoci/app-t3code/blob/037158bbf3c4776cf2be65b03e1d9a2536bceb67/.github/workflows/integration.yml),
[`freshness.yml`](https://github.com/tikoci/app-t3code/blob/037158bbf3c4776cf2be65b03e1d9a2536bceb67/.github/workflows/freshness.yml)). Move it to
`packageManager` with `bun-version-file`, add the dispatch input, and skip
the weekly latest-Bun run: the image ships its own Bun.

## This site

The `[ci]` item in BACKLOG.md: `check-pr.yaml` becomes the CI workflow,
with zizmor after the action pins.
