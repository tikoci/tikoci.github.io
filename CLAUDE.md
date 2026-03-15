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
| `bun run lint` | Lint all source files with Biome v2.x |
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
6. **Page guide pattern** — collapsible help sections using `.page-guide`
7. **Utility classes** — `.ml-1`, `.mt-1`, `.text-right`, etc.
8. **Project cards** — `.project-grid` for card layouts
9. **Category badges** — `<mark>` styling
10. **Site footer** — consistent footer styling

### shared.js structure
All pages include `shared.js` before page-specific scripts. It provides:
- `initThemeSwitcher(id?)` — 3-state dark mode toggle (auto → light → dark → auto)
- Theme icon SVGs (sun, moon, half-circle)

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

### Semantic HTML Quick Reference

| Element | What Pico Does | Use For |
|---------|---------------|---------|
| `<article>` | Card with padding, border, rounded corners | Project cards, callouts |
| `<article>` + `<header>`/`<footer>` | Card with sections | Structured project cards |
| `<details>`/`<summary>` | Accordion | Collapsible sections, credits |
| `<mark>` | Highlighted text | Tags like NEW, categories |
| `<kbd>` | Key-styled inline | Package names, tech terms |
| `<figure>` + `<figcaption>` | Captioned content | Screenshots with descriptions |
| `<nav>` with `<ul>` | Horizontal flex | Navigation, toolbars |

### Navigation
All pages share a consistent nav header with:
- **TIKOCI** home link (left)
- **Categories** dropdown (Pico's `<details class="dropdown">`)
- **GitHub** link to all repos
- **Theme switcher** (sun/moon/half-circle SVG)

On each category page, the current page is marked with `aria-current="page"` in the dropdown.

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

No runtime dependencies. No build tools beyond bun itself.

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
