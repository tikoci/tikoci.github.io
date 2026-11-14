# Writing house skills

For maintainers of tikoci/tikoci.github.io, and for anyone proposing a house rule.

## Shape

- **One skill per area, few and dense.** One skill for all linters, not one per
  former instruction file. The planned set is in
  [docs/house/skills.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/skills.tsv);
  a new area is a new issue first.
- **The description states the rules themselves**: "Use X, not Y, when Z", then
  when to load the skill. Harnesses list every description up front and may
  truncate that listing, and GitHub code review picks skills by relevance, so
  the description must work on its own.
- **The body repeats the operative rules** with the reason and the exceptions.
  Detail, examples and sample configs go in `references/`, linked from the body.
- **Defaults, not mandates.** Write what a repo should do and why, so a repo
  that needs an exception can see what it gives up.
- **A rule a linter can check becomes a lint rule.** The skill names the linter
  and says why, instead of asking agents to remember it.
- **Ground what is not obvious.** Link the public source (a doc, an issue, a
  file in a tikoci repo) for a claim a reader could doubt. Less detail beats
  shaky detail.
- **No machine facts.** Assume the usual toolset (Bun, Claude Code, Codex,
  T3 Code, hosted CodeRabbit), never one operator's machine: no home paths,
  host names, accounts or local registrations. Point to the local agent notes.

## Layout

```text
skills/
  README.md                  layout and checks (published as /house/skills/README.md)
  tikoci-<area>/
    SKILL.md                 frontmatter + operative rules
    references/              detail, examples, sample configs (optional)
    scripts/  assets/        only if the skill needs them (optional)
```

The directory is published unchanged at
`https://tikoci.dev/house/skills/tikoci-<area>/` and copied unchanged into other
repos, so it must be self-contained: relative links stay inside the directory,
and other skills or site pages are linked by absolute `https://tikoci.dev/...`
URL. Published URLs are durable; do not rename a skill or move a file once
merged without a redirect plan.

## Checks

`bun run lint` in tikoci/tikoci.github.io runs these on `skills/`, and the
build refuses to publish skills that fail them:

- markdownlint-cli2 with the rules in `skills/.markdownlint.yaml`;
- cspell, with project words in `project-words.txt`;
- `scripts/check-skills.ts`:
  - YAML frontmatter with string `name` and `description`, and only
    Agent Skills spec keys (`name`, `description`, `license`,
    `compatibility`, `metadata`, `allowed-tools`);
  - `name` equals the directory, matches `tikoci-<lowercase-words>`, at most
    64 characters;
  - `description` non-empty, at most 1024 characters, no `<` or `>`;
  - an H1 right after the frontmatter;
  - only `SKILL.md`, `references/`, `scripts/` and `assets/` at a skill's top level;
  - no absolute home directory paths or local host names in text files;
  - every relative Markdown link resolves inside the skill directory;
  - all descriptions together within the house budget (8000 characters).

The budget keeps the full listing readable in harnesses that load every
description. The check prints the running total; raise the budget on purpose,
in review, not to make a check pass.

## Process

Each skill is a small PR against `main` with a review round. The PR refines the
skill's rows in `docs/house/2026-11-survey.tsv` and settles its rows in
`docs/house/2026-11-conflicts.tsv`.
