# Add a page or project

For a project, update the relevant src category page and data/homepage-config.ts
for homepage tiles; data/repo-config.ts owns per-repo overrides and symbols.
Do not hand-edit generated homepage sections or dist/p/ pages.

For a page, copy a similar src page, use semantic HTML and the existing shared
styles/theme helpers. Add tool links to SITE_TOOLS in src/shared.js; update
category menus on all full-nav pages only when adding a category. Update the
sitemap template with {{SITE_ORIGIN}} for this site's URLs. Keep sibling-site
URLs as authored. Put unchanged assets in public/ at their intended URL path.

README short links use `/r/<repo>`; see [redirects.md](redirects.md) for routing,
tracking and adding durable routes outside the collected project list.

Run `bun run check`. Check auto/light/dark for visual
changes. Dataset additions follow add-dataset.md before introducing rendering.
