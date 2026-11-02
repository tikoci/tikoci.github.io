# Public metadata contract

`/metadata/index.json` is discovery schemaVersion 1. Each datasets entry names
an id, URL, independent schemaVersion, schema documentation, cadence and provenance.
Its version changes only for incompatible discovery structure changes.

`/metadata/pages.json` is Pages dataset schemaVersion 1, independent of the
maintainer survey's v1 and dashboard v2. `observedAt` is the source survey time;
`attemptedAt` is the latest publication/collection attempt. `error: null` means
that attempt succeeded; otherwise the prior inventory and observedAt are retained.
Per-repo state (ok/partial/unknown/error) still describes incomplete observations.
A recent timestamp does not guarantee complete API coverage.

`provenance` identifies collector, sources and scope. Repositories are restricted
by an anonymous public GitHub listing. Each repos[name] contains name, hasPages
(boolean/null), state, htmlUrl, serve (kind/root/title/probeFile or null), and
plausible (presence, normalized script kind, declared domains, checked paths,
snippet paths, truncation and observed event names, or null). Failed signals may carry `lastKnownGood: { observedAt, value }` from an older
success; its timestamp never advances on failure. No analytics traffic,
credentials, deployment refs/SHAs, source branches or private repository rows are
published. Settings are token-scoped; 404 may mean inaccessible rather than off.

Additive fields are compatible. Removing/renaming fields or changing meanings
requires a dataset schema version bump and a documented migration. Consumers must
ignore unknown fields and examine state/error plus timestamps before using data.
Legacy `/data/` dashboard endpoints remain independently versioned and compatible.
