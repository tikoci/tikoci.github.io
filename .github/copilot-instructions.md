Read CLAUDE.md and AGENTS.md. Recipes live in docs/. Use Bun/Biome, semantic HTML,
and current shared styles. src/ owns pages, public/ unchanged assets, scripts/
collectors/generators, data/ authored config and durable snapshots. dist/ is fully
generated. Preserve deployed asset URLs. Builds do not collect remotely; use the
explicit refresh commands and review public data. Homepage tiles are configured
in data/homepage-config.ts and tools navigation in src/shared.js. Validate with
bun run lint, bun test test/, bun run build.
