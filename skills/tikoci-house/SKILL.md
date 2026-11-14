---
name: tikoci-house
description: "How a tikoci repo sets up agent instructions and skills. AGENTS.md is the one entry file and CLAUDE.md is the single line @AGENTS.md; add no new .github/instructions files. Repo skills live in .agents/skills (.claude/skills links to it); house tikoci-* skills from tikoci.dev/house/skills are copied unchanged or referenced by URL, listed in AGENTS.md, and any deviation is noted once under House exceptions. Precedence: the maintainer's explicit instruction, then the nearest AGENTS.md, then house skills, then user-level notes. Temporary work goes in a gitignored .scratch/. Machine facts (paths, hosts, accounts, harnesses) stay in the operator's local agent notes, never in a repo or skill. Use when creating or editing AGENTS.md, CLAUDE.md, .agents/ or a SKILL.md, adopting a house skill, or deciding where a rule belongs."
---

# tikoci house conventions

House skills are the shared defaults for developing and maintaining tikoci repos.
They are published at <https://tikoci.dev/house/> from
[tikoci/tikoci.github.io](https://github.com/tikoci/tikoci.github.io/tree/main/skills).
This one says how repos take them up and where agent instructions live; the
others cover one area each (toolchain, testing, linting, CI and so on).

## Skill tiers

| Prefix | Home | Covers |
| --- | --- | --- |
| `routeros-*` | [tikoci/routeros-skills](https://github.com/tikoci/routeros-skills) | Facing outward: RouterOS knowledge and how to use tikoci tools. Installed per user, never vendored into a repo. |
| `tikoci-*` | this site, `/house/skills/` | Facing inward: developing and maintaining tikoci repos. Copied into the repos that use them. |
| `<repo>-*` | that repo's `.agents/skills/` | One repo's own workflows, e.g. `quickchr-maintainer`. |

The `tikoci-` prefix is reserved for house skills, so a repo-local skill never
shadows one. A rule that only makes sense in one repo is not a house rule.

## Adopting house skills

A repo takes up each house skill it uses in one of two ways. Nothing pushes
skills into repos.

- **Copy** when the skill applies to most changes in the repo. Copy the whole
  skill directory unchanged into `.agents/skills/<name>/`, from the source repo
  or from `https://tikoci.dev/house/skills/<name>/` (`/house/index.json` lists
  each skill's files); `cp -r` is enough. Copy rather than symlink to another
  checkout, so the repo works on any machine. A copied skill's description is
  loaded in every session, so it costs listing space.
- **Reference by URL** when the topic comes up rarely. One line in AGENTS.md,
  or in a repo skill, says when to read it, e.g. "Before changing release
  workflows, read <https://tikoci.dev/house/skills/tikoci-release/SKILL.md>".
  The agent fetches it only when needed, and it always reads the current
  version.
- **List them.** AGENTS.md has a short `## House skills` section naming each
  skill the repo uses and whether it is copied or referenced, so agents without
  skill discovery still find them.
- **Do not edit a copy.** A copy that drifts is no longer the house rule and
  hides the disagreement. Refresh by copying again; whether to check for
  staleness is the repo's choice.
- **Exceptions are written down once.** A repo that does not follow a house rule
  says so in AGENTS.md under `## House exceptions`, one line per rule with the
  reason. A one-off deviation goes in the PR description. Confirm a substantive
  one with the maintainer first.
- **Changing a house rule** is a PR to tikoci/tikoci.github.io, not an edit in a
  consuming repo.

## Agent entry files

- **AGENTS.md is the entry file** for every agent, at the repo root. It holds
  the repo's rules or routes to them. Other agents get thin pointers to it,
  never a second copy of the rules.
- **CLAUDE.md contains only `@AGENTS.md`**: an import, not a symlink and not a
  separate guide. Claude Code loads CLAUDE.md, and the import brings in
  AGENTS.md.
- **A directory AGENTS.md** holds constraints local to that directory. The
  closest one to the file being changed wins over the root. Put a
  `CLAUDE.md` containing `@AGENTS.md` next to it too: Claude Code finds nested
  instructions through CLAUDE.md files, so without one it can miss them.
- **No new `.github/instructions/` files.** SKILL.md is the agent-agnostic
  format. Repos that still have scoped instruction files retire them on their
  own schedule; until then AGENTS.md lists each one with what it governs,
  because Codex and others ignore `applyTo` and must read them by hand.
  `.github/copilot-instructions.md`, if present, is only a pointer.
- **Keep AGENTS.md short and current.** Change it in the same commit as the
  convention it describes. Long detail moves to `docs/` or a repo skill.
  Work items (plans, TODO lists, open questions) go in issues or the repo's
  backlog file, never in instruction files.
- **One home per rule.** State a rule once, in the narrowest place that governs
  it, and point to it elsewhere. Durable facts go in the repo, not in an
  agent's private memory, which other agents and machines cannot see.

## `.agents/` and skill directories

- Repo skills (copied house skills and the repo's own) live in
  `.agents/skills/<name>/SKILL.md`. `.claude/skills` is a symlink to
  `../.agents/skills` so Claude Code loads the same files.
- Do not vendor `routeros-*` skills into a repo; they are installed per user.
- A skill directory is self-contained: relative links stay inside it, and
  anything outside is linked by absolute URL.
- After adding or relinking a skill, check that the agent actually lists it
  (the frontmatter `name` must match the directory) before relying on it.
  Some harnesses pick up changes during a session; if it is missing, start a
  new session.

## Instruction precedence

1. The maintainer's explicit instruction in the current session.
2. The nearest AGENTS.md (directory, then repo root), including its
   `## House exceptions`.
3. House skills.
4. User-level notes and agent defaults.

When two sources conflict, follow the higher one and mention the conflict only
if it changes what you do.

## `.scratch/`

Temporary work that a person or another agent may need to see (repro scripts,
logs, drafts, downloaded samples) goes in a repo-local `.scratch/` listed in
`.gitignore`. Shipping code, tests and committed docs never refer to it. To keep
something, move it to its proper place in the same change that relies on it.

## Local agent notes

Facts about one operator's setup stay out of repos and skills: home paths, host
names, CPU architecture, installed harnesses and subscriptions, connected
machines, account names, local checkouts. They live in the operator's
user-level agent files (for example `~/.claude/CLAUDE.md` or
`~/.codex/AGENTS.md`). A skill that needs such a fact says "see the local agent
notes" and assumes only the usual toolset: Bun, Claude Code, Codex, T3 Code and
hosted CodeRabbit.

## Writing house skills

See [references/writing-house-skills.md](references/writing-house-skills.md)
for the format, the checks the build runs and the description budget.
[references/sources.md](references/sources.md) lists the surveyed sources
behind each rule.
