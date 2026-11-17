---
name: tikoci-docs
description: "tikoci docs: one home per kind of information (README for users, CONTRIBUTING for developers, DESIGN.md for reasons, CHANGELOG for what shipped, issues for work with an end point, BACKLOG.md for small items, docs/ for recipes and facts) and other files link to it; nothing undone stays in chat; references are generated from code, never hand-copied; new prose files get descriptive kebab-case names; published paths and anchors never move; screenshots live in the repo with their source. Use when adding, moving or naming docs, tracking work, or deciding where something goes."
---

# Where things go

Where each kind of information lives in a tikoci repo, so it is written once
and found again by the next person or agent. Agent instruction files are in
[tikoci-house](https://tikoci.dev/house/skills/tikoci-house/SKILL.md),
SECURITY.md in
[tikoci-github](https://tikoci.dev/house/skills/tikoci-github/SKILL.md),
and the CHANGELOG's mechanics in
[tikoci-release](https://tikoci.dev/house/skills/tikoci-release/SKILL.md).

## One home per kind

| Information | Home |
| --- | --- |
| What it is, install, a quick start | README.md |
| Development setup, tests, release commands, how to contribute | CONTRIBUTING.md (a README section in a small repo) |
| Why it is built this way; what was tried and dropped | DESIGN.md |
| Recipes, procedures and grounded facts | docs/, one topic per file |
| What shipped | CHANGELOG.md |
| Work with an end point | an issue |
| Small items and triggers waiting on an event | BACKLOG.md |
| Investigations worth keeping | a committed research directory |
| Exhaustive references (flags, schemas, API) | generated from the code |
| Narrative history | git |
| License | LICENSE |

- **Other files link to the home** and do not restate it; two copies drift.
  An issue does not mirror a doc, and a doc does not mirror an open issue.
- **Use an existing home before adding a top-level file.** A repo with a
  different set (rosetta's MANUAL.md and VALIDATION.md, centrs's
  docs/CONSTITUTION.md and docs/MATRIX.md) lists each file's job in
  AGENTS.md or CONTRIBUTING.md.

## Tracking work

How a repo tracks work is its own business. These are the defaults:

- **An issue is work with an end point**: a bug with a reproduction, or a
  slice with acceptance criteria (a "Done when"). An idea with no end point
  goes into a doc; centrs moves it there and closes the issue as not
  planned with the `moved-to-docs` label and a link.
- **BACKLOG.md holds small items**, one or two sentences each, deleted when
  done or declined. An item that needs more explanation is an issue. A repo
  that keeps such a file names it BACKLOG.md.
- **Nothing undone stays in chat.** Breakage found, a workaround, a deferred
  follow-up or a risk goes into an issue, BACKLOG.md or DESIGN.md before the
  work is called finished. The next agent has only the repo and the tracker.
- **Friction is a finding.** When an example or a test needs raw curl, state
  file reads, long sleeps or fragile parsing to work, file an issue instead
  of hiding it.

Issue and PR linking is in
[tikoci-pr-flow](https://tikoci.dev/house/skills/tikoci-pr-flow/SKILL.md).

## Decisions and research

- **DESIGN.md keeps the decision log**: "Why X, not Y", with the evidence,
  what was tried and why it was dropped, so a later agent does not bring a
  rejected fix back. mikropkl's x86-on-ARM64 TCG attempt, abandoned after
  16 iterations, is the kind of entry that saves the next 16. AGENTS.md
  stays short and points there.
- **Investigations worth keeping are committed** in one research directory
  with an index of topics (status, key finding), each topic holding notes
  with steps someone can reproduce: mikropkl `Lab/<topic>/NOTES.md`,
  quickchr `test/lab/<topic>/REPORT.md`, rosetta `briefings/B-*.md`. Large
  binaries stay out of git. A fix that proves out moves into the code, with
  its root cause written down. Throwaway session files go in `.scratch/`
  (tikoci-house).

## Generated docs

- **Generate what code already knows**: flag tables, schemas, API
  references, inventories. centrs builds `docs/CLI.md` from its command
  metadata (`bun run docs:cli`) and CI fails when the file is stale. Never
  copy an option table by hand into a README or a doc.
- **A generated block inside a hand-written file** sits between markers that
  the generator owns, with a check that fails when it is stale. Notes go
  outside the markers.
- **Never hand-edit generated output.** Change the source and regenerate.
- **Human-written docs explain** concepts, workflows and decisions, the
  parts a generator cannot know.
- **A CLI change updates its docs and examples in the same PR**: the
  per-command page, its examples, and the README if it shows that command.

## README

- **Short**: what it is, how to install it, a quick start, and links to the
  rest. A CLI's README is its overview and links to the generated
  reference.
- **Tools outside `bun install`** (QEMU, uv, a system library) are listed
  with install notes for macOS, Linux and Windows.

## File names

- **New prose files get descriptive kebab-case names**, so a listing tells
  what each holds: `networking-recipes.md`, `macos-launchd-research.md`, not
  `notes.md` or `misc.md`. Images too, and no spaces in any name.
- **Conventional names stay**: README.md, AGENTS.md, CHANGELOG.md,
  SECURITY.md, LICENSE.
- **A name linked from outside is not renamed for style**; see below.

## Durable URLs

- **A published path is a contract.** A schema, script, image or page that
  others link to keeps its path: restraml's `/app` schema files are linked
  from editors and SchemaStore, and tikoci.dev's `/scripts/`, `/media/`, `/logos/` and
  `/images/` have outside users. When one must move, the old path keeps
  working (a copy or a redirect) and the change says so.
- **Anchors count.** When published scripts or other repos link to a
  heading, keep the old anchor working when the heading changes: mikropkl
  renamed a `QEMU.md` section and kept its old `#hvf-on-apple-m4-and-later`
  anchor, because published `qemu.sh` scripts link to it.
- **Release asset names stay the same** across versions, so download links
  hold (tikoci-release).

## Editor files

Committed editor files (`.vscode/` tasks, launch configurations,
recommended extensions, settings) name commands that still exist. Change
them with the package script they call, or remove the stale entry.

## Screenshots and recordings

- **A visual feature's docs show it.** Capture the screenshot or GIF as part
  of the doc work, not later.
- **In the repo, with their source**: images in `docs/images/` with
  descriptive names; a terminal recording from a committed tape file
  (quickchr renders `docs/tapes/*.tape` with VHS into `docs/images/*.gif`);
  a web page from a headless browser script. Then anyone can regenerate them
  after a change. Images on outside hosts (an image-sharing site) can
  disappear.
- **Small and described**: cropped to the feature, short loops, alt text
  that says what the image shows, linked by relative path. In HTML,
  `figure` with a `figcaption` where a caption helps.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
