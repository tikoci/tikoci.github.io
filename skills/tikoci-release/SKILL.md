---
name: tikoci-release
description: "tikoci releases: the committed package.json version picks the npm channel (X.Y.Z-next ships X.Y.Z-next.N to next; X.Y.Z ships to latest and moves next with it); a person bumps the version and dates the CHANGELOG in a PR, CI never does; each user-visible change adds a CHANGELOG bullet in the same PR; a dispatch-only workflow on main runs the check and the full bun audit, refuses a used version, smoke-tests the packed tarball and publishes it through npm trusted publishing from a main-only environment, then makes an immutable GitHub Release; a channel moves only onto what was tested on the commit that ships, images included. Use when cutting a release or changing versions, the CHANGELOG or a release workflow."
---

# Releases

How tikoci repos version and ship what they publish. npm packages (CLIs,
libraries, MCP servers) are covered in full; container images, VS Code
extensions and release assets follow the same invariants, with only
pointers so far. Workflow wiring that every workflow shares (pins,
permissions, the Bun pin) is in
[tikoci-ci](https://tikoci.dev/house/skills/tikoci-ci/SKILL.md).

## Any artifact

- **One publishing path, in CI.** README or CONTRIBUTING shows how to start
  it; local scripts are for parity and debugging, never a way to publish.
- **The version is committed, or derived from the run**, and CI never
  writes it back.
- **Every build has an identity that never moves**: an npm version, a
  `vX.Y.Z` tag, an image's `:sha-<commit>`.
- **A channel moves only onto what was tested on the commit that ships**:
  npm `latest` and `next`, an image's `:latest`. Provenance records which
  commit that was.
- **Who starts the run follows from what ships.** An npm `latest` release
  is a person's call: a stable-cut PR, then a dispatch. Previews to `next`
  are dispatched today; a scheduled run that publishes one when main has
  changed, under the same gates, is the direction. An image that mostly
  repackages another project's release may promote every passing `main`
  build from CI once its final-form test is robust (app-t3code).
- **A bad release is fixed forward** with a new version or build.

**Container images and RouterOS `/app`**: tikoci-ci, "Container apps", has
the test pipeline. The release side (the version of a repackaged upstream,
a CHANGELOG section per promoted build, whether an image gets GitHub
Releases, which provenance is the bar, the `/app` YAML as a contract, the
platform list) needs its own grounding in app-t3code, make.d and rosetta;
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21) tracks it.

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
- **Neither channel moves backwards, and `next` never lags `latest`.**
  There is no separately maintained preview line: a fix lands on main and
  ships in the next release. A stable release moves `next` onto itself
  when `next` is older. A preview that would sort below `latest` (X.Y.Z-next.N
  after X.Y.Z shipped) or below the current `next` is refused.
- **`latest` is a fresh publish, not a promoted preview.** quickchr used to
  publish X.Y.Z to `next`, test it, and move `latest` onto that same
  tarball. Here `latest` gets its own publish from the stable-cut commit,
  through the same gates and smoke test. One version string per channel is
  simpler to reason about; the cost is that nobody installed that exact
  tarball before it reached `latest`.
- **A preview needs no commit, tag or GitHub Release.** npm provenance
  records the commit. Cut one whenever main is worth trying. A preview that
  carries downloads (a database, an image) may also get a GitHub Release
  marked as a prerelease.
- **Who raises `X.Y.Z-next`**: after a stable cut, the first change sets
  the next patch and opens its CHANGELOG section. The PR that adds the first
  Added or **Breaking:** bullet raises it to the next minor or major and
  renames the heading in the same PR. `release-plan.ts check` in
  `bun run check` fails a PR whose version and heading disagree, offline.
- **`engines.bun`** is raised only on purpose, with a CHANGELOG entry
  ([tikoci-toolchain](https://tikoci.dev/house/skills/tikoci-toolchain/SKILL.md)).

## CHANGELOG

- **Every change users or operators can notice adds one bullet in the same
  PR**: CLI commands, flags, output and exit codes, library exports, MCP tool
  shapes, error codes, environment variables, database schema, the install
  and update flow, `engines`; for an image, its tags, platforms, the `/app`
  YAML, what it listens on and the privileges it needs (those also update
  SECURITY.md,
  [tikoci-github](https://tikoci.dev/house/skills/tikoci-github/SKILL.md)).
  Refactors, tests and CI changes with no effect outside the repo get none;
  git history has them.
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
  release whose dated section lists no changes fails, and so does a preview
  with no `next` section.

Start from [CHANGELOG.example.md](assets/CHANGELOG.example.md).

## The stable cut

1. A PR sets package.json to `X.Y.Z` and dates the heading. It goes through
   the usual review and CI.
2. Once that commit's checks are green on main, dispatch the release.

CI never writes package.json or CHANGELOG.md and never pushes to main.
A bump that a job computes blindly cannot reason across channels, and a
forgotten bump already fails loudly: the version is already published.

## The release workflow

Start from [release.example.yml](assets/release.example.yml),
[release-plan.example.ts](assets/release-plan.example.ts) and tikoci-ci's
`audit.example.ts`.

- **Dispatched from main only.** A pushed tag triggers nothing. A
  `dry-run` input runs every check, the pack and the smoke test, and
  publishes nothing. Runs share one concurrency group that never cancels a
  release halfway, and a `run-name` shows a dry run and the ref in the run
  list.
- **Keep the workflow file's name** once it has published: the trusted
  publisher names it, and the run number that numbers previews restarts on
  a rename.
- **On the Bun pin**, with no `bun-version` override (tikoci-ci).
- **Gates, all on the commit that ships.** npm provenance attests the run's
  commit, so a green run on an older commit proves nothing about this one.
  - `bun run check`, the repo's whole gate.
  - `bun run audit`, the same script and ignore list CI uses, which stops
    on findings and on an audit that did not complete (tikoci-ci,
    "Dependency audit"). Anything that ships is audited first.
  - The version is unused on npm and newer than both channels, and for a
    stable release the tag and the GitHub Release are unused too.
  - The CHANGELOG section, as above.
  - A device bar counts only for a run of this exact commit
    (`head_sha == GITHUB_SHA`); if none has finished, the release waits or
    fails. centrs reuses the nightly sweep of that commit or runs one.
    quickchr's PR freshness gate reads the newest *completed* run, which can
    be the commit before the version bump, so its release needs the stricter
    form. A dry run reports the device bar as it stands and waits for
    nothing.
- **Publish the tarball that was tested.** The plan job sets the version,
  builds, runs `npm pack`, installs the tarball into an empty project and
  uses it (its bin's `--version`, or importing its entry point): a file left
  out of `files` breaks every consumer, and only a new version fixes it. The
  publish job uploads that tarball and runs nothing else from the repo.
- **Decisions in a script with unit tests**: version, channel, tags, notes
  (`release-plan.ts`; centrs `scripts/release-plan.ts`, quickchr
  `scripts/release-prep.ts`). The workflow only runs it.
- **Publishing cannot be undone.** After `npm publish`, a re-dispatch stops
  at "already published". So the calls after it (moving a dist-tag,
  creating the GitHub Release) try a bounded few times, then print the
  exact command that finishes the job. That is outside tikoci-ci's retry
  rule, which is about test results, where a retry hides evidence: here
  the call either takes effect or the repair is printed. Retry only an
  idempotent call; before retrying one that is not, check whether the first
  attempt took effect (a release for this tag at this commit counts as
  done).

### A bad release

- `npm deprecate <name>@X.Y.Z "<what is wrong; use X.Y.Z+1>"` warns
  everyone who installs it.
- If it breaks every install, point `latest` back by hand
  (`npm dist-tag add <name>@<previous> latest`); the fix-forward release
  moves it on again.
- Never `npm unpublish`: the version number cannot be reused anyway, npm
  allows it only in narrow cases, and it breaks lockfiles that already
  resolved the version.

## Publishing to npm

- **Trusted publishing (OIDC), no stored token**, from a publish job in a
  GitHub environment limited to main. The trusted publisher names the
  repo, the workflow file and that environment. A main-only step in the
  workflow is not enough on its own: anyone who can push a branch can edit
  the file and dispatch it, and the OIDC token would still name the right
  repo and file. Only the publish job gets `id-token: write`, on a
  GitHub-hosted runner, and provenance comes without `--provenance` for a
  public repo and package. Setup, the npm versions it needs and the
  options on npmjs.com:
  [references/npm-trusted-publishing.md](references/npm-trusted-publishing.md).
- **npm publishes, not `bun publish`**, which has no OIDC. `npm` is a
  devDependency (at least 11.21.0, which moving a dist-tag over OIDC
  needs), so `bun.lock` pins it, the audit sees it and Dependabot updates
  it; an ad-hoc `npm install -g` or `bunx npm` runs whatever is newest.
- **What ships**: a published package's `dependencies` hold only what runs
  ([tikoci-dependencies](https://tikoci.dev/house/skills/tikoci-dependencies/SKILL.md)).

No tikoci repo publishes this way yet (all use an `NPM_TOKEN` secret). The
first one to move records what it found in
[references/adoption.md](references/adoption.md).

## Tags and GitHub Releases

- **Stable releases only**: tag `vX.Y.Z` on the released commit, created by
  the workflow with the CHANGELOG section as notes, after the npm publish.
  With immutable releases, a release made first and a publish that then
  fails leave a release that cannot be deleted for a version npm never
  got. The job that creates it is the only one with `contents: write`.
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

- **VS Code extensions**: the Marketplace takes only `X.Y.Z`, with no
  prerelease tag, so the version still picks the channel by an odd minor for
  pre-release and an even one for release, as the
  [VS Code docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#pre-release-extensions)
  recommend.
- **Release assets** (images, archives) keep their names across versions
  (tikoci-docs, "Durable URLs").

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule, and
[references/adoption.md](references/adoption.md) what changes in each repo.
Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
