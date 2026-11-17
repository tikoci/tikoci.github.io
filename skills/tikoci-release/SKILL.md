---
name: tikoci-release
description: "tikoci releases: the committed package.json version picks the npm channel (X.Y.Z-next ships X.Y.Z-next.N to next; X.Y.Z ships to latest and moves next with it); a person bumps the version and dates the CHANGELOG in a PR, CI never does; each user-visible change adds a CHANGELOG bullet in the same PR; a dispatch-only workflow on main lints, tests, runs the full bun audit, refuses a used version, publishes through npm trusted publishing and makes an immutable GitHub Release. Use when cutting a release or changing versions, the CHANGELOG or a release workflow."
---

# Releases

How tikoci repos version and ship what they publish: npm packages (CLIs,
libraries, MCP servers) first, then container images, VS Code extensions
and release assets. Workflow wiring that every workflow shares (pins,
permissions, the Bun pin) is in
[tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md).

## Versions and channels

- **SemVer.** While a package is 0.x, a breaking change bumps the minor.
- **Two npm channels: `latest` and `next`.** The committed version in
  package.json picks the channel, and nothing else does:
  - `X.Y.Z-next` while main works toward X.Y.Z. A release run publishes
    `X.Y.Z-next.<run number>` to `next`. The number is written into
    package.json inside the runner only, never committed.
  - `X.Y.Z`, committed by the stable-cut PR, publishes X.Y.Z to `latest`.
  - Any other shape fails the run: no `alpha`, `beta` or `rc`, and an
    unknown shape is never treated as `latest`.

  The prerelease tag in the version string is what npm, `npm outdated` and
  range resolvers read, so it is the one signal that cannot disagree with
  itself. A repo that keeps a channel input on its dispatch makes the run
  fail when the input and the version disagree.
- **`next` never lags `latest`.** There is no separately maintained preview
  line: a fix lands on main and ships in the next release. A stable release
  moves `next` onto itself, and a preview that would sort below `latest`
  (X.Y.Z-next.N after X.Y.Z shipped) is refused.
- **A preview needs no commit, tag or GitHub Release.** npm provenance
  records the commit. Cut one whenever main is worth trying. A preview that
  carries downloads (a database, an image) may also get a GitHub Release
  marked as a prerelease.
- **After a stable cut**, the first change sets package.json to the next
  `-next` version and opens its CHANGELOG section.
- **`engines.bun`** is raised only on purpose, with a CHANGELOG entry
  ([tikoci-toolchain](https://tikoci.dev/house/skills/tikoci-toolchain/SKILL.md)).

## CHANGELOG

- **Every change users or operators can notice adds one bullet in the same
  PR**: CLI commands, flags, output and exit codes, library exports, MCP tool
  shapes, error codes, environment variables, database schema, the install
  and update flow, `engines`. Refactors, tests and CI changes with no effect
  outside the repo get none; git history has them.
- **One section per stable version.** Work in progress goes under
  `## X.Y.Z — next`, matching package.json's `X.Y.Z-next`; the stable cut
  replaces `next` with the date (`## X.Y.Z — YYYY-MM-DD`). Previews get no
  section of their own. Bullets go under the Keep a Changelog categories:
  Added, Changed, Deprecated, Removed, Fixed, Security. Mark breaking
  changes **Breaking:**.
- **Plain headings, no reference-link footer.** A `## [X.Y.Z]` heading
  needs a link definition at the bottom that nothing checks, and a promotion
  that forgets it renders literal brackets. The GitHub Release links the
  commit instead.
- **What shipped, nothing else.** Reasons go in DESIGN.md and plans in
  issues
  ([tikoci-docs](https://tikoci.dev/house/skills/tikoci-docs/SKILL.md)).
- **The section is the release notes.** The release run reads it; a stable
  release with no dated, non-empty section fails, and so does a preview with
  no `next` section.

Start from [CHANGELOG.example.md](assets/CHANGELOG.example.md).

## The stable cut

1. A PR sets package.json to `X.Y.Z` and dates the heading. It goes through
   the usual review and CI.
2. Once that commit's checks are green on main, dispatch the release.

CI never writes package.json or CHANGELOG.md and never pushes to main.
A bump that a job computes blindly cannot reason across channels, and a
forgotten bump already fails loudly: the version is already published.

## The release workflow

Start from [release.example.yml](assets/release.example.yml) and
[release-plan.example.ts](assets/release-plan.example.ts).

- **Dispatched by a person, from main only.** A pushed tag triggers
  nothing. A `dry-run` input runs every check and publishes nothing. Runs
  share one concurrency group that never cancels a release halfway.
- **On the Bun pin**, with no `bun-version` override (tikoci-ci).
- **Gates, all on the commit that ships.** npm provenance attests the run's
  commit, so a green run on an older commit proves nothing about this one.
  - Lint and unit tests, run in the release.
  - The full `bun audit` with the repo's ignores, which stops on findings
    and on an audit that did not complete (tikoci-ci, "Dependency audit").
    Anything that ships is audited first.
  - The version is unused on npm, and for a stable release so are the tag
    and the GitHub Release.
  - The CHANGELOG section, as above.
  - A repo with device tests uses its own bar: quickchr requires the latest
    full `main` integration run to be green, centrs reuses the nightly
    sweep of that exact commit or runs one.
- **Decisions in a script with unit tests**: version, channel, tags, notes
  (`release-plan.ts`; centrs `scripts/release-plan.ts`, quickchr
  `scripts/release-prep.ts`). The workflow only runs it.
- **Publishing cannot be undone.** After `npm publish`, a re-dispatch stops
  at "already published", so each later step that fails prints the exact
  command that finishes the job. A bad release is fixed forward with a new
  version.
- **The workflow is the only publishing path.** README or CONTRIBUTING shows
  the dispatch commands; local scripts are for parity and debugging. A
  change to the release flow updates those docs in the same PR.

## Publishing to npm

- **Trusted publishing (OIDC), no stored token.** The package's trusted
  publisher on npmjs.com names the repo and the workflow file, and its
  "Allowed actions" include `npm publish`: one created since 2026-09-03
  allows only `npm stage publish` until you choose more. Only the
  publish job gets `id-token: write`, on a GitHub-hosted runner, and
  provenance is generated without `--provenance` for a public repo and
  package
  ([npm docs](https://docs.npmjs.com/trusted-publishers)). It needs npm
  11.5.1 or later, and moving a dist-tag over OIDC needs 11.21.0 and
  `npm dist-tag` in the same "Allowed actions". package.json's `repository.url`
  must name the repo. Once a trusted publish works, set the package to
  "Require two-factor authentication and disallow tokens" and revoke the
  old automation token.
- **npm publishes, not `bun publish`**, which has no OIDC. Keep `npm` as a
  devDependency so `bun.lock` pins it and the audit sees it; an ad-hoc
  `npm install -g` or `bunx npm` runs whatever is newest.
- **What ships**: a published package's `dependencies` hold only what runs
  ([tikoci-dependencies](https://tikoci.dev/house/skills/tikoci-dependencies/SKILL.md)).

No tikoci repo publishes this way yet (all use an `NPM_TOKEN` secret). The
first one to move records what it found in
[references/adoption.md](references/adoption.md).

## Tags and GitHub Releases

- **Stable releases only**: tag `vX.Y.Z` on the released commit, created by
  the workflow with the CHANGELOG section as notes. The job that creates it
  is the only one with `contents: write`.
- **Immutable releases on** (repository settings). A published release's
  tag cannot move or be deleted, its assets cannot change, and GitHub
  attests it (`gh release verify`)
  ([GitHub docs](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)).
  A release with assets is created as a draft, the assets uploaded, then
  published. A repo that repairs published assets in place (mikropkl
  `refresh-scripts.yaml`, rosetta's `republish_assets`) notes that under
  `## House exceptions` until a fix ships as a new release.
- **A tag ruleset on `refs/tags/v*`** restricting updates and deletions
  covers tags made outside a release. It leaves creation open, because the
  workflow tags with `GITHUB_TOKEN`, which cannot be on a bypass list.

## Other artifacts

- **Container images** come from the same dispatched workflow and gates,
  are smoke-tested as the final form before the image's channel tag moves
  onto them (rosetta `smoke-oci` before `promote-oci`; tikoci-ci), and carry a build provenance
  attestation pushed to the registry
  (`actions/attest-build-provenance` with `push-to-registry`).
- **VS Code extensions**: the Marketplace takes only `X.Y.Z`, with no
  prerelease tag, so the version still picks the channel by an odd minor for
  pre-release and an even one for release, as the
  [VS Code docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#pre-release-extensions)
  recommend.
- **Release assets** (images, archives) keep their names, so download URLs
  stay valid
  ([tikoci-docs](https://tikoci.dev/house/skills/tikoci-docs/SKILL.md)).

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule, and
[references/adoption.md](references/adoption.md) what changes in each repo.
Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
