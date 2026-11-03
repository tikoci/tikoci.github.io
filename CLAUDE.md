# Repository guide

This static site is the keeper of TIKOCI-wide metadata, conventions and collected
observations. Public contracts and durable URLs matter as much as rendered pages.
Read AGENTS.md for contribution rules and docs/ for short recipes.

## Ownership

| Directory | Owns |
| --- | --- |
| src/ | HTML pages, styles, browser JS, public schema documents, CNAME |
| public/ | Unchanged assets copied to the same deployed paths |
| scripts/ | Recognizable individual collectors, generators and validation |
| data/ | Authored TS configuration, reviewed snapshots, pinned build font |
| data/published/ | Legacy `/data/` dashboard/repo endpoints |
| data/metadata/ | New `/metadata/` discovery and independent datasets |
| docs/ | Maintainer documentation and recipes |
| dist/ | Entirely generated output; safe to delete |

`build.ts` remains the single simple render entry point: validate snapshots, clean
output, copy public assets and sources, bundle the curl parser with Bun, generate
repo pages/symbols/homepage/map, and render sitemap/Atom origin placeholders.
No API or font download happens during rendering. Dependencies must first be
installed with `bun install --frozen-lockfile`; subsequent builds work offline.
The pinned JetBrains Mono 2.304 font includes its OFL license in data/fonts/.
Atom timestamps use snapshot observation data, so the same checkout and toolchain
produce the same output. Browser tools may still fetch live data when visited.

## Commands

- `bun run lint`: TypeScript + Biome only; no rendering or remote collection.
- `bun test test/`: fixture and committed-contract tests, no network.
- `bun run build`: render the complete site from committed snapshots.
- `bun run dev`: build and serve dist on port 3000.
- `bun run collect`: explicit hourly repository/dashboard refresh.
- `bun run survey:pages`: explicit slower Pages inventory refresh.

GitHub auth for collection: TIKOCI_GITHUB_TOKEN, GITHUB_TOKEN, gh auth token, then
anonymous. Ordinary builds do not resolve credentials. The optional CI override
may be needed to read cross-repo Pages settings; a default workflow token can
produce unknown/404 results. Coverage limitations are recorded in the dataset.

## Site conventions

Use data-driven semantic HTML. Homepage sections come from
`data/homepage-config.ts`, injected into src/index.html's placeholder. Category
cards remain authored HTML. `data/repo-config.ts` controls symbols, categories,
relationships and dashboard coverage. Generated repo pages live at `/p/*.html`.
The project map embeds graph data derived from the same repo snapshot.

Include shared.css after Pico and shared.js before page scripts. Call
initThemeSwitcher() immediately. Use SITE_TOOLS for shared tools navigation;
category menus remain authored on each full-nav page. New tools should follow
an existing tool page, use debounce/createCancelToken for input-driven lookups,
readQueryParams/writeQueryParams for shareable URLs and initShareButton for sharing.
Keep browser logic simple; inline per-page scripts remain supported. Theme states
are auto (attribute absent), light and dark. Preserve existing appearance.

Dashboard v2 remains at `/data/dashboard.json`, `/data/dashboard/<repo>.json` and
`/data/ros-versions.json`; its contract is src/dashboard-schema.md. Existing
per-signal state/error fields remain authoritative. Failed error/unknown/partial signals
can carry additive lastKnownGood evidence with its original observedAt. The latest
attempt is separate from that evidence. Pages metadata has its own v1 contract;
see `/metadata/schema.md`. Schema versions are not freshness timestamps.

The single `.github/workflows/deploy-pages.yaml` publishes a full assembled site
for every deployment. Hourly collection and weekly/manual Pages refresh persist
validated snapshots as commits on main; GITHUB_TOKEN commits do not recursively
trigger workflows. Pushes render only. Branch protection must permit the bot's
snapshot commits (or a maintainer must refresh and commit manually). A rejected
push fails the job before deployment; there is no hidden best-effort persistence.
No separate partial deployments can overwrite another dataset.
