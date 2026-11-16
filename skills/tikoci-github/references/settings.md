# Settings: check and apply

<!-- cspell:ignore BFD -->

Commands for the settings in [tikoci-github](../SKILL.md), run from inside
the repo's checkout (`gh` fills in `{owner}` and `{repo}`). The read commands
change nothing; run them before and after a change. Changing settings needs
admin rights on the repo; the maintainer applies them or asks for them.

## Check

```sh
R='repos/{owner}/{repo}'
gh api "$R" --jq '{visibility, allow_squash_merge, allow_merge_commit, allow_rebase_merge,
  delete_branch_on_merge, squash_merge_commit_title, squash_merge_commit_message,
  security: .security_and_analysis}'
gh api "$R/private-vulnerability-reporting"                # {"enabled":true}
gh api -i "$R/vulnerability-alerts" 2>&1 | head -1         # 204: Dependabot alerts on; 404: off
gh api "$R/automated-security-fixes"                       # Dependabot security updates
gh api "$R/code-scanning/default-setup" --jq '{state, query_suite, languages}'
gh api "$R/actions/permissions/workflow"                   # want "read" and false
gh api "$R/actions/permissions"                            # sha_pinning_required
gh api "$R/branches/main/protection" --jq '{conversation_resolution: .required_conversation_resolution.enabled,
  required_checks: [.required_status_checks.contexts[]?], requires_pr: (.required_pull_request_reviews != null),
  force_push: .allow_force_pushes.enabled, deletion: .allow_deletions.enabled, enforce_admins: .enforce_admins.enabled}'
gh api "$R/rules/branches/main" --jq '.[] | {type, parameters}'   # Copilot review ruleset
gh label list --search skip-review
```

## Apply

The web UI has every setting: repo **Settings → General** (merge buttons),
**Branches** (classic protection), **Rules → Rulesets** (Copilot review),
**Actions → General** (workflow permissions, allowed actions), and the
security section (**Advanced Security**) for secret scanning, push
protection, private vulnerability reporting, Dependabot and code scanning.
The same through `gh`:

```sh
R='repos/{owner}/{repo}'
# Squash merge only; the PR title and description become the commit; delete merged branches.
gh repo edit --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false \
  --squash-merge-commit-message pr-title-description --delete-branch-on-merge
gh label create skip-review --color BFD4F2 --description "Skip CodeRabbit's automatic review"

# Security.
echo '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},
  "secret_scanning_push_protection":{"status":"enabled"}}}' | gh api -X PATCH "$R" --input -
gh api -X PUT "$R/private-vulnerability-reporting"
gh api -X PUT "$R/vulnerability-alerts"
gh api -X PUT "$R/automated-security-fixes"
gh api -X PATCH "$R/code-scanning/default-setup" -f state=configured -f query_suite=extended

# Actions: only after every workflow declares its own permissions: and pins its actions.
gh api -X PUT "$R/actions/permissions/workflow" -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false
gh api -X PUT "$R/actions/permissions" -F enabled=true -f allowed_actions=all -F sha_pinning_required=true
```

Branch protection and the Copilot ruleset are easiest in the UI, where the
required checks can be picked from recent runs. Then run the check commands
again.

## Alerts on a PR

```sh
N=123   # the PR number
# The analyses for the PR, and the commit and ref each one scanned.
gh api "repos/{owner}/{repo}/code-scanning/analyses?pr=$N" \
  --jq '.[] | "\(.id) \(.ref) \(.commit_sha[0:7]) \(.category)"'
gh api "repos/{owner}/{repo}/code-scanning/alerts?pr=$N" \
  --jq '.[] | "\(.number) \(.rule.id) \(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)"'
```

Without `pr` (or `ref`), the endpoints return the default branch only. Default
setup scans `refs/pull/<n>/head`, an advanced workflow usually
`refs/pull/<n>/merge`; `pr=` finds either. An empty alert list counts only when
an analysis for the PR's head commit exists. The taint path of a data-flow
alert is not in the alert API; download the analysis as SARIF
(`gh api -H "Accept: application/sarif+json" "repos/{owner}/{repo}/code-scanning/analyses/<id>"`,
with an id from the first command) and read `results[].codeFlows`.

Dismiss only with evidence, and put the evidence in the reason
(`false positive`, `won't fix`, `used in tests`):

```sh
gh api -X PATCH "repos/{owner}/{repo}/code-scanning/alerts/<number>" \
  -f state=dismissed -f dismissed_reason='false positive' \
  -f dismissed_comment='Logs the setting name, never its value.'
```

## Two common false positives

From centrs (`.github/instructions/github-security-quality.instructions.md`):

- **`js/clear-text-logging`** matches on names, not values: a boolean
  `passwordSet` counts as a password. It also over-taints through a shared
  helper, so a credential passed in one test can make an unrelated error path
  look tainted. A name match is also how the query finds real leaks (logging
  `config.password`), so a name match alone is no reason to dismiss. Read the
  SARIF flow, then dismiss only when the value is shown to be non-sensitive (a
  boolean flag) or the flow cannot happen, and say which. Do not rename a
  public field to dodge it.
- **`js/insecure-temporary-file`** fires on a literal `/tmp` path and on a file
  written without an explicit mode. Write under the test's sandbox directory
  (`TIKOCI_SANDBOX`) with `mode: 0o600`, which also fixes the real problem.
