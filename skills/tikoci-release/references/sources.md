# Sources

The rules in [tikoci-release](../SKILL.md) come from the November 2026
survey of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).

| Rule | Rows | Notes |
| --- | --- | --- |
| SemVer; a 0.x breaking change bumps the minor | quickchr-016 | quickchr `CONTRIBUTING.md`, "Releasing". |
| The committed version picks the channel | rosetta-46, centrs-17 | Settles `release-channel` (maintainer, 2026-11-17). rosetta `npm-channel-source-of-truth.instructions.md`: no input may also select the channel; unknown shapes fail. centrs `ci-test-tiers-and-release-versioning.instructions.md`: the prerelease identifier selects the dist-tag, though a `channel` input picks the run. quickchr chooses the dist-tag at dispatch (`npm-tag`, `scripts/release-prep.ts`: "never inferred from the version") and publishes plain versions to `next`. |
| `X.Y.Z-next.<run number>`, written in the runner only | centrs-17, rosetta-42 | centrs (`0.1.9-next.23`); rosetta "Determine npm release channel" appends `$GITHUB_RUN_NUMBER` and never commits it. |
| `next` never lags `latest` | quickchr-114 | quickchr `release.yml` moves trailing dist-tags after publish and refuses a version older than `latest`; centrs moves `next` on a `latest` release; rosetta "Verify prerelease is ahead of latest and next". |
| A preview needs no commit, tag or Release | centrs-17 | centrs: "It needs no commit, PR, git tag or GitHub Release". rosetta makes a prerelease GitHub Release for previews, which carry its database assets. |
| Every user-visible change adds a bullet in the same PR | rosetta-26, quickchr-015 | Settled `changelog-unit`. What counts follows rosetta `changelog-discipline.instructions.md` and its `CHANGELOG.md` header. |
| One section per stable version, `## X.Y.Z — next` | centrs-18 | Settles `changelog-heading` (maintainer, 2026-11-17). centrs `CHANGELOG.md` and #485. quickchr and rosetta use `## [Unreleased]`. |
| No reference-link footer | rosetta-26 | rosetta: a promotion without its link definition renders literal brackets; "No automated check catches this". |
| A person bumps and dates; CI never writes or pushes | rosetta-42, quickchr-114 | rosetta `manual-version-bump.instructions.md` (the removed `bump-version` job); quickchr `release.yml`: "Release CI never updates package.json or CHANGELOG.md". lsp-routeros-ts commits a bump after publish today. |
| Dispatch-only from main, dry run, one concurrency group | quickchr-114, centrs-17 | quickchr `release.yml` (`concurrency: release`, `cancel-in-progress: false`); centrs `release.yaml`. |
| Gates on the commit that ships | quickchr-114, centrs-17 | centrs: "The release publishes the commit the dispatch ran on, never an older green one, because npm provenance attests `GITHUB_SHA`." quickchr's freshness gate (`scripts/ci-freshness.ts`); centrs reuses the nightly sweep of that commit. |
| Full `bun audit` before anything ships | - | Settled `audit-gating` (tikoci.github.io #33). No release workflow surveyed runs it today. |
| Decisions in a unit-tested script | centrs-17 | centrs `scripts/release-plan.ts`; quickchr `scripts/release-prep.ts`; rosetta `scripts/release-notes.ts`. `release-plan.example.ts` was run with 13 unit cases and against the live registry (2026-11-17). |
| Print the repair after an irreversible step | quickchr-114 | quickchr `release.yml`, "Move trailing dist-tags onto this version". |
| The workflow is the only publishing path | rosetta-49 | rosetta `release-via-ci.instructions.md`. |
| Trusted publishing | - | Settles `npm-auth` (maintainer, 2026-11-17). [npm docs](https://docs.npmjs.com/trusted-publishers), read 2026-11-17: npm 11.5.1 and Node 22.14.0; "Allowed actions": `npm stage publish` always, and a configuration created since 2026-09-03 allows direct `npm publish` only when chosen (Codex review of #37); dist-tags over OIDC need 11.21.0 and "Allow npm dist-tag", off by default; GitHub-hosted runners only; automatic provenance for public repos; `repository.url` must match. Node 26.13.1 bundles npm 11.20.0 (nodejs.org dist index). quickchr, centrs and rosetta use `NPM_TOKEN`; rosetta publishes without `--provenance`. |
| npm as a devDependency, not `npm install -g` | - | zizmor 1.32.0 `adhoc-packages` flags a global install; quickchr runs `bunx npm publish`. |
| Immutable releases, with exceptions | mikropkl-24 | Settles `immutable-releases` (maintainer, 2026-11-17). [GitHub docs](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases); GA 2025-10-28. mikropkl `refresh-scripts.yaml` uploads fixed assets with `--clobber`; rosetta `republish_assets`. |
| Tag ruleset for `v*` | - | From the #21 3c research. `GITHUB_TOKEN` cannot be a ruleset bypass actor (`protection-kind`). |
| Container images: smoke, then attest | - | rosetta `release.yml` (`smoke-oci`, then `promote-oci`); make.d `build.yaml` sets `provenance: false`. |
| VS Code: odd minor for pre-release | - | [VS Code docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#pre-release-extensions): "semver pre-release tags are not supported". lsp-routeros-ts uses the odd minor. |
| Durable asset names | mikropkl-24 | mikropkl `CLAUDE.md` on keeping release download URLs stable. |
