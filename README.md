# TIKOCI site and metadata

Static project site and durable TIKOCI-wide metadata at https://tikoci.dev.

Use the Bun version pinned in `package.json`. Install with
`bun install --frozen-lockfile` and validate with `bun run check` (lint, tests and
build). Render alone with `bun run build`. Rendering uses committed snapshots
and works offline after dependency installation. dist/ is disposable.

See [AGENTS.md](AGENTS.md) for layout, architecture and contribution rules,
[TODO.md](TODO.md) for small open follow-ups, and [docs/refresh-data.md](docs/refresh-data.md) for explicit
collection and persistence. Public metadata discovery: `/metadata/index.json`.
