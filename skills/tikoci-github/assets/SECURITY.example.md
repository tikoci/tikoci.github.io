# Security Policy

<!-- tikoci starting SECURITY.md. Save at the repo root, replace OWNER/REPO
and the placeholders. The State column shows the house defaults: fill it
from the read-back commands in tikoci-github's references/settings.md after
applying the settings, and compare again whenever a setting changes. Rows
about workflows (zizmor, bun audit) are checked against the repo's
workflows instead: the read-back does not see them. -->

## Reporting a vulnerability

Report privately through
[private vulnerability reporting](https://github.com/OWNER/REPO/security/advisories/new).
Do **not** open a public issue for an undisclosed vulnerability. A maintainer
answers in the advisory.

## Scope

<!-- What this project handles that matters for security: credentials it
reads or stores, devices it connects to, files it writes, what it runs.
Vulnerabilities in RouterOS itself go to MikroTik, not here. -->

## Code scanning

| Check | State |
| --- | --- |
| CodeQL, default setup (`javascript-typescript`, `actions`), Extended suite | enabled |
| zizmor workflow audit, reported to code scanning | enabled |
| Secret scanning with push protection | enabled |
| Private vulnerability reporting | enabled |
| Dependabot alerts and security updates | enabled for GitHub Actions; Bun packages are not supported, so `bun audit` runs on dependency changes, weekly and before each release |
| Dependabot version updates | GitHub Actions and Bun, weekly |
| Dependency review | not enabled: the dependency graph does not read `bun.lock` |
| Code Quality, AI findings | not enabled: paid features |

Open alerts are fixed, or dismissed in the Security tab with a written reason.

An alert in test or lab code (`test/`, and scripts run only by hand) that
flags what the code is for is dismissed as "used in tests" only when a guard
keeps the code to that purpose, with a comment saying what the code does and
naming the guard. Without a guard it is a real finding. It is a warning, not
a waiver: the same alert in `src/`, a shipped script or a workflow is fixed.

## Supported versions

Fixes go into `main` and the next release. Only the latest release (the npm
`latest` tag) is supported.
