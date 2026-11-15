# House skills: survey and skill list

Working files for [#21](https://github.com/tikoci/tikoci.github.io/issues/21): this
repo becomes the source of truth for tikoci development and maintenance rules, written
as agent-agnostic `SKILL.md` files. This directory holds the Phase 0 survey and the
skill list the later phases build.

| File | Holds |
| --- | --- |
| `skills.tsv` | The planned house skills, one row each: `skill`, `phase`, `scope`, `topics` (survey topics it covers), `absorbs` (existing skills it replaces) and `rows` (survey rows that feed it). Living list. |
| `2026-11-survey.tsv` | One row per instruction or skill source (or per topic section of a long one), November 2026 snapshot. |
| `2026-11-conflicts.tsv` | Places where repos or user-level files disagree: `topic`, `skill`, `positions`, `evidence`, `status` (`reported`, `verified` against the sources, or `settled`) and `resolution` (the rule that settles it, or `-`). Each house skill settles its rows. |

## Survey scope

Sources read in full: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`,
`.github/copilot-instructions.md`, `.github/instructions/`, and repo skills in centrs,
rosetta, quickchr, mikropkl, restraml, routeros-skills and this repo; plus the
operator's user-level instruction files and non-`routeros-*` user skills.

Not surveyed: the public `routeros-*` skills (they stay in tikoci/routeros-skills),
agent worktrees, repos outside that list, and third-party vendor skills installed at
user level (one `drop` row: maintained upstream, not tikoci rules). User-level sources
appear under labels
(`user:home-CLAUDE.md`, `user-skill:<name>`); their rows describe intent only, never
machine facts.

## Survey columns

- `id`: `<source prefix>-NN`, stable for citing.
- `source`: `<repo>:<path>`, `user:<label>` or `user-skill:<name>`.
- `section`: the heading a row covers, or `-` for the whole file.
- `topic`: one slug from a fixed vocabulary (`other:<slug>` when none fit).
- `intent`: what the rule is for, and the rule in short.
- `target`: `house`, `repo-local`, `lint` (a check should enforce it),
  `local-notes` (operator machine facts), `routeros-skills` (outward-facing RouterOS or
  tool-usage knowledge) or `drop` (stale or duplicated).
- `skill`: for `house` rows, the planned skill (see `skills.tsv`).
  Assigned by topic, with a few row-level moves; each skill's PR refines the mapping
  for its own rows.
- `publishable`: whether the source text could be published as is: `yes`, `sanitize`
  (a few local paths or facts), `no`.
- `notes`: contradictions, or "strong source" for the best-written version of a rule.

## Results

498 rows from 119 sources: 287 `house`, 94 `repo-local`, 37 `routeros-skills`,
26 `local-notes`, 5 `lint`, 49 `drop`. 63 rows need sanitizing or stay private.

The house rows group into 17 skills (`skills.tsv`). Published skills live in
[`skills/`](../../skills/) and at <https://tikoci.dev/house/>. `tikoci-house` ships in Phase 1
and `tikoci-home` in Phase 2; the other 15 are Phase 3. Compared with the original strawman in
issue #21, the survey adds `tikoci-testing`, `tikoci-release`, `tikoci-interfaces` (errors,
CLI, library and MCP surfaces, which quickchr, centrs and rosetta all write about),
`tikoci-web` and `tikoci-crossref`, and splits GitHub work into `tikoci-ci` and
`tikoci-github`. Local agent notes fold into `tikoci-house`.

Observations that shape later phases:

- The same rule is often written three or four times: grounding and no-masking
  appears in quickchr four times and in the user-level files, and the Bun rules in
  most repos. A house skill replaces copies, not originals.
- `tikoci-home` had only 1 survey row (5 after Phase 2 moved four quickchr rows to it):
  path rules live in code and in centrs#654, not in instructions. Phase 2 worked from
  the code; its per-tool map is `skills/tikoci-home/references/layout.tsv`.
- The user-level files hold most of the generic rules and most of the operator-local
  facts, side by side. Phase 4 can only shrink them after the house skills exist.
- `tikoci-crossref` overlaps `data/repo-config.ts`; generating it from that data is
  worth trying in Phase 3.
