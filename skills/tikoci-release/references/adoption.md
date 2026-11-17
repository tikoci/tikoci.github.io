# Adoption notes

What each repo changes to follow [tikoci-release](../SKILL.md), as read on
2026-11-17. These are point-in-time notes for the adoption pass, not rules;
each repo tracks its own work.

## Every npm package (quickchr, centrs, rosetta)

- Move from the `NPM_TOKEN` secret to trusted publishing: add the trusted
  publisher on npmjs.com, check `repository.url`, add `npm` as a
  devDependency, give only the publish job `id-token: write`, then disallow
  tokens on the package and revoke the automation token.
- Run the full `bun audit` in the release workflow before publishing. None
  does today.
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
- The integration freshness gate stays as its device bar.

## centrs

- Closest to the house model already: `-next.<run number>` previews with no
  commit, one CHANGELOG section per stable version, the commit that ships
  is the commit checked, `next` moved with `latest`.
- The `channel` input picks the run today. It may stay as a check that
  fails when it disagrees with package.json, or go.

## rosetta

- The channel already comes from the version alone.
- `CHANGELOG.md` moves from `## [Unreleased]` with reference-link footers
  to `## X.Y.Z — next` headings.
- npm publishes without `--provenance` today; trusted publishing adds it.
- `republish_assets` replaces assets of a published release. Under
  immutable releases that becomes a new release, or a `## House exceptions`
  entry until it does.
- Container images on Docker Hub and GHCR gain a provenance attestation.

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

## make.d

- `build.yaml` pushes images with `provenance: false`. Add the build
  provenance attestation.
