# Security Policy

<!-- tikoci starting SECURITY.md. Save at the repo root, replace OWNER/REPO
and the placeholders, and keep the scanning table true when a setting
changes. See tikoci-github. -->

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
| Dependabot alerts and security updates | enabled for GitHub Actions; Bun packages are not supported, so `bun audit` runs in CI |
| Dependabot version updates | GitHub Actions and Bun, weekly |
| Dependency review | not enabled: the dependency graph does not read `bun.lock` |

Open alerts are fixed, or dismissed in the Security tab with a written reason.

## Supported versions

Fixes go into `main` and the next release. Only the latest release (the npm
`latest` tag) is supported.
