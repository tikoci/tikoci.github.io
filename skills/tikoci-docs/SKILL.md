---
name: tikoci-docs
description: "tikoci docs: one home per kind of information (README for users, CONTRIBUTING for developers, DESIGN.md for reasons, CHANGELOG for what shipped, issues for work with an end point, one small-items home named in AGENTS.md (BACKLOG.md by default), docs/ for recipes, a fact the code relies on beside that code with a test) and other files link to it; nothing undone stays in chat; references are generated from code, never hand-copied; new prose files get descriptive kebab-case names; published paths and anchors never move; screenshots live in the repo with their source. Use when adding, moving or naming docs, tracking work, or deciding where something goes."
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
| Complete usage: every command and option in context | MANUAL.md, or a generated reference |
| Development setup, tests, release commands, how to contribute | CONTRIBUTING.md (a README section in a small repo) |
| Rules an agent needs while editing an area | AGENTS.md or a repo skill (tikoci-house) |
| Why it is built this way; what was tried and dropped | DESIGN.md |
| A fact the code relies on | a comment at that code, and a test that pins it |
| Recipes, procedures, and facts no single piece of code owns | docs/, one topic per file |
| What shipped | CHANGELOG.md |
| Work with an end point | an issue |
| Small items | the repo's small-items home (BACKLOG.md by default) |
| Investigations worth keeping | a committed research directory |
| Exhaustive references (flags, schemas, API) | generated from the code |

- **Other files link to the home** and do not restate it; two copies drift.
  An issue does not mirror a doc, and a doc does not mirror an open issue.
- **Use an existing home before adding a top-level file.** A repo with a
  different set (rosetta's VALIDATION.md, centrs's docs/CONSTITUTION.md and
  docs/MATRIX.md) lists each file's job in AGENTS.md or CONTRIBUTING.md.
- **Docs that ship in the package are a choice.** centrs lists its
  per-command READMEs, CONSTITUTION, MATRIX and error pages in npm `files`,
  so an agent that installed it reads the spec in `node_modules` with no
  network. Links between shipped docs stay inside the shipped set.

## Tracking work

How a repo tracks work is its own business. These are the defaults:

- **An issue is work with an end point**: a bug with a reproduction, or a
  slice with acceptance criteria (a "Done when"). An idea with no end point
  goes into a doc; centrs moves it there and closes the issue as not
  planned with the `moved-to-docs` label and a link.
- **Issues from outside come in any shape.** A consumer or another repo
  files an idea, a question or a request; triage turns it into a bug, a
  slice or a note in a doc.
- **A closed `moved-to-docs` issue is history, not a rejection.** Read it
  for background; to resume the work, open a new issue that links back.
- **One small-items home, named in AGENTS.md.** Its items are one or two
  sentences each, a candidate for the next PR in their area, deleted when
  done or declined; an item that needs more explanation is an issue. The
  shapes in use:
  - a short list in BACKLOG.md, the default, and the name for a dedicated
    file;
  - BACKLOG.md as a map into the tracker, where small items are
    low-priority issues and the file links to their label views (quickchr,
    after its list grew too long to triage);
  - a section of a status file (centrs's Nits in docs/MATRIX.md);
  - a pinned roadmap issue grouping open themes (app-t3code #30).

  A list that grows past a screen moves into issues with a low-priority
  label.
- **Nothing undone stays in chat.** Breakage found, a workaround, a deferred
  follow-up or a risk goes into an issue or the small-items home before the
  work is called finished. The next agent has only the repo and the tracker.
- **Friction is a finding.** When an example or a test needs raw curl, state
  file reads, long sleeps or fragile parsing to work, file an issue instead
  of hiding it. Friction with another tikoci tool, found mid-task, can be one
  comment on a pinned collector issue (app-t3code #29), triaged later in
  whichever repo it belongs to.

Issue and PR linking is in
[tikoci-pr-flow](https://tikoci.dev/house/skills/tikoci-pr-flow/SKILL.md).

## Decisions, facts and research

- **DESIGN.md keeps the decision log**: "Why X, not Y", with the evidence,
  what was tried and why it was dropped. mikropkl's x86-on-ARM64 TCG
  attempt, abandoned after 16 iterations, is the kind of entry that saves
  the next 16.
- **AGENTS.md carries the guard**: one line per rejected approach an agent
  might bring back, linked to its reasoning, because AGENTS.md is the file
  every agent reads (app-t3code's "Gotchas": do not put tini back in front
  of its init, linking the research).
- **A fact the code relies on lives at that code**, with a test that pins
  it: centrs's btest wire layout is in `src/protocols/btest.ts`'s header and
  pinned by vectors in its unit test. A note records what was true the day
  it was written; a pinned test fails the day it stops being true. The
  research keeps how the fact was found, and the code links to it.
- **Investigations worth keeping are committed**, in two kinds:
  - a topic folder, updated in place as the work grows, with steps someone
    can reproduce: app-t3code `docs/research/<YYYY-MM>-<topic>/`, mikropkl
    `Lab/<topic>/NOTES.md`, quickchr `test/lab/<topic>/REPORT.md`, rosetta
    `briefings/`;
  - a dated note written once and never edited, for a run or a review on a
    given day (app-t3code `docs/notes/<YYYY-MM-DD>-<topic>.md`). A record
    edited later stops being evidence.

  An index (mikropkl's lists status and key finding), or names that serve
  as one (date and topic), each linked from the issue it served. Large
  binaries stay out of git. A probe that imports live code stays
  type-checked; changing what it measures is new research. A fix that
  proves out moves into the code, with its root cause written down.
  Throwaway session files go in `.scratch/` (tikoci-house).

## Generated docs

- **Generate what code already knows**: flag tables, schemas, API
  references, inventories. centrs builds `docs/CLI.md` from its command
  metadata (`bun run docs:cli`) and CI fails when the file is stale. Never
  copy an option table by hand into a README or a doc.
- **A generated block inside a hand-written file** sits between markers that
  the generator owns, with a check that fails when it is stale. Notes go
  outside the markers. The same holds for a snapshot inside a link:
  app-t3code's README links a `/app` YAML editor URL that encodes the YAML,
  and `test/freshness.test.ts` fails until it matches the committed file.
- **Never hand-edit generated output**, a whole generated file included.
  Change the source and regenerate.
- **A CLI change updates its docs and examples in the same PR**: the
  per-command page, its examples, and the README if it shows that command.

## Structured over prose

- **A list with columns is a data file, not paragraphs.** TSV for tables
  people edit (the house survey and skill list, tikoci-home's
  `layout.tsv`), TOML for configuration people edit, JSON for what a tool
  writes and reads. A Markdown file beside it explains the table and links
  to it. A script can read it, a diff shows the one row that changed, and
  it stays easy to edit by hand, which JSON is not.
- **Let checks read the file**: tikoci-home's `conformance.json` holds the
  cases every resolver is tested against, so the doc and the test cannot
  disagree.
- **Do not convert existing files for uniformity**; use the format for new
  files. Data that others consume has a contract
  ([tikoci-data-contracts](https://tikoci.dev/house/skills/tikoci-data-contracts/SKILL.md)).

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
- **A name linked from outside is not renamed for style**; see below.

## Durable URLs

- **A published path is a contract.** A schema, script, image or page that
  others link to keeps its path: restraml's `/app` schema files are linked
  from editors and SchemaStore, and tikoci.dev's `/scripts/`, `/media/`,
  `/logos/` and `/images/` have outside users. When one must move, the old
  path keeps working (a copy or a redirect) and the change says so.
- **A URL that shipped code prints is the strictest kind**: every installed
  version prints it for as long as anyone runs it. Every centrs error
  carries a `detailsUrl` under `https://tikoci.dev/centrs/errors/`.
  - Print the final URL: HTTPS, the canonical domain, and the trailing
    slash on a page or directory URL (never on a file). A URL that works
    only after a redirect is broken for agent fetch tools that stop at the
    redirect (centrs #464).
  - When a code's meaning narrows, its page says what it meant before,
    because older versions still print it with the old meaning.
- **An `/app` repo publishes contracts too**: the YAML at its raw URL and
  the app-store document, which routers load by URL, and the image tag the
  YAML names, which `/app/update` follows.
- **Anchors count.** When published scripts or other repos link to a
  heading, keep the old anchor working when the heading changes: mikropkl
  renamed a `QEMU.md` section and kept its old `#hvf-on-apple-m4-and-later`
  anchor, because published `qemu.sh` scripts link to it.
- **Release asset names stay the same** across versions, so download links
  hold.

## Editor files

Committed editor files (`.vscode/` tasks, launch configurations,
recommended extensions, settings) name commands that still exist. Change
them with the package script they call, or remove the stale entry.

## Screenshots and recordings

- **A visual feature's docs show it.** Capture the screenshot or GIF as part
  of the doc work, not later.
- **In the repo, with their source**: images in `docs/images/` with
  descriptive names, linked by relative path; a terminal recording from a
  committed tape file (quickchr renders `docs/tapes/*.tape` with VHS into
  `docs/images/*.gif`); a web page from a headless browser script. Then
  anyone can regenerate them after a change. Images on outside hosts (an
  image-sharing site) can disappear.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
