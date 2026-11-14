# TODO — small follow-ups

A lightweight list of nits and small follow-ups, kept in the repo instead of GitHub issues.

How work flows here:

- **Small fix** → commit directly to `main`, then tick it off or delete it here.
- **Bigger change** → open a PR (automatic reviewers comment on PRs; act on substantive
  findings, not prose or style nitpicks).
- **Needs discussion** → open a GitHub issue and link it from the item.

Format: one `- [ ]` line per item, with the area in brackets and the source in parentheses.
Add detail as indented lines only when needed. Move finished items to *Done* (or just delete them).

## Open

- [ ] [ci] Hourly persist commits to `main` on nearly every run, because the `attemptedAt` /
      `generatedAt` timestamps always change. Skip the commit when only timestamps changed,
      or persist less often (e.g. daily). If a human push races the run, that hour's deploy
      fails. (PR #17 review)
- [ ] [data] Two different files are both named `repos.json`: `data/repos.json` (full build
      input, ~1.1 MB, includes README HTML) and `data/published/repos.json` (slim public
      copy). Rename one so the name says which is which. (PR #17 review)
- [ ] [data] `data/` mixes authored TS config, the pinned font, raw snapshots and published
      output. Consider subfolders (e.g. `data/config/`, `data/snapshots/`) or moving
      `data/fonts/` out. (PR #17 review)
- [ ] [scripts] Make `scripts/collect.ts` readable: drop the `process.argv.push("--fresh")`
      hack, read `.github-cache.json` once instead of three times on one line, and replace
      the fake-cache success detection with an explicit return value. (PR #17 review)
- [ ] [lint] Replace the `any` types in `scripts/retain-observations.ts` (Biome warnings
      went from 21 to 25). (PR #17 review)
- [ ] [settings] Turn on "Enforce HTTPS" in the repo's Pages settings: `tikoci.github.io`
      currently redirects to `http://tikoci.dev`. (PR #17 review)
- [ ] [git] Check the local `fix/pr17-reviews` worktree branch (at the PR #17 head `e1b4cbf`,
      no extra commits): delete it, or finish what it was for.

## Done

- [x] [docs] Restore a short reference list of the `src/shared.js` helpers (theme switcher,
      `SITE_TOOLS`, fetch helpers, `debounce`, cancel token, query params, share button,
      `escapeHtml`) — now in `AGENTS.md`. #17 cut it. (PR #17 review)
- [x] [docs] After #17 merges, add a one-line pointer to this file in `AGENTS.md`.
