# AGENTS.md — GitHub Copilot Agent Instructions for tikoci.github.io

> This file provides instructions for GitHub Copilot coding agents (Claude Sonnet) working on
> this repository via GitHub Actions. For the full architecture reference, see `CLAUDE.md`.

## What This Repository Does

**tikoci.github.io** is a multi-page static portfolio site for the
[TIKOCI GitHub organization](https://github.com/tikoci) — open source MikroTik RouterOS projects.
Built with bun, styled with Pico CSS v2, deployed to GitHub Pages.

---

## Agent Ground Rules

1. **Read `CLAUDE.md` first** — it has the full architecture, conventions, and common task guides.
2. **Make the smallest possible change** that fully addresses the issue or PR feedback.
3. **Do not break the build** — run `bun run lint` and `bun run build` before committing.
4. **Do not commit secrets** — never hardcode tokens, passwords, or credentials.
5. **No new dependencies unless absolutely necessary** — the site has zero runtime dependencies.

---

## Technology Constraints

| Allowed | Forbidden |
|---------|-----------|
| Pico CSS v2 (CDN) | Bootstrap, Tailwind, any other CSS framework |
| JetBrains Mono + Manrope (Google Fonts) | Other font families |
| Bun for build/lint/dev | npm, node, yarn, pnpm |
| Biome v2.x for linting | Prettier, ESLint, any other linter/formatter |
| Vanilla HTML/CSS/JS | React, Vue, Svelte, Angular, any web framework |
| Static files only | Backend, server-side rendering, APIs |
| Semantic HTML elements | `<div>` soup with utility classes |

### Critical Gotchas
- **`data-theme="auto"` is NOT valid in Pico CSS v2** — it silently forces light mode. Remove the attribute for auto state.
- **`dist/scripts/` and `dist/media/` are committed static files** — never delete them. They're linked externally from forum posts.
- **Biome formatter is disabled** — lint only. Do not add Prettier.
- **Build is a single `build.ts`** — keep it simple. An AI agent should understand the entire build by reading one file.

---

## Common Agent Tasks

### Add a new project
1. Determine the category (dev-tools, virtualization, containers, scripts, web-tools)
2. Add an `<article>` card to the appropriate `src/{category}.html` page
3. Optionally add a summary card to `src/index.html` in the matching category section
4. Run `bun run lint` and `bun run build`

### Update an existing project description
1. Find the project's `<article>` in the relevant `src/{category}.html`
2. Edit the description text
3. If it also appears on `src/index.html`, update there too
4. Run `bun run lint` and `bun run build`

### Add a new category
1. Create `src/new-category.html` following existing category page patterns
2. Add to the Categories dropdown in ALL page nav sections (`index.html` + all category pages)
3. Add a category section with `.category-header` and `.project-grid` on `src/index.html`
4. Run `bun run lint` and `bun run build`

### Fix a CSS/styling issue
1. Check if the fix belongs in `src/shared.css` (affects all pages) or inline in one page
2. Prefer shared.css for anything used on multiple pages
3. Use Pico CSS semantic elements before adding custom CSS
4. Test dark mode (auto, light, dark states)

### Create an interactive tool page

1. Create `src/tool-name.html` using the skeleton in `CLAUDE.md` → "New Tool Page Skeleton"
2. Include `shared.css` (after Pico) and `shared.js` (before page script)
3. Call `initThemeSwitcher()` immediately
4. Use `fetchGitHubContents()` / `fetchGitHubPagesFile()` for data fetching
5. Wire controls with `debounce()` + `createCancelToken()` (no submit buttons)
6. Support shareable URLs with `readQueryParams()` / `writeQueryParams()`
7. Add the page to the Tools dropdown in **all** existing pages
8. Keep all JS inline in the single `.html` file
9. Run `bun run lint` and `bun run build`

---

## PR Conventions

- Branch naming: `copilot/{short-description}` (auto-created by Copilot agent)
- Commit messages: imperative mood, short, descriptive (e.g., "Add serial2http to containers page")
- PR description: include a checklist of changes made
- Do not modify unrelated files or fix unrelated issues

---

## Key File Reference

| File | Purpose |
|------|---------|
| `build.ts` | Build script: src/ → dist/ (bun runtime) |
| `package.json` | Project config with bun scripts |
| `biome.json` | Biome v2.x linter config |
| `src/index.html` | Landing page with all categories |
| `src/dev-tools.html` | Development Tools category |
| `src/virtualization.html` | Virtualization category |
| `src/containers.html` | Containers category |
| `src/scripts.html` | RouterOS Scripts category |
| `src/web-tools.html` | Web Tools category |
| `src/shared.css` | Shared CSS (fonts, theme, cards, utilities) |
| `src/shared.js` | Shared JS (theme switcher) |
| `dist/scripts/*.rsc` | Committed static RouterOS scripts (DO NOT DELETE) |
| `dist/media/` | Committed static media files (DO NOT DELETE) |
| `CLAUDE.md` | Full architecture guide for AI agents |
| `AGENTS.md` | This file — agent-specific instructions |
| `.github/copilot-instructions.md` | Concise Copilot chat instructions |
