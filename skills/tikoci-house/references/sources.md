# Sources

The rules in this skill come from the November 2026 survey of tikoci instruction
files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Rows | Notes |
| --- | --- | --- |
| Skill tiers and prefixes | rskills-07, rskills-14, user-08, user-09, user-96 to user-98 | `tikoci-*` moves from one operator's user directory to this site. Repo-local skills take the repo's name as prefix. |
| Copy, list, exceptions | issue #21 "Shape" | New with this skill. |
| AGENTS.md entry, CLAUDE.md import | site-01, centrs-12, centrs-24 | Settles `entry-file-roles`: mikropkl and restraml (CLAUDE.md canonical) and quickchr (CLAUDE.md points to Copilot files) change on adoption. |
| Directory AGENTS.md | centrs-24 | |
| No new `.github/instructions/`; list existing ones | rosetta-01, centrs-03, quickchr-001 | Codex has no `applyTo`. |
| Copilot file is a pointer | centrs-13, rosetta-22, mikropkl-32 | |
| Short, current, no work items | rosetta-08, quickchr-043, restraml-14 | |
| One home per rule; repo over agent memory | centrs-38, rosetta-38, quickchr-043, quickchr-008, user-12 | |
| `.agents/skills`, `.claude/skills` link | rosetta-06, quickchr-134 | rosetta uses `.github/skills`; `.agents/skills` is read by more agents. |
| No vendored `routeros-*` | quickchr-005 | |
| Fresh session; name matches directory | user-63 | |
| Precedence | user-48 | House skills slot in below the repo's own AGENTS.md. |
| `.scratch/` | centrs-50 | |
| Local agent notes | user-01 to user-04, user-10, user-49, user-51 | Settles `user-skill-dirs`: which user skill directories an operator links is a local-notes matter. |
| Writing house skills | user-99, user-100, user-35, rskills-15 | Checks adapted from routeros-skills. |
