---
name: tikoci-github
description: "tikoci GitHub repo settings: repos in the tikoci org; squash merge only, branches deleted on merge; main under classic protection (conversation resolution, no force push; required checks only where no workflow pushes to main); Copilot reviews once via a ruleset; secret scanning with push protection, private vulnerability reporting, Dependabot alerts, CodeQL on code and workflows; read-only workflow token, SHA-pinned actions; zero open alerts, each dismissal with a reason; a SECURITY.md; token order TIKOCI_GITHUB_TOKEN, GH_TOKEN, GITHUB_TOKEN, gh auth token. Use when creating a repo, changing settings or handling an alert."
---

# GitHub settings

How a tikoci repository is set up on GitHub, and how its security alerts are
handled. The PR flow these settings serve is in `tikoci-pr-flow`; workflows
themselves are in `tikoci-ci`. Commands to check and apply each setting are in
[references/settings.md](references/settings.md).

## Repository

- **Repos live in the tikoci org**, never under a personal account.
- **Squash merge only**, with the PR title and description as the commit
  (`tikoci-pr-flow`); merge commits and rebase merging off; head branches
  deleted on merge.
- **A `skip-review` label** ("Skip CodeRabbit's automatic review"), which
  the CodeRabbit config honors.
- **Before a repo goes public**, audit everything committed for private data,
  not only test fixtures: runtime databases, scratch notes, pointers to local
  machines. Fixtures are synthetic.

## Branch protection

- **`main` uses classic branch protection**: require conversation
  resolution, block force pushes and deletion, and leave admins unenforced so
  the maintainer can unblock `main`.
- **Required status checks only where no workflow pushes to `main`.** They
  apply to direct pushes too, and a snapshot workflow pushes a commit it
  created after its checks ran, so a required check rejects it (the
  workflow token is not an admin). centrs, quickchr and rosetta require
  their gate jobs; this repo, whose workflows commit snapshots, requires
  none.
- **Classic, not a ruleset, while workflows commit to `main`.** Classic
  protection can require resolved conversations without requiring a PR, so a
  snapshot workflow's `GITHUB_TOKEN` push and a maintainer's direct fix still
  land. In a ruleset, conversation resolution is part of the "Require a pull
  request" rule, and the workflow token cannot be on a bypass list (a GitHub
  App can). A repo with no bot pushes may also require a PR, with no required
  approvals (routeros-skills).
- **Copilot reviews through a ruleset** ("Automatically request Copilot code
  review") with "Review new pushes" and "Review draft pull requests" off, so
  it reviews once on ready, like CodeRabbit. centrs, quickchr and rosetta
  run it this way.

## Security settings

| Setting | House default |
| --- | --- |
| Secret scanning, push protection | On. Push protection for the repository is off by default even on public repos; a user's own push protection creates no alert. |
| Private vulnerability reporting | On; SECURITY.md points to it. |
| Dependabot alerts and security updates | On. They cover GitHub Actions; Bun packages are not supported, so `bun audit` checks them ([tikoci-dependencies](https://tikoci.dev/house/skills/tikoci-dependencies/SKILL.md)). |
| Code scanning | CodeQL default setup for `javascript-typescript` and `actions`, Extended suite. |
| Workflow audit | zizmor, reported to code scanning ([tikoci-linting](https://tikoci.dev/house/skills/tikoci-linting/SKILL.md)). |
| Code Quality | Where the org enables it. |
| Dependency review | Optional: it sees only what the dependency graph supports, which excludes `bun.lock`. |

- **Default setup** needs no workflow to pin or update. Path exclusions and
  extra queries no longer need a workflow either: the
  `github-codeql-config-file` repository property points default setup at a
  CodeQL config file, set per repo or as an org default (GA since
  2026-08-04). Advanced setup (a workflow, as centrs, rosetta and restraml
  run with the `security-and-quality` suite) is for what default setup
  cannot do, such as that suite or a build step; SECURITY.md says why.
- **Secret scanning replaces a secret linter** in the gate; a repo that
  handles credentials in files may add secretlint (centrs).

## Actions settings

- **The workflow token is read-only by default**, and "Allow GitHub Actions
  to create and approve pull requests" is off. Each workflow declares
  `permissions: contents: read` at the top and raises it per job (zizmor's
  `excessive-permissions` audit checks this). Every tikoci repo surveyed still
  defaults to write: declare `permissions:` in each workflow first, then
  switch the default.
- **Require actions pinned to a full commit SHA** in the allowed-actions
  policy, once the workflows are pinned and Dependabot keeps them current
  (`tikoci-dependencies`). The policy turns a missed pin into a failed run.
- **Fork pull requests** keep GitHub's default: a first-time contributor's
  workflows wait for approval. No `pull_request_target` workflow runs code
  from the PR.

## Alerts

- **Aim for zero open alerts on public repos**: code scanning, Dependabot
  and secret scanning. A private repo may hold a lower bar.
- **Fix real findings. Dismiss a false positive in the Security tab** (or the
  API) only after showing the value is not sensitive or the reported flow
  cannot happen, with that as the written reason; the dismissal is the audit
  record. In-code
  `codeql[...]` and `lgtm[...]` comments do not suppress an alert (centrs
  PR #233), and moving the code only changes its fingerprint. A
  `query-filters` entry in advanced setup is the rule-wide alternative.
- **On an open PR, query alerts with `pr=<number>`**; without it the API
  shows only the default branch. Check that an analysis exists for the PR's
  head before reading an empty list as clean.
- **Code Quality findings are not in the code-scanning alert API.** Check its
  tab too before reporting zero.

Commands and two common false positives are in
[references/settings.md](references/settings.md).

## SECURITY.md

Every repo has one, from
[SECURITY.example.md](assets/SECURITY.example.md): report privately through
private vulnerability reporting, never a public issue; the scope; the
scanning that runs, and what does not run and why; the supported versions.
Keep the scanning list true when a setting changes.

## GitHub API access

- **Token order**: `TIKOCI_GITHUB_TOKEN`, then `GH_TOKEN`, then
  `GITHUB_TOKEN`, then `gh auth token`, then anonymous. The tikoci variable
  overrides; the rest is `gh`'s own order.
- **Resolve credentials only in commands that call the API**: an ordinary
  build or test resolves none.
- **One helper makes every call**, handling auth, timeouts and errors
  (rosetta `fetchGitHub()` in `src/github.ts`); the general rule is
  `tikoci-interfaces`. CI passes `GITHUB_TOKEN: ${{ github.token }}`
  explicitly to the step that needs it.
- **Never print or commit a token.**

## Sources

[references/sources.md](references/sources.md) lists the survey rows, repo
files and GitHub docs behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
