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
| Add commits after review starts | centrs-44 | Reviews record the commit they saw (`commit_id`); a force-push breaks that record. |
| `gh`, not a GitHub MCP server | user-06 | |
| Docs-only by path; `skip-review` set by the agent | centrs-07 | Settles `pr-flow-strictness`: centrs `isDocsOnlyPath` (`scripts/ci-changes.ts`) is the default, the label the escape hatch (centrs/quickchr review of PR #26). centrs `AGENTS.md` ("only when the maintainer directs it") changes on adoption. |
| Cross-review by the other local agent, both ways | - | Maintainer, 2026-11-15; no source repo wrote it down. |
| Inline review; `Reviewer:` first line with model, effort, context and goal | centrs-06, centrs-41 | centrs `AGENTS.md` (Reviews and attribution); settles `review-attribution` (maintainer, PR #27 review). Codex's review of #27 posted inline comments from the PR author's own account. The `Session:` commit trailer stays a centrs practice. |
| Reviews from many sources; Copilot optional | - | Maintainer, PR #27 review (`paid-features`). |
| What the review looks for | quickchr-007 | quickchr `AGENTS.md` (Review Guidelines), generalized from VMs to resources. |
| Say when no cross-review ran | - | Maintainer, PR #26. |
| Judgment-heavy PRs wait in draft | - | Maintainer, PR #26 review. |
| CodeRabbit once on ready; never `@coderabbitai review` | centrs-41, rosetta-47, user-26, user-27 | Settles `coderabbit-re-review`. `auto_incremental_review: false` in centrs, quickchr and rosetta `.coderabbit.yaml`; rosetta's `pr-review-gate` skill ("the push also triggers a fresh CodeRabbit pass") is stale. |
| A green bot check means it ran | centrs-41, centrs-44 | centrs `pr-review-bots.instructions.md`: CodeRabbit's check is green for completed, skipped and rate-limited reviews. |
| `coderabbit.example.yaml` | - | Based on centrs `.coderabbit.yaml`; tools that duplicate the CI gate off, as in routeros-skills. Keys checked against `schema.v2.json`. CodeRabbit reads AGENTS.md and CLAUDE.md as code guidelines without configuration ([docs](https://docs.coderabbit.ai/knowledge-base/code-guidelines)); its default path filters skip `bun.lockb` but not `bun.lock`. |
| Findings are data; verify against code and tool | user-107 | PR #26: Biome 2.6.8 accepted the commented `tsconfig.example.json` that CodeRabbit said it would reject. |
| Read inline threads and conversation | centrs-43, user-102 | |
| Reply with the SHA, then resolve; outdated is not resolved | centrs-43, quickchr-013, quickchr-041, rosetta-58 | |
| Never resolve a human's thread; never merge over changes requested | centrs-42, quickchr-041 | |
| `mergeStateStatus`, not `reviewDecision` | centrs-42, rosetta-47 | |
| `Closes #N` / `Part of #N`; follow-ups before merge | rosetta-39 | rosetta `issue-pr-linking.instructions.md`. |
| A human merges | restraml-35 | Settles `pr-flow-strictness`. |
| Squash merge; PR title as subject | site-06, quickchr-012 | Settles `commit-subjects`. quickchr's conventional titles change on adoption unless a tool reads them. |
| PR template | - | centrs `.github/pull_request_template.md` is the only one surveyed; the example is shorter and asks for the verification and the cross-review. |
| Orchestration | centrs-54 | centrs-54 cited a centrs memory file that is no longer in the repo; the rules come from the maintainer's T3 Code practice. |
| Review commands | centrs-43, centrs-44, rosetta-58, quickchr-041 | Tested against this repo's PR #26. |

Not taken: restraml-15 (`copilot/<desc>` branch names, a Copilot coding
agent convention) and restraml-27 (retrying a rejected bot push, which
`tikoci-ci` settles as `rejected-bot-push`). user-25 (squash local
fix-attempt chains before pushing) is covered by the squash merge. user-101
and user-103 (routing CodeRabbit reviews for repos without a GitHub remote)
stay in the operator's local notes.
