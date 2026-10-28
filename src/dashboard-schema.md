# TIKOCI dashboard data — schema reference (v2)

Build-time cross-repo status snapshot. Collector: `fetch-dashboard-data.ts`
driven by `DASHBOARD_REPOS` in `repo-config.ts`; refreshed hourly by the
deploy workflow. Rendered (in part) by `status.html`.

## Endpoints

| URL | Content |
|-----|---------|
| `/data/dashboard.json` | Bounded one-fetch entrypoint: signals, relationships, findings |
| `/data/ros-versions.json` | Channel versions only (one fetch instead of four feed reads) |
| `/data/dashboard/<repo>.json` | Per-repo detail: full work index + full ROS coverage |
| `/dashboard-schema.md` | This file |

## Top level

- `schemaVersion` (2) — bumped on breaking changes; old caches are never served.
- `generatedAt` — when the signals were collected (cache time when cached).
- `collection` — `{ mode, cacheWrittenAt }`. `mode` is `fresh`,
  `local-cache` (dev reuse), or `stale-cache-fallback` (total-failure
  fallback). Non-fresh modes also raise a `collection-stale-cache` finding.
- `budgets` — API spend (`githubApiCalls`, `otherHttpCalls`), caps
  (`maxConcurrency` 4, `timeoutMsPerRequest` 15000), and minimum observed
  `rateLimitRemaining`.
- `sources` — signal group → endpoint/feed provenance.
- `coverage` — collected repos + the single-page budget note.
- `rosCurrent` — MikroTik `NEWESTa7` feed per channel (`ROS_CHANNELS`).
- `repos` — per-repo signals (only subscribed groups present).
- `relationships` — curated cross-repo links with readiness semantics.
- `findings` — build-time derived exceptions, sorted failure → gap → pending → info.

## Signal states

Every signal has `state`: `ok` (answerable, including known-empty), `partial`
(truncated or incompletely enriched), `unknown` (unanswerable without a
transport failure, e.g. no manifest), `error` (fetch failed). `error` carries
the human-readable detail for `unknown`/`error`; `partial` is explained by
the `truncated`/`page` flags instead.

## Per-repo signals

- `detail` — pointer to the per-repo detail file.
- `ros` — version coverage. `kind` states the claim: `tagged` (tag exists;
  says nothing about builds — join with `ci` before calling a version
  "built"), `published` (versioned artifact published), `tested` (repo
  harness recorded it tested). `channels` judges only expected channels
  (`rosChannels`, default all) against the full uncapped list.
- `rosLag` — derived-artifact version vs stable. `unknown` until the repo
  publishes a machine-readable manifest (upstream: rosetta#230).
- `ci` — `{ defaultBranch, headSha, workflows[] }`. Each workflow reports
  the latest run **on the default branch only** (`runs?branch=<default>`),
  with `status`, `conclusion`, `headBranch`, `headSha`, `event`, and `isHead`
  (run commit vs branch head). Missing configured workflows appear with
  `present: false`; never-run workflows are `unknown`, never success. A run
  from any other branch is distrusted (`unknown`, never a failure verdict).
  Signal-level `state` aggregates: `ok` only when every workflow is `ok`,
  `partial` on mixed evidence, `unknown` with no tracked workflows.
- `community` — external-author filter view (v1-compatible): `open*` counts
  exclude owners/bots; `total*` counts include everyone. Lower bounds when
  `truncated`.
- `work` — full open issue/PR index, all authors: `counts` by class
  (owner/bot/external), `page` completeness, `items` (newest first, 10 in
  the entrypoint, full page in the detail file). Item fields: number, title,
  author, authorClass, url, createdAt, updatedAt, isPR, draft (PRs, null
  when unenriched), labels, milestone. Bodies/comments are never fetched.
- `npm` — `published: false` means confirmed absent (registry 404);
  `null` means unknown (fetch failed). `assessment`: `in-sync`,
  `pending-publish` (stable repo version ahead of registry),
  `prerelease-channel` (repo rides `-next`/beta ahead of latest —
  routine, not failure), `not-published`, `registry-ahead`, `unknown`.
  `distTags` records every registry tag. Legacy `behind` keeps its raw
  numeric meaning; prefer `assessment`.
- `release` — newest-release window: `newest` (absolute newest), `stable`
  (newest non-prerelease), `prereleaseChannel` (newest is prerelease while
  a stable exists). Legacy `latest*` fields track `newest`.

## Relationships

`{ source, target, type, kind, verified, note }`. `type` is the curated
project-map edge; `kind` is its readiness meaning (`dependency`,
`artifact-consumption`, `association`). `verified` is true only with a
`verifiedNote` in config. Currently all edges are unverified associations
or claimed dependencies — findings never derive from relationships, and no
edge implies a blocker.

## Findings

`{ id, rule, severity, category, repos, summary, detail, evidence, urls }`.
IDs are stable (`<rule>:<repo>[:<scope>]`). Severities: `failure` (broken),
`pending` (work to do), `info` (routine difference), `gap` (missing
evidence blocks a conclusion). Open work is never a failure. Evidence
entries are `<json-path>=<value>` pointers into this document.

Rules: `ci-default-branch-failing`, `ci-run-in-progress`,
`ci-run-unresolved`, `ci-run-not-head`, `ci-run-off-branch`,
`ci-no-default-runs`, `ci-workflow-missing`, `ci-run-error`,
`ci-workflows-error`, `ros-missing-channel`, `ros-coverage-error`,
`ros-lag-unknown`, `ros-lag-behind`, `npm-pending-publish`,
`npm-prerelease-channel`, `npm-not-published`, `npm-registry-ahead`,
`npm-unknown`, `release-prerelease-newest`, `release-no-stable-in-window`,
`release-none`, `release-unknown`, `work-external-prs`,
`work-external-issues`, `work-maintainer-prs`, `work-list-truncated`,
`work-unknown`, `collection-stale-cache`.

## Proposed: well-known repo status file (not yet implemented)

Repos should be able to declare their own status instead of the dashboard
guessing from tags and workflows. The contract lives in
[`tikoci-status-spec.md`](tikoci-status-spec.md): each repo may publish
`.tikoci/status.json` at its default-branch root — fixed envelope, optional
per-repo-type sections, everything nullable (unknown is always allowed).

Consumption (future collector change): read opportunistically per dashboard
repo (raw file, default branch), non-fatal — absent/unparseable stays
`unknown` exactly as today. When present, `ros.artifactVersion` answers
`rosLag` (this is the rosetta-manifest requirement in file form),
`packages[].expected: false` settles donny-class absence without config,
and `relations[]` can graduate curated edges to verified. The dashboard
config stays as override/fallback; the file is the repo's voice.

## Interpretation pitfalls

- Counts from a full 100-item page should be treated as lower bounds
  (exactly-100 is indistinguishable from more).
- A tag's existence never proves an artifact passed testing (`tagged` kind).
- `success` on an old commit (`isHead: false`) may not describe the tree.
- `not-published` intent (reserved/planned/abandoned) is not in the data.
- Non-`fresh` collection mode dates every verdict to `cacheWrittenAt`.
