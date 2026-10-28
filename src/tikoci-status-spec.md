# tikoci repo status file — spec (`tikociStatus: 1`)

Status: proposal. The dashboard consumer is not implemented yet; nothing
reads this file today. This document is the contract other repos (and the
agents editing them) implement against.

## Purpose

Let each repo declare its own cross-repo status instead of the dashboard
guessing from tags and workflows. One well-known location, a fixed
envelope, optional sections per repo type. Everything nullable: unknown is
always a valid answer, and readers must never punish its absence.

## Location

`.tikoci/status.json` at the repository's default-branch root. Plain file,
no build step. Must be valid JSON (no comments), UTF-8, at most 16 KB.

## Envelope

| Field | Required | Meaning |
|-------|----------|---------|
| `tikociStatus` | yes | Spec version. Must be `1`. |
| `repo` | yes | Repo name. SHOULD match the repository. |
| `updatedAt` | no | ISO 8601 timestamp of last hand edit (informational). |

Readers MUST ignore unknown fields. Readers SHOULD proceed best-effort on
newer `tikociStatus` values using only the fields they know.

## Sections

All sections are optional. Omit any section you cannot state accurately.
Explicit `null` means "unknown", same as omitting.

### `ros`

Derived-artifact provenance (answers the dashboard's ros-lag signal).

| Field | Meaning |
|-------|---------|
| `artifact` | Artifact name, e.g. `"ros-help.db"` |
| `artifactVersion` | ROS version it was built from, e.g. `"7.25"` |

### `packages`

Published-package declarations. Array of:

| Field | Required | Meaning |
|-------|----------|---------|
| `name` | yes | Registry name, e.g. `"@tikoci/rosetta"` |
| `expected` | no | `false` = intentionally unpublished (donny-class). Default `true`. |
| `channel` | no | Free-form development line, e.g. `"next"`. Informational. |

### `releases`

Release expectations (the GitHub Releases API supplies the facts).

| Field | Meaning |
|-------|---------|
| `expected` | `false` = this repo intentionally has no GitHub releases. Default `true`. |
| `stableTag` | Newest stable tag when the newest release is a prerelease (rarely needed; the API window usually suffices). |

### `relations`

Cross-repo links declared by this repo. Array of:

| Field | Required | Meaning |
|-------|----------|---------|
| `target` | yes | Target repo name under `tikoci`. |
| `kind` | yes | `dependency`, `artifact-consumption`, or `association`. |
| `note` | no | Evidence, e.g. `"Dockerfile builds FROM ammo74/make.d"`. |

A declared relation counts as verified-from-source (the repo's own voice);
the dashboard records the declaring repo as provenance. Targets SHOULD
reciprocate genuine dependencies, but one-sided declaration is accepted.

### `custom`

Free-form object for repo-specific status. Namespaced by the repo; readers
ignore it. Keep it small and JSON-plain (no nested binaries).

## Rules

1. No secrets, tokens, or credential-bearing URLs. This file is public.
2. Absent file, unparseable JSON, or wrong version: the dashboard treats
   every question as `unknown`, exactly as today. Absence is silent;
   unparseable files may raise a future collection finding (not specified yet).
3. Precedence: the file wins for repo-declared facts (it is the repo's
   voice); dashboard config wins for dashboard presentation (which signal
   groups to collect, workflow names, locators).
4. Additive changes (new optional fields/sections) do not bump the version.
   Removing, renaming, or redefining a field does.

## Examples

Rosetta-style derived artifact (this is the rosetta#230 requirement in file form):

```json
{
  "tikociStatus": 1,
  "repo": "rosetta",
  "ros": { "artifact": "ros-help.db", "artifactVersion": "7.25" },
  "packages": [{ "name": "@tikoci/rosetta", "channel": "next" }]
}
```

Donny-style intentionally unpublished code:

```json
{
  "tikociStatus": 1,
  "repo": "donny",
  "packages": [{ "name": "@tikoci/donny", "expected": false }],
  "releases": { "expected": false }
}
```

Container with a verified build dependency:

```json
{
  "tikociStatus": 1,
  "repo": "netinstall",
  "relations": [
    { "target": "make.d", "kind": "association", "note": "shares mk recipe style; Dockerfile builds FROM stock alpine" }
  ]
}
```

## Adoption checklist (for agents adding this to a repo)

1. Create `.tikoci/status.json` on the default branch.
2. Fill only sections you can state accurately from the repo itself; omit the rest.
3. Validate: JSON parses, `tikociStatus` is `1`, `repo` matches, no secrets, under 16 KB.
4. Open a PR in that repo. No dashboard change needed: the consumer will pick
   the file up automatically once implemented.
