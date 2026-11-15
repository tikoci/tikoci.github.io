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
| Pin every action to a SHA with a version comment | quickchr-111, rskills-13, centrs-20 | Settles `action-pinning`: centrs used tags; quickchr kept `setup-node` on a tag (PR #223) so Node tracks latest, which the runtime-version rule now covers. quickchr `.github/instructions/ci.instructions.md`. |
| Dependabot `github-actions`, weekly, grouped | quickchr-111, restraml-17 | routeros-skills and rosetta `.github/dependabot.yml`. |
| Action pin separate from runtime version | quickchr-111 | `bun-ci-version` in the conflicts table is still open. |
| Lockfile is the pin; Dependabot `bun` ecosystem | restraml-17 | rosetta `.github/dependabot.yml` groups both ecosystems. |
| Siblings from the registry; `bun link` locally | restraml-41 | restraml `CLAUDE.md`, `@tikoci/quickchr` as a devDependency. |
| Track a sibling's `next` tag | - | routeros-muse `package.json` and `AGENTS.md` ("Upstream, not forks"). |
| Fix siblings upstream, never fork | - | routeros-muse `AGENTS.md`. |
| Answering bots that ask for pins | quickchr-111 | Planned in #21. |
