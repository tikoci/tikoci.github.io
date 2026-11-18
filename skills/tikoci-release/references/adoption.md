# Adoption notes

What each repo changes to follow [tikoci-release](../SKILL.md), as read on
2026-11-17. These are point-in-time notes for the adoption pass, not rules;
each repo tracks its own work.

## Every npm package (quickchr, centrs, rosetta)

- Move from the `NPM_TOKEN` secret to trusted publishing, in the order of
  [npm-trusted-publishing.md](npm-trusted-publishing.md): the main-only
  `npm` environment, the trusted publisher naming it, `npm` as a
  devDependency, a first `next` preview, then tokens disallowed. Today a
  branch dispatch of an edited release workflow gets the org `NPM_TOKEN`, so
  the environment closes a live gap even before trusted publishing (centrs
  review of #37).
- Keep each release workflow's file name: the trusted publisher names it,
  and the run number restarts on a rename.
- Run `bun run audit` (tikoci-ci `audit.example.ts`) in the release
  workflow before publishing. None does today.
- Pack, smoke-test and publish the tarball (SKILL.md, "Publish the tarball
  that was tested"). None does today; centrs's dry run lists the files with
  `npm pack --dry-run`.
- Add `release-plan.ts check` (or the repo's equivalent) to `bun run check`.
- Turn on immutable releases and add the `v*` tag ruleset.

## quickchr

- The dispatch `npm-tag` input picks the dist-tag today, and plain
  versions go to `next` before a hand promotion. On adoption, main carries
  `X.Y.Z-next`, a release run of it publishes `X.Y.Z-next.N` to `next`, and
  only a plain version goes to `latest`. `scripts/release-prep.ts` changes
  with it.
- `CHANGELOG.md` moves from `## [Unreleased]` and `## [X.Y.Z] — date` to
  `## X.Y.Z — next` and `## X.Y.Z — date`.
- `bunx npm publish` runs an unpinned npm; the devDependency replaces it.
- The release reads the integration freshness gate for a run of the
  released commit (`head_sha == GITHUB_SHA`); the PR gate keeps its
  "latest completed run" rule.
- `prepare` creates the tag and GitHub Release before `npm publish`. Under
  immutable releases a publish that fails after that uses up the tag name
  (a deleted immutable release's tag name cannot be reused) for a version
  npm never got, so publish comes first.
- `next` releases are GitHub prereleases promoted by hand
  (`gh release edit vX.Y.Z --prerelease=false --latest`, after
  `npm dist-tag add … latest`); both go, with the `ref: v${VERSION}`
  checkout in the publish job.
- Update in the same PR: `ci.instructions.md` "Release Process", and the
  CHANGELOG preamble that says a release goes to `next` first and is
  promoted. `release-prep.ts`'s local roll-over writes `## [X.Y.Z] — date`;
  it moves to the new heading or goes, since a person dates the heading.
- `actions/setup-node@v7` floats by tag in both release jobs
  (`sha-pin-policy`).

## centrs

- Closest to the house model already: `-next.<run number>` previews with no
  commit, one CHANGELOG section per stable version, the commit that ships
  is the commit checked, `next` moved with `latest`.
- The `channel` input picks the run today. It may stay as a check that
  fails when it disagrees with package.json, or go; the README or
  CONTRIBUTING dispatch commands follow.
- The automatic patch bump goes: today, when package.json's plain version
  has shipped, a `next` run publishes the following patch, so a preview
  never waits for a bump commit. The house plan refuses it instead, because
  such a preview has no `## X.Y.Z — next` section to describe it.
- The publish job holds both `contents: write` and `id-token: write` and
  creates the GitHub Release; it splits into a publish job and a release
  job.
- The "Verify NPM_TOKEN reaches this runner" step goes, and no dry-run
  check replaces it (npm-trusted-publishing.md, "The first release").
- Keep `release.yaml` as the name, and its `run-name`. Action refs stay
  tags until centrs pins them (#266, `sha-pin-policy`), so the example's
  SHAs are not copied as they are.
- Update in the same PR: the release section of
  `ci-test-tiers-and-release-versioning.instructions.md` and the comment at
  the top of `release.yaml`.

## rosetta

- The channel already comes from the version alone.
- `CHANGELOG.md` moves from `## [Unreleased]` with reference-link footers
  to `## X.Y.Z — next` headings.
- npm publishes without `--provenance` today; trusted publishing adds it.
- `republish_assets` replaces assets of a published release. Under
  immutable releases that becomes a new release, or a `## House exceptions`
  entry until it does.
- Its container images (Docker Hub and GHCR) wait for the container pass
  tracked in #21.

## mikropkl

- `refresh-scripts.yaml` repairs published release assets in place, with a
  drift note in the release body. A `## House exceptions` entry, or fixes
  ship as new releases.

## lsp-routeros-ts and vscode-tikbook

- lsp-routeros-ts bumps all three package.json files and pushes the commit
  to main after publishing (`bump_type`). On adoption the next version is
  set in a PR.
- vscode-tikbook picks pre-release with a `releaseflags` input; the odd
  minor in the version replaces it.
- Both run `npx @vscode/vsce` and `npx ovsx` unpinned, with personal access
  tokens. Pin the tools as devDependencies.

## Container repos (app-t3code, make.d)

Their release side waits for the container pass tracked in #21. The review
of #37 noted what that pass starts from:

- app-t3code promotes every passing `main` build continuously
  (`:sha-<commit>`, an arm64 install test, a retag of the tested digest);
  its version is upstream's plus `-app.<run>`, with a CHANGELOG section per
  promoted build. It grants `packages: write` at the workflow level.
- make.d is dispatch-only, with its channel in `MAKED_CHANNEL`; it builds
  `arm/v6`, `arm/v7`, `arm64` and `amd64` with no CHR install test, and sets
  `provenance: false`. `packages: write` and `contents: write` sit at the
  workflow level.
