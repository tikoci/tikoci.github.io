---
name: tikoci-dependencies
description: "tikoci dependencies: add one only when needed; pin every GitHub Action to a commit SHA with a # vX.Y.Z comment and let Dependabot update them; an action's pin is separate from the runtime version it installs. The lockfile pins packages. Sibling tikoci packages come from the registry (a range or the next tag), never file: paths (bun link locally); fix a sibling in its own repo, never fork or work around silently. Use when adding or updating a dependency or action, or answering a bot that asks for a pin."
---

# Dependencies

How tikoci repos take on and update dependencies: GitHub Actions, packages,
and the other tikoci tools. The Bun pin itself is in `tikoci-toolchain`.

## Adding one

- **Add a dependency only when it earns its place.** Bun's built-ins come
  first (`tikoci-toolchain`), then a few lines of code, then a package.
- **Commit `bun.lock` in the same change**, and install in CI with
  `bun install --frozen-lockfile`.

## GitHub Actions

- **Pin every remote action to a full commit SHA** with the release in a
  trailing comment, the form Dependabot writes:

  ```yaml
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  ```

  A tag like `@v7` can be moved after review, and workflows often hold write
  tokens and secrets, so an action change must arrive as a reviewable diff.
  The rule covers GitHub's own `actions/*` too: one rule is easier to follow
  and to check than a list of trusted owners. zizmor's `unpinned-uses` audit
  requires SHA pins for every action by default (since v1.20.0); CodeQL's
  `actions/unpinned-tag` query still treats some owners as trusted. A local
  action (`uses: ./.github/actions/<name>`) has no ref to pin; it is reviewed
  as part of the repo's own diff.
- **Pinning needs Dependabot.** Enable the `github-actions` ecosystem
  (weekly, grouped into one PR) before or with the pins; without it, pinned
  actions silently freeze. Start from
  [dependabot.example.yml](assets/dependabot.example.yml).
- **Why SHA pins, not tags.** centrs chose tags (centrs #266, its
  `SECURITY.md`): a tag picks up an action's security fix on the next run,
  while a SHA waits for a bot. The house takes the other side, because a tag
  can also be moved to malicious code with no diff to review (the tj-actions
  compromise did exactly that), and Dependabot proposes the fix within about
  two weeks (a weekly check plus the cooldown). An urgent fix is a manual
  bump, or a Dependabot security update where the repo enables them and an
  advisory covers the action. centrs and quickchr's floating
  `actions/setup-node` change on adoption.
- **A 7-day cooldown** on version updates, for both ecosystems, so a
  compromised release is usually found and pulled before Dependabot proposes
  it. A SHA pin protects against a moved tag, not a bad release. The cooldown
  does not delay security updates, and zizmor's `dependabot-cooldown` audit
  expects it.

- **An action's pin is not its runtime's version.** Pinning
  `actions/setup-node` or `oven-sh/setup-bun` fixes the action's code only.
  The Bun it installs comes from the `packageManager` pin; a Node version may
  float (`lts/*`) where that is the point of the job.

## Packages

- **The lockfile is the pin** for this repo's own installs. Ordinary semver
  ranges in package.json are fine, because `bun.lock` decides what CI installs
  and changes only in a reviewed diff.
- **A published package's ranges are a contract**, not a pin: consumers
  resolve them in their own tree and never see this repo's `bun.lock`. Keep
  the `dependencies` ranges of a published package to versions it is tested
  with.
- **Dependabot's `bun` ecosystem**, grouped, weekly and with the cooldown,
  keeps packages from rotting; a repo may skip it and update by hand on a
  schedule it states. It ignores `@types/bun`, which moves with the Bun pin
  (`tikoci-toolchain`).
- **`bun audit` is the vulnerability check.** Dependabot security updates do
  not support Bun, so version updates alone miss advisories. Run `bun audit`
  on a schedule or in CI, and fix findings with a reviewed lockfile upgrade.
- **Upgrade dev tools on purpose.** A new Biome, TypeScript or cspell version
  can bring new lint findings; land the upgrade with its fixes.

## Publishing

The publishing side (provenance, moving `next` along with `latest`, refusing
a version that is already published, the CHANGELOG) belongs to
`tikoci-release`. A published package's `dependencies` hold only what runs:
a build or type tool there installs into every consumer.

## Sibling tikoci packages

- **From the registry, never a `file:` path.** CI checks out one repo and
  installs with a frozen lockfile, so `file:../quickchr` fails outright. To
  try a local sibling, use `bun link` (in the sibling, then
  `bun link @tikoci/<name>` in the consumer) and never commit the link.
- **Follow siblings closely.** A consumer that should meet a sibling's
  breaking change early may track its `next` dist-tag (routeros-muse does);
  updating it promptly means the break shows up in the consumer's CI, not in a
  user's hands.
- **Fix a sibling in its own repo.** File or find the issue there, fix it in
  that repo's checkout, and consume the published release. Never fork a
  sibling or vendor a patched copy; a temporary workaround ships only with the
  upstream issue linked next to it.

## When a bot asks for a pin

Review bots and scanners regularly ask to pin something. Check it against
these rules before changing anything:

- **An action on a tag**: agree, and pin it to a SHA with Dependabot enabled.
- **The Bun version**: check that every `setup-bun` step reads
  `packageManager` (no inline `bun-version: latest`); then point to the pin.
- **A runtime version that floats on purpose** (a Node `lts/*` job, a sibling
  on `next`): reply with the reason from this skill or the repo's AGENTS.md,
  and resolve the thread. Do not pin it to make the comment go away.
- **A package range**: the lockfile pins it for this repo's installs; explain
  and resolve. A concern about what downstream consumers resolve is real for a
  published package; judge it on that.

## Sources

[references/sources.md](references/sources.md) lists the survey rows and
repo files behind each rule. Planning: Phase 3 of
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
