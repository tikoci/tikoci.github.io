# Suppressing a finding

Every linter in [tikoci-linting](../SKILL.md) has a way to silence one
finding. Use the narrowest one that works, in this order:

1. **Fix the code.** Most findings are right.
2. **One line**, with the rule named and the reason given.
3. **A range or one file**, when the same reason covers all of it (generated
   code, a fixture, a vendored copy).
4. **The config file**, when the rule is wrong for the whole repo. Turn it off
   there with a comment saying why, rather than suppressing it line by line.

A suppression always names the rule (never a bare "ignore everything") and
says why. A reviewer reads the reason; "fix later" is not one.

## TypeScript (tsc)

```typescript
// @ts-expect-error: bun-types 1.4 lacks Bun.foo; remove when it lands
Bun.foo();
```

- `// @ts-expect-error: reason` on the line before. It fails once the error
  goes away, so it cannot go stale. Prefer it to `// @ts-ignore`.
- `// @ts-nocheck` at the top of a file skips the whole file: generated code
  only.
- Config: a compiler option turned off in tsconfig.json, with a comment.

Full syntax: [TypeScript 3.9 release notes, `@ts-expect-error`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#-ts-expect-error-comments).

## Biome

```typescript
// biome-ignore lint/suspicious/noExplicitAny: the plugin API hands us untyped JSON
function load(raw: any) { ... }
```

- `// biome-ignore lint/<group>/<rule>: reason` on the line before. The
  reason after the colon is required.
- `// biome-ignore-start lint/<group>/<rule>: reason` and a matching
  `// biome-ignore-end lint/<group>/<rule>: reason` for a range.
- `// biome-ignore-all lint/<group>/<rule>: reason` at the top of a file.
- Config: the rule set to `"off"` in biome.jsonc, or an `overrides` entry for
  a path (test files, generated code).
- Biome reports a suppression that no longer matches anything, so it does not
  go stale.
- CSS takes the same comment as a block comment, on the line before the
  declaration, in a stylesheet or an HTML `<style>` block; `//` is not valid
  CSS there and breaks the parse:

```css
.monaco-editor .suggest-widget.message {
  /* biome-ignore lint/complexity/noImportantStyles: hides Monaco's empty-state box, which our provider replaces */
  display: none !important;
}
```

Full syntax: [Biome suppressions](https://biomejs.dev/analyzer/suppressions/).

## markdownlint

```markdown
<!-- markdownlint-disable-next-line MD033 -->
<img src="logo.svg" alt="tikoci" width="120">
```

- `<!-- markdownlint-disable-next-line MD033 -->` for one line.
- `<!-- markdownlint-disable MD033 -->` ... `<!-- markdownlint-enable MD033 -->`
  for a range.
- `<!-- markdownlint-disable-file MD033 -->` anywhere in a file.
- Config: the rule set to `false` under `config:` in
  `.markdownlint-cli2.yaml`, with a comment; a path under `ignores:`.
- No reason field: put it in the same comment or the line above.

Full syntax: [markdownlint inline configuration](https://github.com/DavidAnson/markdownlint#configuration).

## cspell

```typescript
// cspell:ignore mactelnet
const port = 20561; // mactelnet
```

- `cspell:ignore word1 word2` in a comment: those words, in this file only.
  Use it for a word that appears in one file and is not project vocabulary.
- `cspell:disable-next-line`, or `cspell:disable` ... `cspell:enable` for a
  range (a pasted hash, a captured log).
- In Markdown, the same directives go in an HTML comment:
  `<!-- cspell:ignore mactelnet -->`.
- Config: `ignorePaths` for generated files, `ignoreWords` for
  non-vocabulary. Real vocabulary goes in `project-words.txt`, and a typo is
  fixed, never ignored.

Full syntax: [cspell in-document settings](https://cspell.org/docs/Configuration/document-settings).

## shellcheck

```sh
# shellcheck disable=SC2086 # word splitting is intended: $FLAGS is a list
qemu-system-x86_64 $FLAGS
```

- `# shellcheck disable=SC2086` on the line before a command covers that
  command; a reason can follow after a second `#`.
- The same directive right after the shebang, before the first command,
  covers the whole file.
- Config: `.shellcheckrc` in the repo root (`disable=SC2086`), rarely needed.

Full syntax: [shellcheck directives](https://github.com/koalaman/shellcheck/wiki/Directive).

## actionlint

actionlint has no inline comment. Filter by message instead:

```yaml
# .github/actionlint.yaml
paths:
  .github/workflows/release.yaml:
    ignore:
      - 'shellcheck reported issue in this script: SC2086:.+'
```

- `paths.<glob>.ignore` in `.github/actionlint.yaml`: regular expressions
  matched against the error message, for one workflow or a glob.
- A shellcheck finding inside a `run:` script can also be fixed or silenced
  in the script itself with a `# shellcheck disable=` line.
- `-ignore '<regex>'` on the command line does the same for one run; prefer
  the config file so CI and local runs agree.

Full syntax: [actionlint configuration](https://github.com/rhysd/actionlint/blob/main/docs/config.md).

## zizmor

```yaml
container:
  image: ghcr.io/tikoci/example:latest # zizmor: ignore[unpinned-images] the nightly job tests the newest image on purpose
```

- `# zizmor: ignore[<audit>] reason` as a YAML comment anywhere in the
  finding's span (several audits separated by commas). After another
  comment it needs its own `#`: `# v7.0.1 # zizmor: ignore[artipacked] ...`
  works, `# v7.0.1 zizmor: ignore[artipacked] ...` is ignored silently
  (zizmor 1.32.0). Prefer the step's `- name:` line, away from the pin
  comment Dependabot updates.

  ```yaml
  - name: Checkout # zizmor: ignore[artipacked] the snapshot push needs these credentials; the artifact holds only ./dist
    uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  ```

- **Never suppress `template-injection`.** GitHub expands `${{ }}` before the
  shell runs, so quoting does not help. Pass the value through `env:` and
  quote the shell variable instead
  ([GitHub's guidance](https://docs.github.com/en/actions/concepts/security/script-injections)).
- Config: `zizmor.yml` with `rules.<audit>.ignore`, listing `file.yml`,
  `file.yml:line` or `file.yml:line:column`.

Full syntax: [zizmor, ignoring results](https://docs.zizmor.sh/usage/#ignoring-results).

## bun audit

<!-- cspell:ignore pmpm -->

```yaml
# GHSA-238p-pmpm-9mq7 (KaTeX, low): micromark-extension-math@3.1.0, its
# latest, still requires katex ^0.16. markdownlint loads KaTeX but never
# calls its renderer, the path the advisory needs. Drop the ignore once a
# fixed release lands.
run: bun audit --ignore=GHSA-238p-pmpm-9mq7
```

- `--ignore=<GHSA or id>`, repeatable, on the command in CI, with the comment
  beside it. There is no config file for it.
- The reason says why the advisory does not apply here (the vulnerable path
  is never called, not just "dev only"), and the removal condition names
  the release to wait for.
- Check the reason against the code: in tikoci.github.io#31 "KaTeX is never
  loaded" was false (an index re-export loads it), and "never invoked" was
  the true claim.

## hadolint

```dockerfile
# hadolint ignore=DL3008 # packages follow the base image's Debian release
RUN apt-get update && apt-get install -y --no-install-recommends curl
```

- `# hadolint ignore=DL3008` on the line before an instruction; a reason can
  follow after a second `#`.
- `# hadolint global ignore=DL3008` anywhere covers the whole Dockerfile.
- Config: `.hadolint.yaml` with an `ignored:` list.

Full syntax: [hadolint, ignoring rules](https://github.com/hadolint/hadolint#ignoring-rules).
