# Refresh data

A fresh clone includes reviewed snapshots and the pinned OFL font. Use the Bun
version in `package.json` and install dependencies (`bun install --frozen-lockfile`),
then `bun run build` works without network. `rm -rf dist` is safe. No bootstrap
API calls are required.

To refresh, authenticate with gh or set GITHUB_TOKEN (optional
TIKOCI_GITHUB_TOKEN override), run `bun run collect` for hourly data and/or
`bun run survey:pages` for the slower inventory. Review data diffs, run
`bun run check`, then commit data/ changes.
`data/repo-github-pages.json` is the detailed maintainer survey; only its reviewed
public projection in data/metadata/ is deployed. Never put private rows in it.

CI uses committed snapshots as last-known-good persistence. Hourly :17 refreshes
repo/dashboard data, weekly Sunday 03:43 UTC also refreshes Pages. Pushes and manual
dispatch with the default `refresh=none` only deploy committed snapshots. A single
workflow assembles the full site. Failed upstream requests record errors/staleness
while retaining useful observations; a missing/invalid required contract fails
validation. A first-ever
new dataset needs a reviewed bootstrap snapshot before adding it to validation.

Manual runs always target main:

```sh
# Deploy committed snapshots (also the recovery command after a Pages timeout).
gh workflow run deploy-pages.yaml --ref main
# Refresh hourly repository/dashboard data, validate, commit and deploy.
gh workflow run deploy-pages.yaml --ref main -f refresh=hourly
# Refresh hourly data and the Pages inventory, validate, commit and deploy.
gh workflow run deploy-pages.yaml --ref main -f refresh=pages
```

The `refresh` choice replaces the old manual `pages` boolean. Both CI workflows
run `bun run check`, and Bun is pinned once in `package.json`. The deploy workflow
serializes runs, gives Pages up to 15 minutes, and has a 45-minute job limit.
IndexNow submission is bounded and optional; its failure does not undo a deployment.

## Recover a failed deployment

Inspect the failed step and its logs with `gh run view <run-id> --log-failed`.
Collection, validation/build, snapshot persistence, artifact upload and Pages
deployment are separate failure points. Fix a validation failure before deploying.
If a snapshot push is rejected because main advanced, start a fresh run with the
intended refresh; never force-push or bypass persistence to publish uncommitted data.

If validation and upload passed but Pages stayed at `syncing_files` or
`updating_pages` until timeout, start a fresh default manual run using the first
command above. Do not use **Re-run jobs** or `gh run rerun` for this workflow.
Reruns are rejected before checkout: attempts share artifacts and re-uploading can
leave two named `github-pages`, which `deploy-pages` refuses. PR checks may be rerun.
Repeated service timeouts need their deployment logs and GitHub Status checked;
avoid a retry loop or unrelated site changes. Failed runs include these recovery
instructions in their job summary.

Observed failures in 2026: [November 5](https://github.com/tikoci/tikoci.github.io/actions/runs/42087583381)
timed out at `updating_pages`; [November 7](https://github.com/tikoci/tikoci.github.io/actions/runs/42357208829)
timed out at `syncing_files`, then its rerun failed on duplicate artifacts. Both
original attempts passed collection, validation/build and upload. A
[fresh November 7 run](https://github.com/tikoci/tikoci.github.io/actions/runs/42380974727)
deployed successfully. These logs show Pages stalls, but do not establish a wider
GitHub outage or its underlying cause.

## Check freshness

`/data/collection.json` records latest hourly attempt and repository observation;
dashboard generatedAt and per-signal state/error describe dashboard freshness.
`lastKnownGood.observedAt` dates retained evidence and never means a new success.
Pages observedAt, attemptedAt and error are independent. Inspect these fields,
not file mtimes or schema versions. Git history preserves prior observations.
