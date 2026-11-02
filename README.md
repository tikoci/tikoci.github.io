# TIKOCI site and metadata

Static project site and durable TIKOCI-wide metadata at https://tikoci.dev.

Install with `bun install --frozen-lockfile`, validate with `bun run lint` and
`bun test test/`, render with `bun run build`. Rendering uses committed snapshots
and works offline after dependency installation. dist/ is disposable.

See [CLAUDE.md](CLAUDE.md) for layout and architecture, [AGENTS.md](AGENTS.md) for
contribution rules and [docs/refresh-data.md](docs/refresh-data.md) for explicit
collection and persistence. Public metadata discovery: `/metadata/index.json`.
