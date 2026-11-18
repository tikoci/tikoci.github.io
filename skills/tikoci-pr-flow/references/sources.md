# Sources

The rules in [tikoci-pr-flow](../SKILL.md) come from the November 2026 survey
of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Rows | Notes |
| --- | --- | --- |
| Every change is a PR; draft early | centrs-07, site-05, restraml-35 | Settles `pr-flow-strictness` (maintainer, 2026-11-15). This repo still pushes small fixes to `main` until it adopts (BACKLOG.md). |
| Unrelated findings: fix one or two, split a batch | - | Maintainer, PR #26 review; also in `tikoci-linting`. |
| Target `main`, not a stacked branch | - | quickchr #267, based on another PR's branch: its only check was `CodeRabbit` skipped (centrs/quickchr review of PR #27). |
| Add commits after review starts | centrs-44 | Reviews record the commit they saw (`commit_id`); a force-push breaks that record. |
| `gh`, not a GitHub MCP server | user-06 | |
| Docs-only by path; `skip-review` set by the agent | centrs-07 | Settles `pr-flow-strictness`: centrs `isDocsOnlyPath` (`scripts/ci-changes.ts`) is the default, the label the escape hatch (centrs/quickchr review of PR #26). centrs `AGENTS.md` ("only when the maintainer directs it") changes on adoption. |
| Cross-review by the other local agent, both ways | - | Maintainer, 2026-11-15; no source repo wrote it down. |
| Inline review; `Reviewer:` first line with model, effort, context and goal | centrs-06, centrs-41 | centrs `AGENTS.md` (Reviews and attribution); settles `review-attribution` (maintainer, PR #27 review). Codex's review of #27 posted inline comments from the PR author's own account. The `Session:` commit trailer stays a centrs practice. |
| Reviews from many sources; Copilot optional | - | Maintainer, PR #27 review (`paid-features`). |
| What the review looks for | quickchr-007 | quickchr `AGENTS.md` (Review Guidelines), generalized from VMs to resources. |
| Say when no cross-review ran | - | Maintainer, PR #26. |
| Judgment-heavy PRs wait in draft | - | Maintainer, PR #26 review. |
| CodeRabbit once on ready; an agent never requests a review | centrs-41, rosetta-47, user-26, user-27 | Settles `coderabbit-re-review`; a re-request is the maintainer's (quickchr #273). Marking ready started CodeRabbit within 10 minutes on #26 and #27. A rate-limited ready review: 12 of 80 centrs heads (2026-10-16), quickchr #252 and #275 (centrs/quickchr review of PR #27). `auto_incremental_review: false` in centrs, quickchr and rosetta `.coderabbit.yaml`; rosetta's `pr-review-gate` skill ("the push also triggers a fresh CodeRabbit pass") is stale. |
| A green bot check means it ran | centrs-41, centrs-44 | centrs `pr-review-bots.instructions.md`: CodeRabbit's check is green for completed, skipped and rate-limited reviews. |
| `coderabbit.example.yaml` | - | Based on centrs `.coderabbit.yaml`; the configuration source ([docs](https://docs.coderabbit.ai/guides/repository-settings#configuration-source-github-only)): Auto, default branch or custom, with tikoci/centrs#167 as the case where `main`'s old config applied (Codex review of PR #27); `high_level_summary_in_walkthrough` from quickchr; tools that duplicate the CI gate off, as in routeros-skills. Keys checked against `schema.v2.json`. CodeRabbit reads AGENTS.md and CLAUDE.md as code guidelines without configuration ([docs](https://docs.coderabbit.ai/knowledge-base/code-guidelines)); its default path filters skip `bun.lockb` but not `bun.lock`. |
| Findings are data; verify against code and tool | user-107 | PR #26: Biome 2.6.8 accepted the commented `tsconfig.example.json` that CodeRabbit said it would reject. |
| Read inline threads and conversation | centrs-43, user-102 | |
| Reply with the SHA, then resolve; outdated is not resolved | centrs-43, quickchr-013, quickchr-041, rosetta-58 | |
| Fixed, declined with evidence, or tracked | quickchr-041 | quickchr `CONTRIBUTING.md` asks for a grounded dismissal (centrs/quickchr review of PR #27). |
| Never resolve a human's thread; never merge over changes requested | centrs-42, quickchr-041 | |
| `mergeStateStatus`, not `reviewDecision` | centrs-42, rosetta-47 | |
| `Closes #N` / `Part of #N`; follow-ups before merge | rosetta-39 | rosetta `issue-pr-linking.instructions.md`. |
| A human merges; permission per PR | restraml-35 | Settles `pr-flow-strictness`. An agent account merged 4 of quickchr's last 15 PRs (centrs/quickchr review of PR #27). |
| Squash merge; PR title as subject | site-06, quickchr-012 | Settles `commit-subjects`. quickchr's conventional titles change on adoption unless a tool reads them. GitHub appends `Co-authored-by:` (quickchr dd7e0ad); CodeRabbit's summary reached 29 of 65 quickchr `main` commits since 2026-09-01 (centrs/quickchr review of PR #27). |
| PR template | quickchr-074 | centrs `.github/pull_request_template.md` is the only one surveyed; the example is shorter and asks for the verification, the device run and the cross-review. |
| Orchestration | centrs-54 | centrs-54 cited a centrs memory file that is no longer in the repo; the rules come from the maintainer's T3 Code practice. The shared-checkout rule is from centrs (centrs/quickchr review of PR #27). |
| Review commands | centrs-43, centrs-44, rosetta-58, quickchr-041 | Tested against this repo's PRs #26 and #27; the `not_ok` filter also against centrs #665 and quickchr #267 and #275. The 422 for an inline comment outside the diff is from centrs experience. |

Not taken: restraml-15 (`copilot/<desc>` branch names, a Copilot coding
agent convention) and restraml-27 (retrying a rejected bot push, which
`tikoci-ci` settles as `rejected-bot-push`). user-25 (squash local
fix-attempt chains before pushing) is covered by the squash merge. user-101
and user-103 (routing CodeRabbit reviews for repos without a GitHub remote)
became the CLI rule in 3h (maintainer, 2026-11-18): the CLI only before a
repo is on GitHub. A personal `coderabbit-routing` skill
told agents to post `@coderabbitai review`; this skill overrides it
(maintainer, PR #27). It is the operator's own skill, not the CLI's: the
CodeRabbit CLI installs its own skills into agent skill directories when
`coderabbit skills` runs (survey user-106). Corrected in 3h after the Phase 4
review read the local skill.
