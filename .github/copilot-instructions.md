# Copilot Instructions for tikoci.github.io

This is a multi-page static site for the TIKOCI GitHub org — MikroTik RouterOS projects.

## Tech Stack
- **Bun** — build tool and runtime (`bun run build`, `bun run lint`)
- **Pico CSS v2** — only CSS framework (CDN). Semantic HTML, no utility classes.
- **Biome v2.x** — linter only (formatter disabled). No Prettier.
- **JetBrains Mono + Manrope** — fonts via Google Fonts.
- **No frameworks** — no React, Vue, Svelte. Vanilla JS only.

## Key Conventions
- All pages are in `src/` — build copies them to `dist/`
- All pages include `shared.css` (after Pico) and `shared.js` (before page scripts)
- Dark mode: 3-state switcher. `data-theme="auto"` is NOT valid in Pico v2 — remove the attribute for auto.
- Navigation: Categories dropdown on all pages. Mark current page with `aria-current="page"`.
- `dist/scripts/` and `dist/media/` are committed static files linked externally — never delete.
- Use semantic HTML: `<article>` for cards, `<details>` for accordions, `<mark>` for tags, `<kbd>` for tech terms.

## Commands
- `bun run build` — build site to dist/
- `bun run lint` — lint with Biome
- `bun run dev` — build + serve locally

## See Also
- `CLAUDE.md` — full architecture guide
- `AGENTS.md` — agent-specific instructions
