# Sources

The rules in [tikoci-dependencies](../SKILL.md) come from the November 2026
survey of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Rows | Notes |
| --- | --- | --- |
| Add a dependency only when needed | site-07 | |
| Commit `bun.lock`; frozen install in CI | centrs-51, restraml-41 | |
| Pin every action to a SHA with a version comment | quickchr-111, rskills-13, centrs-20 | Settles `action-pinning` against centrs #266, which chose tags (centrs `SECURITY.md`, `.github/codeql-config.yml` excluding `actions/unpinned-tag`, `.github/zizmor.yml` with `unpinned-uses: ref-pin`); all three change on adoption. quickchr floats the `actions/setup-node` ref itself (PR #223, "Toolchain exception" in `ci.instructions.md`, `release.yml`), which also changes on adoption. tj-actions/changed-files (March 2025) moved its tags to malicious code. |
| 7-day Dependabot cooldown | PR #26 review | centrs turns zizmor's `dependabot-cooldown` audit off (#266, take the newest release); the review of [PR #26](https://github.com/tikoci/tikoci.github.io/pull/26) by centrs and quickchr agents recommends a cooldown. GitHub: cooldown applies to version updates only. `dependabot.example.yml` passes zizmor 1.32.0. |
| `bun audit`; Dependabot security updates do not support Bun | - | centrs `SECURITY.md`, citing GitHub's ecosystem support table. |
| Runtime `dependencies` hold only what runs | PR #26 review | quickchr lists `typescript` in runtime `dependencies` (quickchr #278). |
| Dependabot `github-actions`, weekly, grouped | quickchr-111, restraml-17 | routeros-skills and rosetta `.github/dependabot.yml`. |
| Action pin separate from runtime version | quickchr-111 | `bun-ci-version` in the conflicts table is still open. |
| Lockfile is the pin; Dependabot `bun` ecosystem | restraml-17 | rosetta `.github/dependabot.yml` groups both ecosystems. |
| Siblings from the registry; `bun link` locally | restraml-41 | restraml `CLAUDE.md`, `@tikoci/quickchr` as a devDependency. |
| Track a sibling's `next` tag | - | routeros-muse `package.json` and `AGENTS.md` ("Upstream, not forks"). |
| Fix siblings upstream, never fork | - | routeros-muse `AGENTS.md`. |
| Answering bots that ask for pins | quickchr-111 | Planned in #21. |
| `bun audit fix`, `--production`, ignoring by GHSA | - | tikoci.github.io #31: 16 advisories, six through `curlconverter` (production), fixed within ranges; one KaTeX advisory with no fixed release in range ignored. #33 review (Codex): `bun audit fix` rewrote an exact `minimist` pin `1.2.5` to `1.2.6` in package.json, as Bun documents. |
| Dependabot alerts are not a substitute | - | tikoci.github.io on 2026-11-17: the dependency-graph SBOM lists 9 npm packages, direct only, as `package.json` ranges; no Dependabot alert for any of the 16 transitive advisories `bun audit` reported; its alerts since the move to Bun are `sharp` (direct, from `package.json`). |
| A clean run after a tool upgrade proves nothing | - | tikoci.github.io #31: the markdownlint-cli2 0.24.1 upgrade nested a second `micromark-core-commonmark` and disabled MD052 (Codex review). |
