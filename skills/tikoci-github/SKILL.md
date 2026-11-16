---
name: tikoci-github
description: "tikoci GitHub repo settings: repos in the tikoci org; squash merge only, branches deleted on merge; main under classic protection (conversation resolution, no force push; required checks only where no workflow pushes to main); only what a free org gets for public repos; secret scanning with push protection, private vulnerability reporting, Dependabot alerts, CodeQL on code and workflows; read-only workflow token, SHA-pinned actions; zero open alerts, each dismissal with a reason; a SECURITY.md; token order TIKOCI_GITHUB_TOKEN, GH_TOKEN, GITHUB_TOKEN, gh auth token. Use when creating a repo, changing settings or handling an alert."
---

# GitHub settings

How a tikoci repository is set up on GitHub, and how its security alerts are
handled. **The defaults use only what a free organization gets for public
repositories**: no paid add-on (Copilot, Code Quality and its AI findings,
Advanced Security for private repos) is part of the house setup, so nothing
breaks when a subscription lapses. The PR flow these settings serve is in `tikoci-pr-flow`; workflows
themselves are in [tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md). Commands to check and apply each setting are in
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
  workflow token is not an admin). A workflow that only stores data can push
  to a side branch instead and keep `main`'s checks (quickchr `ci-data`,
  centrs's QA branch); this repo deploys its snapshots from `main`, so it
  requires none.
- **Require the repo's own gate jobs, not a bot's check.** CodeRabbit's
  check is green or skipped whether it reviewed, skipped or was rate
  limited, and a required one blocks merging when the service is down
  (centrs requires one; it goes on adoption).
- **A required check may report `main`'s health** rather than the PR's
  (centrs `Main health (nightly QA)`, quickchr `Integration freshness`).
  While `main` is red it fails every PR; when the PR is the fix, run the
  integration workflow on the branch and the maintainer merges as admin,
  which is what leaving admins unenforced is for. "Require branches to be up
  to date" stays off (`strict: false` in both).
- **Classic, not a ruleset, while workflows commit to `main`.** Classic
  protection can require resolved conversations without requiring a PR, so a
  snapshot workflow's `GITHUB_TOKEN` push and a maintainer's direct fix still
  land. In a ruleset, conversation resolution is part of the "Require a pull
  request" rule, and the workflow token cannot be on a bypass list (a GitHub
  App can). A repo with no bot pushes may also require a PR, with no required
  approvals (routeros-skills).
- **No review is a required gate.** Reviews arrive from CodeRabbit, local
  agents, other repos' agents and people (`tikoci-pr-flow`); conversation
  resolution is what makes each one count. Where Copilot code review is
  available it is one more optional reviewer, set up through a ruleset
  ("Automatically request Copilot code review", with "Review new pushes" and
  "Review draft pull requests" off) so it reviews once on ready, as in
  centrs, quickchr and rosetta. Its pending review shows as a requested
  reviewer, not a check, and nothing waits for it.

## Security settings

| Setting | House default |
| --- | --- |
| Secret scanning, push protection | On. Push protection for the repository is off by default even on public repos; a user's own push protection creates no alert. Generic patterns (private keys, basic-auth headers) are not available on GitHub Free: the API accepts the setting and leaves it disabled. |
| Private vulnerability reporting | On; SECURITY.md points to it. |
| Dependabot alerts and security updates | On. They cover GitHub Actions; Bun packages are not supported, so `bun audit` checks them ([tikoci-dependencies](https://tikoci.dev/house/skills/tikoci-dependencies/SKILL.md)). |
| Code scanning | CodeQL default setup for `javascript-typescript` and `actions`, Extended suite. |
| Workflow audit | zizmor, reported to code scanning ([tikoci-linting](https://tikoci.dev/house/skills/tikoci-linting/SKILL.md)). |
| Dependency review | Off: it reads only what the dependency graph supports, which excludes `bun.lock`. |
| Code Quality, AI findings | Not used: paid features. |

- **CodeQL default setup** needs no workflow to pin or update. It picks
  languages from the repo's code, so check `languages` after enabling: one C
  probe under `test/lab/` added `c-cpp` to quickchr. Drop a language whose
  code does not ship by setting `languages` explicitly.
- **A repo that should skip paths** (generated or historic docs, vendored
  copies, fixtures) points default setup at a config file through the
  `github-codeql-config-file` repository property, instead of moving to an
  advanced workflow: start from
  [codeql-config.example.yml](assets/codeql-config.example.yml). Scanning
  thousands of old HTML pages is what made restraml's scan slow.
- **The same config file adds queries, query packs and `query-filters`**,
  which default setup keeps when it merges the file. **Advanced setup** (a
  workflow, as centrs, rosetta and restraml run) is only for what the file
  cannot do, such as a custom build step; SECURITY.md says why. GitHub lists
  the `security-and-quality` suite as advanced-only, and whether a config
  file's `queries:` brings it into default setup is untested.
- **Secret scanning replaces a secret linter** in the gate; a repo that
  handles credentials in files may add secretlint (centrs), whose
  recommended preset also covers the private keys and basic-auth URLs that
  generic patterns would.
- **Secret scanning does not see RouterOS credentials**: a WinBox address
  book (`.cdb`), a Dude database, a packet capture, or `admin:pw@host` in a
  log match no pattern. `.gitignore` keeps those file types out, with an
  explicit exception for synthetic fixtures (centrs
  `test/fixtures/winbox-cdb/`), and the pre-public audit catches the rest.

## Actions settings

- **The workflow token is read-only by default**, and "Allow GitHub Actions
  to create and approve pull requests" is off. Each workflow declares
  `permissions: contents: read` at the top and raises it per job (zizmor's
  `excessive-permissions` audit checks this). Every tikoci repo surveyed still
  defaults to write: declare `permissions:` in each workflow first, then
  switch the default.
- **Read-only does not limit reporting.** Artifacts, job summaries
  (`$GITHUB_STEP_SUMMARY`) and annotations (`::error::`, `::warning::`) need
  no token permission. A job raises only what its report writes: a PR comment
  needs `pull-requests: write`, a SARIF upload `security-events: write`, a
  check run `checks: write`, a pushed commit `contents: write`.
- **Require actions pinned to a full commit SHA** in the allowed-actions
  policy, once the workflows are pinned and Dependabot keeps them current
  (`tikoci-dependencies`). The policy turns a missed pin into a failed run,
  so every repo stays consistent without anyone checking. It has no
  exceptions: pin every action first, including those a repo floats by
  decision (quickchr's `actions/setup-node`, PR #223; centrs's tag refs,
  #266), or the next run of that workflow fails.
- **Fork pull requests** keep GitHub's default: a first-time contributor's
  workflows wait for approval. No `pull_request_target` workflow runs code
  from the PR.

## Alerts

- **Aim for zero open alerts on public repos**: code scanning, Dependabot
  and secret scanning. A private repo may hold a lower bar. On adoption,
  triage zizmor's findings before reporting them to code scanning (about 33
  in quickchr, #228), so the Security tab does not fill at once.
- **Fix real findings. Dismiss a false positive in the Security tab** (or the
  API) only after showing the value is not sensitive or the reported flow
  cannot happen, with that as the written reason; the dismissal is the audit
  record. In-code
  `codeql[...]` and `lgtm[...]` comments do not suppress an alert (centrs
  PR #233), and moving the code only changes its fingerprint. A
  `query-filters` entry in the CodeQL config file is the rule-wide
  alternative.
- **On an open PR, query alerts with `pr=<number>`**; without it the alert
  API shows only the default branch. An empty list counts only when every
  expected scan (each CodeQL language, zizmor) has a current analysis: on
  `refs/pull/<n>/head` at the PR's head commit (default setup), or on
  `refs/pull/<n>/merge` at a merge commit whose second parent is that head
  (advanced setup). One tool's current analysis says nothing about another's.

Commands, two common false positives and a real finding that looks like one
are in
[references/settings.md](references/settings.md).

## SECURITY.md

Every repo has one, from
[SECURITY.example.md](assets/SECURITY.example.md): report privately through
private vulnerability reporting, never a public issue; the scope; the
scanning that runs, and what does not run and why; the supported versions.
Keep the scanning list true: compare it with the check commands in
[references/settings.md](references/settings.md) whenever a setting changes
(quickchr's listed four enabled features as off).

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
