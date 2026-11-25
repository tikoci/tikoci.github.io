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
- [ ] [house] Adopt `tikoci-toolchain` (`@types/bun` matching the pin exactly), `tikoci-testing`
      and `tikoci-grounding` here, or note why not under House exceptions. (#21)
- [ ] [lint] Adopt the `tikoci-linting` starting configs here: the stricter tsconfig (TypeScript 7
      reports 20 `noUncheckedIndexedAccess` errors in build.ts and scripts/), `biome.jsonc` with
      `--error-on-warnings` (needs the `any` item below first), and one `.markdownlint-cli2.yaml`.
      (#21, 3b; PR #26 review)
      Hold until the rest of #21 Phase 3 lands: later skills may change these configs
      (maintainer, 2026-11-17). The example lints `src/**/*.html` too, which means removing
      the 3 `noDescendingSpecificity` suppressions in `shared.css` (the rule is off) and fixing
      or explaining the 5 `!important`s in `project-map.html`. (PR #36 grounding)
- [ ] [lint] The Plausible snippet in the `<head>` of all 14 pages (and an expanded copy in
      `404.html`) fails the house Biome config: `noAssignInExpressions` is an error, plus
      `noArguments`. Move it verbatim into `shared.js` behind one `biome-ignore` naming both
      rules (one comment can list several; `shared.js` loads before every page script that
      calls `plausible()`), then check with Playwright that the pageview and a custom event
      still reach `plausible.io/api/event`. restraml carries the same snippet. Part of the
      lint adoption above. (PR #36 grounding)
- [ ] [site] Make the site's categories match the crossref's groups, then drop `crossrefGroup`.
      netserver goes to Containers; mikrotik-gpl and m2ir go to a new "RouterOS internals"
      homepage section and map category (m2ir is under dev-tools now). The "RouterOS Scripts"
      section keeps the `/scripts/*.rsc` files, which have external consumers. Regenerate the
      crossref; its `internals` extra section then comes from `homepage-config.ts`. Agreed
      after #21 and PR #39 (maintainer, 2026-11-18). (PR #39)
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

- [ ] [house] From the tzsp-sniff road test (#21), not in the first fix PR. Item numbers
      are the road test's; the new-repo path is #46 and the design-to-done workflow #45.
      - `tikoci-ci`: ship tzsp-sniff's `scripts/lint-external.sh` (skip locally, fail under
        `CI`; tell a broken mise shim from a missing tool) and a checksum-verified actionlint
        install in `ci.example.yml` (18, 40); a Node smoke leg (19); the KaTeX
        GHSA-238p-pmpm-9mq7 ignore or a note in `audit.example.ts` (26).
      - `tikoci-toolchain`: the Node path: shebang, choosing `engines.node`, the build
        recipe, whether `bunx` runs a Node-shebang bin under Node, and that "`npx` → `bunx`"
        means developer commands (4); ship `check-bun-pin.ts` for `packageManager` as an
        asset (17); `tsconfig.src.json` with `types: ["node"]` as the guard against `Bun.*`
        in Node code (20).
      - `tikoci-cli-mcp`: streamed output (JSONL per event: warnings mid-stream, a summary
        record, SIGINT, exit code for an empty timed capture) (10); a tool whose use needs
        setup outside the agent is better as a CLI than one more MCP server (25).
      - `tikoci-data-contracts`: whether a CLI's `--json` or JSONL output carries a
        `schemaVersion` (11).
      - `tikoci-home`: a tool that takes `<TOOL>_<KEY>` env vars but keeps no files fits no
        profile (8).
      - `tikoci-house`: copying several skills in a small repo (3); Claude Code lists copied
        skills mid-session (22); `curl -fsSL` is fine for skills referenced by URL (45).
      - `tikoci-crossref`: an owner for tool output shape across repos, and for MCP vs CLI
        (25).
      - `tikoci-linting`: the formatter's cost for agents (12, 16, 41, 51); waits on the
        maintainer's decision from tzsp-sniff's data.

## Done

- [x] [git] Deleted the local `fix/pr17-reviews` worktree branch (contained in #17), with the
      other merged local and remote branches and the old review worktrees. (2026-11-17)
- [x] [ci] `bun audit` follows the `tikoci-ci` recipe (`audit-gating`): only PRs and pushes that
      change `bun.lock` or any `package.json`, plus a weekly full audit with a report issue that
      the hourly deploy relies on. The `picomatch` ReDoS advisory (no fixed release, dev-only) is
      ignored with its reason in `ci.yaml`. (#21, #33)
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
