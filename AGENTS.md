# Agent instructions

Read CLAUDE.md first. This repo keeps TIKOCI-wide metadata, conventions and
observations at durable public URLs, alongside its static project site.

- Work in small focused changes; no new dependencies without need. Use Bun and
  Biome (formatter disabled), semantic HTML and vanilla browser code.
- Preserve appearance: current styling uses Pico v2, JetBrains Mono and Manrope.
  Remove `data-theme` for auto mode; Pico v2 does not support `auto`.
- `src/` owns pages/styles/browser code; `public/` owns unchanged static assets;
  `scripts/` owns collectors/generators; `data/` owns authored config and durable
  snapshots; `docs/` owns maintainer recipes; `dist/` is entirely disposable.
- Never remove public assets or change deployed URLs casually. In particular
  `/scripts/`, `/media/`, `/logos/` and `/images/` have external consumers.
- Data first: define/review a dataset contract before adding its UI. Collection
  failures retain useful evidence and explicit errors; invalid contracts fail.
- Ordinary builds must not collect remotely. Snapshots are committed for durable
  persistence, including CI refreshes. Do not store credentials or private data.
- Canonical origin comes from `src/CNAME` via `data/site-config.ts`. Review sitemap,
  Atom/canonical/OG links, robots and workflow IndexNow host/key location when it
  changes. Plausible configuration and sibling GitHub Pages URLs are independently
  owned integrations: do not blanket-replace their origins.
- Homepage tiles live in `data/homepage-config.ts`; per-repo overrides in
  `data/repo-config.ts`. Tools navigation lives in `src/shared.js` (`SITE_TOOLS`).
- Run `bun run lint`, `bun test test/`, and `bun run build` before committing.
  PR descriptions include a checklist; commits use short imperative subjects.

Recipes: docs/add-dataset.md, docs/add-page.md, docs/refresh-data.md.
Future shared presentation direction: docs/presentation.md. No packaging yet.
