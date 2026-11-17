# Sources

The rules in [tikoci-grounding](../SKILL.md) come from the November 2026 survey
of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

The same no-masking rule appears four times in quickchr alone and again in
restraml, routeros-skills and the user-level files; this skill is the one copy
they can point to.

| Rule | Rows | Notes |
| --- | --- | --- |
| RouterOS on a CHR is the source of truth; review cannot infer behavior | centrs-48, centrs-25, quickchr-004, user-32 | centrs `docs/CONSTITUTION.md` keeps its normative copy. |
| Check device output on `long-term` too | centrs-25 | centrs `test/AGENTS.md` "Device-dependent expectations" (#297). |
| rosetta before web search; current library docs | centrs-08, centrs-48, restraml-07 | |
| A tool's repo is the reference for its domain | quickchr-004 | quickchr: skills and docs lag the code. |
| RouterOS is predictable; the check order | quickchr-063 | quickchr `routeros-rest.instructions.md`. |
| Experiment first; evidence before code; red flags | quickchr-081 | quickchr `testing.instructions.md`; the ten-session pool bug is its "Historical lesson". |
| One failure is a lead; reproduce locally | rskills-02, quickchr-052, quickchr-080, user-32 | routeros-skills `CONTRIBUTING.md` is the cleanest statement. |
| No skip, gate, retry, timeout bump or disabled validation | quickchr-080, quickchr-052, quickchr-136, restraml-12, restraml-46, user-32 | centrs "Validation is the product" (`done-definition.instructions.md`). |
| Gate only after a cited repro | quickchr-052, quickchr-080 | |
| Raise a timeout only once the slowness is understood | restraml-46, restraml-12, quickchr-104 | restraml `CLAUDE.md` "CI Anti-Patterns" 1. |
| Do not break a design rule or fork a path to dodge a bug | restraml-46 | restraml anti-patterns 4 and 9. |
| Count attempts, not elapsed time | quickchr-108 | quickchr `provisioning.instructions.md`. |
| One factor at a time; pinned versions | quickchr-123 | |
| Gate on the property, not a proxy; silent steps fail | restraml-47, restraml-38 | restraml anti-patterns 2, 3 and 8 (#96). |
| No remembered timings; name the accelerator | quickchr-104 | |
| Unproven causes stay out of docs, issues and skills | quickchr-052, quickchr-080, rskills-02, user-32 | |
| Less detail beats shaky detail; record with evidence | rskills-02, centrs-25 | |
| Done: the exercising test ran | centrs-02, centrs-09, centrs-25, quickchr-074, quickchr-136 | Settles `integration-cadence` with tikoci-testing. |
| Report checks not run | quickchr-136 | |
| Run the repo's gate commands | centrs-09, rosetta-15 | The commands themselves are repo-local. |
| Name the CI step that runs it | rosetta-27, rosetta-61 | rosetta's `VALIDATION.md` table stays repo-local. |
| The record is current; device result in the commit | quickchr-040, centrs-25 | Where each record lives is `tikoci-docs` and `tikoci-release`. |
