# Sources

The rules in [tikoci-github](../SKILL.md) come from the November 2026 survey of
tikoci instruction files and skills, the live settings of six tikoci repos
(read with the commands in [settings.md](settings.md) on 2026-11-15), and
GitHub's documentation. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

## Rules

| Rule | Rows | Notes |
| --- | --- | --- |
| Repos in the org | user-05 | |
| Squash merge only; delete merged branches | site-06, quickchr-012 | Live: quickchr is squash-only with branch deletion; centrs, rosetta, routeros-skills and restraml allow all three merge methods. Settles `merge-method`. |
| `skip-review` label | centrs-07 | centrs label description, reused. |
| Audit before going public; synthetic fixtures | user-62 | |
| Classic protection with conversation resolution | centrs-42, rskills-01, quickchr-013 | Live: centrs, quickchr, rosetta, routeros-skills and this repo use classic protection with conversation resolution; only routeros-skills also requires a PR. restraml has no protection on `main` (its one ruleset includes no branches). |
| Required checks only without bot pushes | - | Required checks also apply to direct pushes ([about protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)); this repo's `deploy-pages.yaml` pushes a snapshot commit created after its checks ran (Codex review of PR #27). Side branches for bot data: quickchr `ci-data`, centrs QA branch (centrs/quickchr review of PR #27). |
| Gate jobs, not a bot check; a `main`-health check and admin merge | - | Live: centrs requires `CodeRabbit` and `Main health (nightly QA)`, quickchr `Integration freshness`; both `strict: false` (centrs/quickchr review of PR #27). |
| Classic, not a ruleset, while workflows push | site-14 | GitHub rulesets: conversation resolution is an option of "Require a pull request", and the bypass list takes roles, teams, GitHub Apps and Dependabot, not `GITHUB_TOKEN` ([available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)). |
| Free-plan features only; no review is a gate | - | Maintainer, PR #27 review (`paid-features`). The org is on GitHub Free. |
| Copilot optional, once, via a ruleset | centrs-41 | Live: centrs, quickchr and rosetta have the "Code Quality Copilot review for default branch" ruleset with `review_on_push: false` and `review_draft_pull_requests: false`. |
| Secret scanning and push protection | - | Settles `secret-scan` (maintainer, 2026-11-15). Repository push protection is off by default ([about push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection)). Live: on everywhere except quickchr. Generic patterns are `disabled` in this repo, centrs and quickchr; the docs name no plan requirement ([generic patterns](https://docs.github.com/en/code-security/secret-scanning/using-advanced-secret-scanning-and-push-protection-features/non-provider-patterns/enabling-secret-scanning-for-non-provider-patterns)). |
| RouterOS credentials are invisible to secret scanning | - | centrs `test/fixtures/winbox-cdb/` (synthetic CDB fixtures); centrs/quickchr review of PR #27. |
| Private vulnerability reporting | rskills-11 | Live: on in all six repos. |
| Dependabot alerts and security updates; no Bun | rskills-13, restraml-17 | Bun has version updates only, and the dependency graph does not list Bun ([supported ecosystems](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories)). Live: security updates off in routeros-skills and this repo. |
| CodeQL default setup, `actions` included, Extended suite | rskills-13, centrs-34, user-87 | Proposed in `codeql-setup`. Live: default setup in this repo, quickchr (Default suite) and routeros-skills (Extended); advanced `security-and-quality` workflows in centrs, rosetta and restraml. Default setup detected `c-cpp` in quickchr from a lab probe. `security-and-quality` exists only in advanced setup ([query suites](https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/codeql-query-suites)). Default setup takes a config file through the `github-codeql-config-file` property ([changelog](https://github.blog/changelog/2026-08-04-customize-code-scanning-default-setup-at-scale/), [docs](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/edit-default-setup)). |
| Code Quality not used | user-88 | GA 2026-07-20 for Team and Enterprise Cloud ([changelog](https://github.blog/changelog/2026-07-20-github-code-quality-is-now-generally-available)); rosetta `SECURITY.md`: its AI findings are not readable through `gh`. |
| Dependency review off | rskills-13, restraml-17 | centrs `SECURITY.md` leaves it off for lack of Bun lockfile support; rosetta, routeros-skills and restraml run it with `fail-on-severity: high`. Settles `dependency-review`. |
| Read-only workflow token; no PR approval by Actions | restraml-35 | Live: all six default to `write`, none lets Actions approve. Settles `workflow-permissions` (proposed). [Security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions). |
| SHA pinning required by policy | quickchr-111, rskills-13 | Policy added 2025-08-15 ([changelog](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/)). Live: off everywhere. quickchr floats `actions/setup-node` (PR #223) and centrs uses tag refs (#266); both pin first on adoption. Workflow lockfiles (`actions.lock`, public preview since 2026-10-14) may replace inline SHAs later. |
| Fork PR approval | - | GitHub's default ([org Actions settings](https://docs.github.com/en/organizations/managing-organization-settings/disabling-or-limiting-github-actions-for-your-organization)). |
| Zero open alerts; dismiss with a reason | centrs-34, user-64, user-65, user-87 | Live: centrs 1 open, quickchr 1 open (a real finding); quickchr has about 33 zizmor findings not yet triaged (#228). |
| A current analysis per expected scan | - | CodeRabbit review of PR #27; the analyses API reports `tool` and `category`. |
| In-code suppressions do not work | centrs-36 | centrs PR #233 (CodeQL 2.26.2). |
| Alerts by `pr=`; SARIF code flows | centrs-36 | centrs queries `ref=refs/pull/<n>/merge`, which fits its advanced workflow; default setup scans `refs/pull/<n>/head` (Codex review of PR #27, checked on this PR). |
| Two false positives, and a real finding | centrs-37 | centrs `github-security-quality.instructions.md`; the real one is quickchr's (centrs/quickchr review of PR #27). |
| SECURITY.md shape | rskills-11, rskills-13, centrs-34 | All five surveyed `SECURITY.md` files use Reporting, Scope, Code scanning, Supported versions. Absorbs the user-level `tikoci-security-md` skill. quickchr's lists four enabled features as off. |
| Token order | site-14, rosetta-37, user-76 | Settles `github-token-order`. |
| One API helper | rosetta-37 | rosetta `src/github.ts` (`fetchGitHub()`, `githubApiHeaders()`); `fetch-helper` in the conflicts table. |

Not taken here: user-89 (running the CodeQL code-quality suite locally)
stays with the operator's tools. rosetta's `copilot-gate.yml`, which fails a
check while Copilot's review is pending, is a repo choice.
