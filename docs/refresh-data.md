# Refresh data

A fresh clone includes reviewed snapshots and the pinned OFL font. Install Bun
 dependencies (`bun install --frozen-lockfile`), then `bun run build` works without
network. `rm -rf dist` is safe. No bootstrap API calls are required.

To refresh, authenticate with gh or set GITHUB_TOKEN (optional
TIKOCI_GITHUB_TOKEN override), run `bun run collect` for hourly data and/or
`bun run survey:pages` for the slower inventory. Review data diffs, run
`bun run lint`, `bun test test/`, `bun run build`, then commit data/ changes.
`data/repo-github-pages.json` is the detailed maintainer survey; only its reviewed
public projection in data/metadata/ is deployed. Never put private rows in it.

CI uses committed snapshots as last-known-good persistence. Hourly :17 refreshes
repo/dashboard data, weekly Sunday 03:43 UTC also refreshes Pages. Manual dispatch
refreshes hourly data and optionally Pages. A single workflow assembles the full
site. Failed upstream requests record errors/staleness while retaining useful
observations; a missing/invalid required contract fails validation. A first-ever
new dataset needs a reviewed bootstrap snapshot before adding it to validation.

`/data/collection.json` records latest hourly attempt and repository observation;
dashboard generatedAt and per-signal state/error describe dashboard freshness.
`lastKnownGood.observedAt` dates retained evidence and never means a new success.
Pages observedAt, attemptedAt and error are independent. Inspect these fields,
not file mtimes or schema versions. Git history preserves prior observations.
