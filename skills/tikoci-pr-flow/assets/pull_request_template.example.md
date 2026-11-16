<!-- markdownlint-disable-file MD041 -->
<!-- MD041 off: a PR body has no title heading; the PR title is its title. -->

## What and why

<!-- The change and the reason, in a few sentences. The PR title becomes the
squash commit subject: short and imperative. See tikoci-pr-flow. -->

Closes #

<!-- Or "Part of #N". Open a follow-up issue for each part left undone and
link it here. -->

## Verification

- [ ] `bun run check`
- [ ] Integration run against a router or CHR, if the change touches one:
      the local command, or the dispatched run's URL

<!-- The commands run and what they showed. Name each check not run, and
why (no CHR, no Windows host, a tool not installed). A repo that keeps a
commit trailer (centrs Session:) puts it at the end of this description,
which becomes the squash commit's body. -->

## Review

<!-- Which agent cross-reviewed the draft, or why none ran. Decisions that
deserve the maintainer's look. Docs, a nit or a version bump that needs no
hosted review: add the skip-review label before marking ready. -->
