# Changelog

User-visible changes to `@tikoci/example`, one section per stable version.
Work in progress goes under `## X.Y.Z — next`, the version package.json is
heading to (`X.Y.Z-next`); preview builds (`X.Y.Z-next.N` on npm `next`) get
no section of their own. The stable release replaces `next` with the date.

Each change that users or operators can notice adds one bullet here, in the
same PR as the change, under Added, Changed, Deprecated, Removed, Fixed or
Security. Refactors, tests and CI changes with no effect outside the repo get
none; git history has them. Reasons go in DESIGN.md, plans in issues.

## 0.3.0 — next

### Added

- `example list --json` prints one object per item (#42).

### Fixed

- `example get` exits 2, not 0, when the item does not exist (#40).

## 0.2.0 — 2026-11-03

### Changed

- **Breaking:** `example get` takes the item name as an argument; `--name`
  is gone (#35).
- The minimum Bun is now 1.4.4 (`engines.bun`).

## 0.1.0 — 2026-10-12

### Added

- First release on npm.
