# TIKOCI Website

**Live site: [tikoci.github.io](https://tikoci.github.io)**

This repository is the source for the TIKOCI organization website — an index and portfolio for open source MikroTik RouterOS projects including VS Code extensions, containers, scripts, virtualization tools, and browser-based web tools.

---

## What This Is

The site is a multi-page static site served by GitHub Pages. No framework; no server-side rendering. Pages are written in HTML using [Pico CSS v2](https://picocss.com) as the only CSS framework, with a small amount of shared JavaScript for the dark mode switcher. The build pipeline is a single TypeScript file (`build.ts`) that copies source files to `dist/` for deployment to GitHub Pages.

The site intentionally has zero runtime dependencies and no build-time template engine — everything a browser receives is exactly what you see in `src/`.

---

## File Structure

```
tikoci-website/
├── src/                     # Source HTML, CSS, JS
│   ├── index.html           # Landing page with all category summaries
│   ├── dev-tools.html       # VSCode Extensions (RouterOS LSP, TikBook)
│   ├── virtualization.html  # Virtualization (mikropkl, fat-chr)
│   ├── containers.html      # Containers (make.d, cligames, netinstall, serial2http)
│   ├── scripts.html         # RouterOS Scripts
│   ├── web-tools.html       # Web Tools (/app Editor, Schema Diff, Command Lookup)
│   ├── shared.css           # Shared styles — included on every page after Pico CSS
│   ├── shared.js            # Shared scripts — dark mode switcher (initThemeSwitcher)
│   └── cubist.css           # Geometric category icon SVG styles
├── docs/
│   └── images/              # Static images — copied to dist/images/ at build
├── dist/                    # Build output — deployed to GitHub Pages
│   ├── scripts/             # Committed static .rsc files (DO NOT DELETE — linked externally)
│   └── media/               # Committed static media (DO NOT DELETE — linked externally)
├── build.ts                 # Build script: src/ → dist/
├── biome.json               # Biome v2 linter config (formatter disabled)
└── package.json             # Bun project scripts
```

---

## Build Pipeline

The build is defined in [`build.ts`](build.ts). It:

1. Cleans `dist/` except for `dist/scripts/` and `dist/media/` — those directories contain committed static files linked externally from MikroTik forum posts and must survive every build.
2. Copies all files from `src/` to `dist/`.
3. Copies images from `docs/images/` to `dist/images/`.

Nothing is minified, bundled, or transformed. The output is identical to the input.

---

## GitHub Actions Deployment

The workflow at `.github/workflows/deploy-observable-to-pages.yaml` runs automatically on every push to `main`:

1. Checks out the repository.
2. Installs Bun (`oven-sh/setup-bun`).
3. Runs `bun install` (only dev dependency is `@biomejs/biome`).
4. Runs `bun run lint` — build fails if linting fails.
5. Runs `bun run build` — produces the `dist/` output.
6. Runs `git restore dist/scripts dist/media` — ensures the committed static files survive the clean step.
7. Uploads `dist/` as a GitHub Pages artifact and deploys.

---

## AI-First Design

This project is designed to be worked on by agentic AI coding tools (GitHub Copilot, Claude Sonnet / Claude Opus, and similar). Two documentation files are provided for that purpose:

- **[`AGENTS.md`](AGENTS.md)** — instructions for GitHub Copilot agents and automated PR workflows. Covers task types, commit conventions, technology constraints, and common gotchas.
- **[`CLAUDE.md`](CLAUDE.md)** — full architecture reference for AI agents, including CSS patterns, the Pico CSS dark mode gotcha (`data-theme="auto"` is not valid in Pico v2), nav structure, and how to add new pages or projects.

The site has been tuned for Claude Sonnet and Claude Opus — both models can work effectively on this project with those files as context. The `.github/copilot-instructions.md` provides a condensed version for use directly in Copilot Chat.

---

## Local Developer Setup

Bun is the only required tool. No Node.js, no npm.

**Install Bun:** [bun.sh](https://bun.sh)

```sh
# Install dev dependencies (just Biome for linting)
bun install

# Build site to dist/
bun run build

# Build + serve locally on port 3000
bun run dev

# Lint source files
bun run lint

# Auto-fix lint issues
bun run lint:fix
```

The dev server (`bun run dev`) runs `build.ts` first, then serves `dist/` on `http://localhost:3000`. It does not watch for changes — re-run `bun run dev` after editing source files.

