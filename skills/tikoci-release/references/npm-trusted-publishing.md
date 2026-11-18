# npm trusted publishing

Setup for the publish job in [release.example.yml](../assets/release.example.yml),
as npm and GitHub documented it on 2026-11-17. No tikoci repo has published
this way yet, so the first one confirms each point and corrects this file.
These details go stale faster than the rules in [SKILL.md](../SKILL.md).

## Once per repo

1. **A GitHub environment named `npm`** (Settings → Environments), with
   deployment branches limited to `main`. A job that names it from another
   branch fails before it starts. A solo maintainer can later add a required
   reviewer there with no workflow change.
2. **`npm` as a devDependency**: `bun add --dev npm`, 12.2.0 or later (or
   11.21.0 on the 11.x line). Trusted publishing needs npm 11.5.1, but
   moving a dist-tag over OIDC needs 11.21.0 on 11.x and 12.2.0 on 12.x;
   12.0 and 12.1 publish through OIDC but cannot move `next`. Node's
   bundled npm can be older (Node 26.13.1 ships 11.20.0). npm 12 prints
   `npm pack --json` as an object keyed by package name, where npm 11
   printed an array; the workflow reads either. npm 12 needs Node
   `^22.22.2 || ^24.15.0 || >=26`, which `actions/setup-node` with `lts/*`
   meets.
3. **`repository.url` in package.json** names this repo exactly; npm
   documents that a mismatch can fail the publish.
4. **Immutable releases** on, and the `v*` tag ruleset (SKILL.md, "Tags and
   GitHub Releases").

## Once per package, on npmjs.com

1. **Add a trusted publisher** (package Settings → Trusted publishers):
   GitHub Actions, this owner and repo, the workflow file name
   (`release.yml`), and the environment `npm`.
2. **"Allowed actions"**: `npm stage publish` is always allowed. Choose
   `npm publish` as well, since a configuration created since 2026-09-03
   allows only staged publishing until you do, and **Allow npm dist-tag**,
   which is off by default and is needed to move `next` onto a stable
   release.
3. **A new configuration expires** if no publish succeeds through it within
   2 days, so add it shortly before the first release.

## The first release

- **Make it a `next` preview.** It proves the OIDC identity, the
  environment and the publish permission. Its only effect is a numbered
  preview with `next` pointing at it. A failed run can still have published,
  if the registry accepted the version before the response failed, so check
  `npm view <name> dist-tags` before trying again. The workflow moves no
  other dist-tag for a preview, so the dist-tag permission is first used at
  the first stable cut: check "Allowed actions" by hand before that. No dry
  run can check any of this; only a real publish does.
- **Confirm provenance** on the published version's npm page: it should
  name this repo, the workflow and the commit. Publishing a packed tarball
  (`npm publish <file>.tgz`) rather than the directory is untested here.
- **Then disallow tokens**: Settings → Publishing access → "Require
  two-factor authentication and disallow tokens", and revoke the old
  automation token and the `NPM_TOKEN` secret. A manual repair from a shell
  (a dist-tag the workflow could not move) then needs `--otp`.

## Limits

- GitHub-hosted runners only; self-hosted runners cannot use it.
- No provenance for a package published from a private repository.
- `npm whoami` says nothing about trusted-publishing permissions.

Sources: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers),
[GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
and the review of [tikoci.github.io#37](https://github.com/tikoci/tikoci.github.io/pull/37)
(quickchr and centrs agents, Codex).
