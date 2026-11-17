# Security Policy

## Reporting a vulnerability

Report privately through
[private vulnerability reporting](https://github.com/tikoci/tikoci.github.io/security/advisories/new).
Do **not** open a public issue for an undisclosed vulnerability. A maintainer
answers in the advisory.

## Scope

This repo builds the static site at <https://tikoci.dev> and publishes
public datasets and house skills. It stores no credentials and no private
data. The deploy workflow collects public GitHub metadata with the workflow
token (or an optional `TIKOCI_GITHUB_TOKEN` secret) and commits the snapshots
to `main`. Browser tools run client-side and fetch only public data; the
`/scripts/`, `/media/`, `/logos/` and `/images/` paths have external
consumers. Vulnerabilities in RouterOS itself go to MikroTik, not here.

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
| Code Quality, AI findings | not enabled: paid features |

Open alerts are fixed, or dismissed in the Security tab with a written reason.

## Supported versions

The site has no releases: only what is deployed from `main` is supported.
