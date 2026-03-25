# CLAUDE.md — AI Agent Guide for tikoci.github.io

> This file is for AI coding agents (Copilot, Claude, etc.) working on this repository.
> It explains the architecture, key patterns, common tasks, and critical gotchas.

## What This Repository Does

**tikoci.github.io** is the portfolio/index site for the [TIKOCI GitHub organization](https://github.com/tikoci) — a collection of open source MikroTik RouterOS projects including containers, scripts, LSP servers, API schemas, and virtualization tools.

The site is a **multi-page static site** built with bun and deployed to GitHub Pages.

---

## Repository Layout

```
tikoci-website/
├── build.ts              # Build script: copies src/ → dist/, preserves static assets
├── package.json          # bun project config with build/lint/dev scripts
├── biome.json            # Biome v2.x linter config (formatter disabled)
├── src/                  # Source HTML, CSS, JS files
│   ├── index.html        # Landing page with all project categories
│   ├── dev-tools.html    # Development Tools category page
│   ├── virtualization.html  # Virtualization category page
│   ├── containers.html   # Containers category page
│   ├── scripts.html      # RouterOS Scripts category page
│   ├── web-tools.html    # Web Tools category page
│   ├── chr-images.html   # Interactive tool: mikropkl CHR image browser/downloader
│   ├── shared.css        # Shared CSS (fonts, theme, utilities) — all pages include this
│   └── shared.js         # Shared JS (theme switcher) — all pages include this
├── docs/                 # Legacy Observable Framework source (kept for images)
│   └── images/           # Site images (copied to dist/images/ during build)
├── dist/                 # Build output (deployed to GitHub Pages)
│   ├── scripts/          # Committed static files: .rsc scripts (linked externally)
│   │   ├── autovlan.rsc
│   │   ├── hello.rsc
│   │   ├── lsbridge.rsc
│   │   └── traefik.yaml
│   └── media/            # Committed static files: videos (linked externally)
├── CLAUDE.md             # This file — full architecture guide for AI agents
├── AGENTS.md             # GitHub Copilot agent-specific instructions
└── .github/
    ├── copilot-instructions.md  # Concise Copilot chat instructions
    └── workflows/
        └── deploy-observable-to-pages.yaml  # GitHub Pages deployment workflow
```

---

## Build Pipeline

### Commands
| Command | What it does |
|---------|-------------|
| `bun install` | Install dependencies (only @biomejs/biome) |
| `bun run build` | Run `build.ts` → produces static site in `dist/` |
| `bun run lint` | Lint with Biome v2.x |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run dev` | Build + serve locally on port 3000 |

### How build.ts works
1. Cleans `dist/` except `scripts/` and `media/` directories (these are committed static assets linked externally — never delete them)
2. Copies all files from `src/` to `dist/`
3. Copies images from `docs/images/` to `dist/images/`
4. Prints a file listing

The build is intentionally simple — a single TypeScript file using only Node.js built-in APIs. No template engine, no bundler, no minifier.

### Static asset preservation
`dist/scripts/` and `dist/media/` contain files that are **committed to git** and **linked externally** from forum posts and other sites. The build script never deletes these directories. The GitHub Actions workflow also runs `git restore dist/scripts dist/media` after build to ensure they survive.

---

## CSS/HTML Conventions

### Technology Stack
- **Pico CSS v2** (`@picocss/pico@2`) — the only CSS framework. Loaded from CDN. No Bootstrap, Tailwind, or others.
- **JetBrains Mono** — primary body font (monospace character)
- **Manrope** — sans-serif fallback
- Both loaded via Google Fonts
- **Semantic HTML** — proper `<header>`, `<main>`, `<article>`, `<details>`, `<nav>`, `<mark>`, `<kbd>`, etc. No div soup.
- **No web frameworks** — no React, Vue, Svelte. Vanilla JS only.

### shared.css structure
All pages include `shared.css` after Pico CSS and Google Fonts. It provides:
1. **Font overrides** — JetBrains Mono + Manrope over Pico defaults
2. **Inline code/kbd tightening** — fixes line-height bloat from Pico's default padding
3. **Logo dark/light swap** — `img[data-theme]` visibility based on theme state
4. **Theme switcher icon sizing** — SVG sizing in nav
5. **Nav dropdown LTR fix** — prevents RTL text issues in `dir="rtl"` dropdowns
6. **Page guide pattern** — collapsible help sections using `.page-guide` + `.behind-curtain`
7. **Share modal styling** — `dialog.share-modal` for legacy share pattern
8. **Utility classes** — `.ml-1`, `.mt-1`, `.text-right`, `.share-link`, `.inline-select`,
   `.switch-controls`, `.grid-2fr-1fr`
9. **Project cards** — `.project-grid` for card layouts
10. **Category badges** — `<mark>` styling
11. **Site footer** — consistent footer styling

### shared.js structure
All pages include `shared.js` before page-specific scripts. It provides:
- `initThemeSwitcher(id?)` — 3-state dark mode toggle (auto → light → dark → auto)
- Theme icon SVGs (sun, moon, half-circle)
- `TIKOCI` — org-level constants (`owner`, `pagesUrl`)
- `SITE_TOOLS` — central tools list array; rendered by `initToolsDropdown()`
- `initToolsDropdown(listId)` — populates the Tools nav dropdown from `SITE_TOOLS`, auto-marks current page with `aria-current="page"`. **To add/remove a tool link, edit `SITE_TOOLS` in shared.js — all pages render from it.**
- `initGitHubDropdown(listId)` — lazily fetches tikoci repos and populates the GitHub dropdown
- `fetchGitHubContents(repo, path)` — fetch directory listings from GitHub Contents API
- `fetchGitHubPagesFile(repo, path)` — fetch raw files from GitHub Pages (no rate limit)
- `debounce(fn, ms)` — debounce wrapper for text input event handlers
- `createCancelToken()` — cancellation token factory for async request racing
- `readQueryParams()` / `writeQueryParams(params)` — shareable URL helpers
- `initShareButton(buttonId, beforeCopy, label)` — inline "Copied!" share button
- `initShareModal(opts)` — legacy share dialog (prefer `initShareButton` for new pages)
- `escapeHtml(str)` — HTML-safe string escaping

### Dark Mode — Critical Pico v2 Pattern

**`data-theme="auto"` is NOT a valid Pico CSS v2 value.** Setting it silently forces light mode. For the "auto" (OS-following) state, **remove the `data-theme` attribute entirely** so Pico's `@media (prefers-color-scheme: dark)` rules apply natively.

The shared.js `initThemeSwitcher()` handles this correctly.

For third-party components that need dark mode styling:
```css
/* Auto mode + OS dark */
@media (prefers-color-scheme: dark) {
    :root:not([data-theme=light]) .component { /* dark styles */ }
}
/* Explicit dark */
[data-theme=dark] .component { /* dark styles */ }
```

### Semantic HTML Quick Reference (Pico CSS v2)

| Element / Pattern | What Pico Does | Use For |
|---|---|---|
| `<article>` | Card with padding, border, rounded corners | Project cards, callouts |
| `<article>` + `<header>` / `<footer>` | Card with distinct header/footer sections | Structured cards |
| `<details>` / `<summary>` | Native accordion, styled with arrow | Collapsible guide, TOC |
| `<details>` + `name="group"` | Exclusive accordion (only one open) | Grouped sections |
| `<summary role="button">` | Summary styled as a button | Prominent toggles |
| `<mark>` | Highlighted inline text (yellow/primary) | Key terms, toggle names |
| `<kbd>` | Keyboard-key styled inline | Package names, key combos |
| `<figure>` + `<figcaption>` | Captioned content block | Code examples with notes |
| `<ins>` / `<del>` | Green/red inline text | Showing diff semantics |
| `<hr>` inside `<article>` | Subtle section divider within a card | Separating guide topics |
| `role="switch"` on checkbox | Toggle switch appearance | Extra-packages, testing toggles |
| `<nav>` with `<ul>` | Horizontal flex layout | Controls bar, toolbar |

**Consistent switch labels:** When a `<nav>` has multiple `role="switch"` toggles, give the
`<nav>` an ID and apply `font-size: 0.88rem; font-style: italic` to all labels via CSS. Use
`<code>` (with `font-style: normal`) for technical terms within labels. Remove individual `<i>`
tags — let CSS handle italic consistently.

### Navigation
All pages share a consistent nav header with:
- **TIKOCI** home link (left)
- **Categories** dropdown (Pico's `<details class="dropdown">`)
- **Tools** dropdown (links to restraml tools and any future interactive tool pages)
- **GitHub** link to all repos
- **Theme switcher** (sun/moon/half-circle SVG)

On each category page, the current page is marked with `aria-current="page"` in the dropdown.

When adding a new tool page, add it to the `SITE_TOOLS` array in `shared.js` — all pages render from it via `initToolsDropdown()`.

---

## Interactive Tool Pages — Patterns and Conventions

Beyond the portfolio category pages, this site hosts interactive tool pages that
pivot GitHub-hosted data into browser UIs. These follow the same patterns proven in
[restraml](https://tikoci.github.io/restraml/)'s tool pages (lookup, diff, editor, etc.).

The first on-site tool page is `chr-images.html` — a dynamic CHR image browser that fetches
release data from the GitHub Releases API and renders platform-specific instructions.

### Core Principles

- **Client-side SPA** — all logic runs in the browser. No backend. GitHub Pages serves static files only.
- **GitHub REST API** for dynamic data — directory listings, file contents, version discovery.
  Use `fetchGitHubContents()` and `fetchGitHubPagesFile()` from `shared.js`.
  For releases data, use the GitHub Releases API directly (`/repos/:owner/:repo/releases`).
- **No submit buttons** — prefer JS event listeners (`input`, `change`, `keydown`) over explicit
  submit/lookup buttons. Use `debounce()` (~400 ms) for text inputs; fire immediately on `change`
  events for checkboxes and `<select>` elements.
- **Cancellation tokens** — prevent stale async results from racing. Use `createCancelToken()`.
- **Shareable URLs** — all tool pages support query strings that populate controls and trigger
  results on load. Use `writeQueryParams()` / `readQueryParams()` from `shared.js`. Update with
  `history.replaceState()` (not `pushState` — no new history entries).
- **Minimal CDN dependencies** — only add a library if it meaningfully solves a problem. Keep count low.
- **Single `.html` file** — keep JS inline in each tool page. No separate `.js` files per page.
- **Plausible tracking** — `plausible('Event Name', { props: { key: value } })` for interactions.

### Event-Driven Controls Pattern

```javascript
// In page-specific <script>:
const cancel = createCancelToken()
const pathInput = document.getElementById('path-input')
const versionSelect = document.getElementById('version-select')

// Text input: debounce 400ms
pathInput.addEventListener('input', debounce(async () => {
    const id = cancel.next()
    const data = await fetchGitHubPagesFile('restraml', `${versionSelect.value}/inspect.json`)
        .then(r => r.json())
    if (id !== cancel.current) return  // stale
    renderResults(data)
    writeQueryParams({ path: pathInput.value, version: versionSelect.value })
}, 400))

// Select/checkbox: fire immediately (no debounce)
versionSelect.addEventListener('change', async () => {
    const id = cancel.next()
    const data = await fetchGitHubPagesFile('restraml', `${versionSelect.value}/inspect.json`)
        .then(r => r.json())
    if (id !== cancel.current) return
    renderResults(data)
    writeQueryParams({ path: pathInput.value, version: versionSelect.value })
})
```

### GitHub API Fetch Patterns

```javascript
// List directories in a repo (e.g. versions)
const versions = await fetchGitHubContents('restraml', 'docs')
    .then(items => items.filter(f => f.type === 'dir'))

// Fetch a JSON file from Pages (no rate limit, unlike API)
const inspect = await fetchGitHubPagesFile('restraml', '7.22/inspect.json')
    .then(r => r.json())

// Fetch raw text from Pages
const raml = await fetchGitHubPagesFile('restraml', '7.22/schema.raml')
    .then(r => r.text())
```

### Share Button Pattern (preferred for new pages)

```html
<p class="text-right">
    <button id="share-btn" class="outline share-link">Share</button>
</p>
```

```javascript
initShareButton('share-btn', () => {
    writeQueryParams({ path: pathInput.value, version: versionSelect.value })
})
```

### Collapsible Guide Pattern — In-Page Help

Tool pages include a collapsed `<details>` section for lightweight documentation:

```html
<details id="my-guide" class="page-guide">
    <summary><b>How to use this tool?</b> &hellip;</summary>
    <article>
        <header><strong>Section Title</strong></header>
        <!-- Usage explanation -->
        <hr>
        <!-- Notation / syntax explanation -->
        <hr>
        <div class="behind-curtain">
            <small><b>Behind the curtain</b> &mdash; how it works ...</small>
        </div>
        <footer>
            <small>Bug/feature links</small>
        </footer>
    </article>
</details>
```

### New Tool Page Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tool Name — tikoci.github.io</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Manrope:wght@200..800&display=swap" rel="stylesheet">
    <script async src="https://plausible.io/js/pa-ubWop5eYckoDPVbIjXU4_.js"></script>
    <script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()</script>
    <link rel="stylesheet" href="shared.css">
    <style>
        /* Page-specific CSS */
    </style>
</head>
<body>
    <header class="container">
        <!-- Copy nav from an existing page, update aria-current="page" -->
        <nav>...</nav>
        <h1>Tool <mark>Name</mark></h1>
    </header>
    <main class="container">
        <!-- Controls, results, guide -->
    </main>
    <footer class="container">
        <small><em>Disclaimer</em></small>
    </footer>
    <script src="shared.js"></script>
    <script>
        initThemeSwitcher()
        // Page-specific logic: fetch data, wire events, etc.
    </script>
</body>
</html>
```

### GitHub Releases API Pattern

For pages that pivot release data (like `chr-images.html`), fetch from the Releases API directly
rather than through `fetchGitHubContents()`:

```javascript
const releases = await fetch(
    `https://api.github.com/repos/${TIKOCI.owner}/${repo}/releases?per_page=50`
).then(r => r.json())

// Find latest non-prerelease
const latest = releases.find(r => !r.prerelease)

// Extract asset filenames from release body (download URLs)
const assetPattern = /releases\/download\/[^/\s]+\/(\S+\.utm\.zip)/g
```

Parse asset names by stripping known suffixes and splitting on dots against known value lists
(architectures, types) — keeps the parser resilient to new variants or name extensions.

### Platform-Adaptive Content Pattern

Tool pages can detect the user's platform and architecture to set smart defaults, while always
allowing manual override via a dropdown:

```javascript
function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('mac')) return 'mac'
    if (ua.includes('win')) return 'windows'
    return 'linux'
}
// Set dropdown default from detection, override via query param
platformEl.value = params.os || detectPlatform()
```

Render different instruction content (install commands, networking examples) based on the
platform dropdown value, not just detection — so users can read instructions for other platforms.

### Relationship to restraml Tool Pages

The restraml project (`tikoci.github.io/restraml/`) has its own `restraml-shared.{js,css}` with
RouterOS-specific additions (version parsing, changelog modal). This site's `shared.{js,css}` is
the **generic foundation** — the same patterns without project-specific logic. Future alignment
goal: restraml imports the generic shared files from the root site and layers its own additions.

Current state: both repos have independent shared files with the same core patterns (theme switcher,
dark mode CSS, font overrides, page guide, utility classes). The generic GitHub API helpers and
event-driven UI utilities now live in this repo's `shared.js` and can be used by any tool page
regardless of which tikoci project's data it visualizes.

---

## Plausible Analytics

All pages include the Plausible snippet in `<head>`:
```html
<script async src="https://plausible.io/js/pa-ubWop5eYckoDPVbIjXU4_.js"></script>
<script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()</script>
```

---

## How to Add a New Project

1. Determine which category it belongs to
2. Add a project card `<article>` to the relevant category page in `src/`
3. If it should appear on the index page, add a card there too in the matching category section
4. Run `bun run lint` to verify
5. Run `bun run build` to verify build output

### Project card template
```html
<article>
    <header>
        <h2><a href="https://github.com/tikoci/PROJECT">project-name</a></h2>
    </header>
    <p>Description of the project.</p>
    <footer>
        <a href="https://github.com/tikoci/PROJECT">GitHub</a>
    </footer>
</article>
```

## How to Add a New Category

1. Create `src/new-category.html` following the pattern of existing category pages
2. Include the standard `<head>` block (Pico CSS, fonts, shared.css, Plausible)
3. Include the shared nav with the Categories dropdown
4. Add the new page to the Categories dropdown in **all** existing pages
5. Add a section on `index.html` with the category header and project cards
6. Run `bun run lint` and `bun run build`

---

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Pico CSS | v2 (CDN) | CSS framework — semantic HTML styling |
| JetBrains Mono | (Google Fonts) | Primary body font |
| Manrope | (Google Fonts) | Sans-serif fallback font |
| @biomejs/biome | v2.x (devDep) | Linter (formatter disabled) |
| Plausible | (external script) | Privacy-friendly analytics |

No runtime dependencies for the site. No build tools beyond bun itself.

---

## GitHub Actions Deployment

The workflow (`.github/workflows/deploy-observable-to-pages.yaml`) runs on push to `main`:
1. Checkout
2. Setup bun (oven-sh/setup-bun)
3. `bun install`
4. `bun run lint`
5. `bun run build`
6. `git restore dist/scripts dist/media` — recover committed static files
7. Upload `dist/` as Pages artifact
8. Deploy to GitHub Pages
