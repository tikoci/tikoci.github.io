# Agent and maintainer guide

This static site is the keeper of TIKOCI-wide metadata, conventions and collected
observations, alongside the project site at https://tikoci.dev. Public contracts
and durable URLs matter as much as rendered pages. Short recipes live in docs/;
small open follow-ups live in TODO.md.

This is the single instruction file for all agents. CLAUDE.md only imports it.

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

`build.ts` is the single render entry point. It validates snapshots, cleans the
output, copies public assets and sources, bundles the curl parser with Bun,
generates the repo pages, symbols, homepage and project map, and fills the
origin placeholders in the sitemap and Atom feed. Rendering never calls an API
or downloads a font. After `bun install --frozen-lockfile`, builds work offline.
The pinned JetBrains Mono 2.304 font ships with its OFL license in data/fonts/.
Atom timestamps come from snapshot observation data, so the same checkout and
toolchain produce the same output. Browser tools may still fetch live data when
visited.

## Commands

- Use the Bun version pinned in `package.json` (`packageManager`); both CI workflows
  read that field. Update it deliberately after checking the new version locally.
- `bun run check`: lint, fixture/contract tests and the offline build; the same
  validation command runs in both CI workflows.
- `bun run lint`: TypeScript + Biome only; no rendering or remote collection.
- `bun test test/`: fixture and committed-contract tests, no network.
- `bun run build`: render the complete site from committed snapshots.
- `bun run dev`: build and serve dist on port 3000.
- `bun run collect`: explicit hourly repository/dashboard refresh.
- `bun run survey:pages`: explicit slower Pages inventory refresh.

Run `bun run check` before committing.

GitHub auth for collection, in order: TIKOCI_GITHUB_TOKEN, GITHUB_TOKEN,
`gh auth token`, then anonymous. Ordinary builds do not resolve credentials. The
optional CI override may be needed to read cross-repo Pages settings; with the
default workflow token those can come back unknown or 404. The dataset records
these coverage limits.

## Contribution rules

- Small fixes go straight to `main`. Bigger changes go through a PR. Changes
  that need discussion get a GitHub issue. Track small nits in TODO.md, not as
  issues. Act on substantive automatic PR review findings, not prose or style
  nitpicks.
- PRs use squash merge with the PR title and description as the commit message.
  `.github/workflows/check-pr.yaml` runs lint, Bun tests and the offline build on
  PRs targeting `main`. These checks are advisory while `main` is unprotected;
  direct pushes remain available.
- Keep changes small and focused, and add no dependencies without need. Use Bun
  and Biome (formatter disabled), semantic HTML and vanilla browser code. Commits
  use short imperative subjects.
- Never remove public assets or change deployed URLs casually. In particular
  `/scripts/`, `/media/`, `/logos/` and `/images/` have external consumers.
- Data first: define and review a dataset contract before adding its UI.
  Collection failures keep useful evidence and record explicit errors; invalid
  contracts fail.
- Ordinary builds must not collect remotely. Snapshots are committed for durable
  persistence, including CI refreshes. Do not store credentials or private data.
- Canonical origin comes from `src/CNAME` via `data/site-config.ts`. When it
  changes, review the sitemap, the Atom, canonical and OG links, robots.txt, and
  the workflow's IndexNow host and key location. Plausible configuration and
  sibling GitHub Pages URLs are owned independently: do not blanket-replace
  their origins.

## Site conventions

Use data-driven semantic HTML. Homepage sections come from
`data/homepage-config.ts` and are injected into the placeholder in
src/index.html; do not hand-edit generated sections or dist/p/ pages. Category
cards remain authored HTML. `data/repo-config.ts` controls symbols, categories,
relationships and dashboard coverage. Generated repo pages live at `/p/*.html`.
The project map embeds graph data derived from the same repo snapshot.

Preserve the current appearance: Pico v2, JetBrains Mono and Manrope. Include
shared.css after Pico and shared.js before page scripts, then call
`initThemeSwitcher()` immediately. Theme states are auto, light and dark. For
auto, remove the `data-theme` attribute: Pico v2 has no `auto` value, and
setting it forces light mode.

`src/shared.js` helpers:
- `initThemeSwitcher(id?, defaultTheme?)`: the auto/light/dark toggle.
- `TIKOCI`: org constants (`owner`, `pagesUrl`).
- `SITE_TOOLS` + `initToolsDropdown(listId)`: tools navigation. Add new tool
  pages to `SITE_TOOLS`. Category menus are authored on each full-nav page.
- `initGitHubDropdown(listId)`: lazy list of org repos.
- `fetchGitHubContents(repo, path)`: Contents API directory listing.
- `fetchGitHubPagesFile(repo, path)`: raw file from GitHub Pages, with no API
  rate limit.
- `debounce(fn, ms)`, `createCancelToken()`: input-driven lookups without stale
  results.
- `readQueryParams()`, `writeQueryParams(params)`: shareable URLs, written with
  `history.replaceState`.
- `initShareButton(buttonId, beforeCopy?, label?)`: inline "Copied!" share. It is
  preferred over the legacy `initShareModal(opts)`.
- `escapeHtml(str)`: HTML-safe escaping.

To build a new tool page, copy an existing one and keep its script inline. Tool
pages are client-side only, with no submit buttons: use `input` with a ~400 ms
debounce for text, and act immediately on `change` for selects and checkboxes.

## Data contracts and deployment

Dashboard v2 remains at `/data/dashboard.json`, `/data/dashboard/<repo>.json` and
`/data/ros-versions.json`; its contract is src/dashboard-schema.md. Per-signal
state/error fields remain authoritative. A signal that fails (state error,
unknown or partial) can carry additive `lastKnownGood` evidence with its
original `observedAt`, and the latest attempt is recorded separately. Pages
metadata has its own v1 contract, `/metadata/schema.md`. Schema versions are not
freshness timestamps.

`.github/workflows/deploy-pages.yaml` publishes the full assembled site on every
deployment. Hourly collection and the weekly/manual Pages refresh commit
validated snapshots to `main`. Commits made with GITHUB_TOKEN do not re-trigger
the workflow. Pushes only render. If branch protection is ever enabled, it must
allow the bot's snapshot commits. A rejected push fails the job before
deployment. No partial deployment can overwrite another dataset.

For a failed deployment, inspect the failed step first. A Pages timeout after a
successful build/upload can be a service stall; it does not justify changing site
code by itself. **Do not rerun `deploy-pages.yaml`** (`gh run rerun` or the UI).
Attempts share artifacts, and re-uploading creates duplicate `github-pages`
artifacts that block deployment. The workflow rejects reruns before checkout.
Start a fresh run on main with `gh workflow run deploy-pages.yaml --ref main`;
the default deploys committed snapshots without collection. Use `-f refresh=hourly`
or `-f refresh=pages` only when a refresh is intended (pages includes hourly data).
PR checks may be rerun. A snapshot push rejected because main advanced must stay
failed; start a fresh run rather than force-pushing or deploying uncommitted data.
See docs/refresh-data.md for recovery and failure evidence.

Recipes: docs/add-dataset.md, docs/add-page.md, docs/refresh-data.md. Future
shared presentation direction: docs/presentation.md (no packaging yet).
