# Backlog: small follow-ups

A lightweight list of nits and small follow-ups, kept in the repo instead of GitHub issues.

How work flows here:

- **Small fix** → a PR labeled `skip-review` (`tikoci-pr-flow`), then tick it off or
  delete it here.
- **Bigger change** → a draft PR, cross-reviewed before ready (automatic reviewers comment
  on ready PRs; act on substantive findings, not prose or style nitpicks).
- **Needs discussion** → open a GitHub issue and link it from the item.

Format: one `- [ ]` line per item, with the area in brackets and the source in parentheses.
Add detail as indented lines only when needed. Move finished items to *Done* (or just delete them).

## Open

- [ ] [settings] Finish `tikoci-github` here: a read-only workflow token default and required
      SHA-pinned actions (all pinned since #29; `upload-pages-artifact` pins its nested
      `upload-artifact` by SHA too). Needs the maintainer's go-ahead. (#21, 3c)
- [ ] [ci] Move `bun audit` here to the `tikoci-ci` recipe (`audit-gating`): audit only PRs and
      pushes that change `bun.lock` or any `package.json` (`ci.yaml` audits every PR today, #31).
      The deploy skips it (House exceptions in AGENTS.md). (#21, #33)
- [ ] [ci] A weekly soft-gate run with a report issue (`tikoci-ci`, "Soft gates get a periodic
      signal"): the full `bun audit` first, then the other non-gating checks as they arrive.
      Not urgent. (#21, #33)
- [ ] [house] Adopt `tikoci-toolchain` (`@types/bun` matching the pin exactly), `tikoci-testing`
      and `tikoci-grounding` here, or note why not under House exceptions. (#21)
- [ ] [lint] Adopt the `tikoci-linting` starting configs here: the stricter tsconfig (TypeScript 7
      reports 20 `noUncheckedIndexedAccess` errors in build.ts and scripts/), `biome.jsonc` with
      `--error-on-warnings` (needs the `any` item below first), and one `.markdownlint-cli2.yaml`.
      (#21, 3b; PR #26 review)
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

- [x] [settings] `tikoci-github` settings applied 2026-11-17: delete branches on merge,
      Dependabot security updates, the `skip-review` label, CodeQL default setup on the
      Extended suite. (#21, 3c)
- [x] [deps] `bun audit` fixed: `brace-expansion` 1.1.21 (under `curlconverter`) and
      markdownlint-cli2 0.24.1; CI runs `bun audit`, ignoring one unreachable low KaTeX
      advisory with the reason in `ci.yaml`. (#21, 3b)
- [x] [flow] Adopt `tikoci-pr-flow`: every change is a PR, `skip-review` label, CodeRabbit
      config and PR template. (#21, 3c)
- [x] [deps] Adopt `tikoci-dependencies`: `.github/dependabot.yml` and SHA-pinned actions. (#21, 3b)
- [x] [ci] Adopt `tikoci-ci`: `ci.yaml` (was `check-pr.yaml`) and `zizmor.yaml`. (#21, 3d)
- [x] [github] Adopt `tikoci-github` files: SECURITY.md and the house token order
      (`GH_TOKEN` added). Settings are the open [settings] item. (#21, 3c)
- [x] [docs] Restore a short reference list of the `src/shared.js` helpers (theme switcher,
      `SITE_TOOLS`, fetch helpers, `debounce`, cancel token, query params, share button,
      `escapeHtml`) — now in `AGENTS.md`. #17 cut it. (PR #17 review)
- [x] [docs] After #17 merges, add a one-line pointer to this file in `AGENTS.md`.
