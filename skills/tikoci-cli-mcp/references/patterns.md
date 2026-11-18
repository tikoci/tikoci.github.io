# Patterns

Copyable code for the rules in [tikoci-cli-mcp](../SKILL.md), adapted from
quickchr, centrs and rosetta. `mytool` stands for the tool's name. Each
sample was run under Bun 1.4.4 with `bun test`, including probes that must
fail (an unregistered code, a new tool, a description with no arrow, an
arrow only in a comment, a description the test cannot find), and
checked with TypeScript 7.0.2 under the house `tsconfig.example.json` and
Biome 2.6.6 under the house `biome.example.jsonc` with
`--error-on-warnings`. The printed route was run through `sh`.

## Tips on stderr

From quickchr `src/cli/tips.ts`. A tip names a next command; the
environment variable silences it; it is not gated on a TTY.

```ts
/** True when tips are switched off for this run. */
export function tipsSuppressed(): boolean {
  const value = process.env.MYTOOL_NO_TIPS;
  return value !== undefined && value !== "" && value !== "0";
}

/** Print one tip line to stderr. No-op when tips are suppressed. */
export function tip(line: string): void {
  if (tipsSuppressed()) return;
  const dim = process.env.NO_COLOR ? (s: string) => s : (s: string) => `\x1b[2m${s}\x1b[0m`;
  console.error(dim(`tip: ${line}`));
}
```

## One error registry, and its test

The registry is the source of truth; the library throws one class that
carries a code from it. A source scan, as in centrs
`test/unit/error-catalog.test.ts`, fails on a code that was thrown but never
registered. The scan only sees literal codes: list any code built at run
time beside the test, as centrs does with `DYNAMIC_CODES`.

`src/errors.ts`:

```ts
export const errorCatalog = [
  { code: "BOOT_TIMEOUT", summary: "The guest did not finish booting in time." },
  { code: "MISSING_QEMU", summary: "QEMU is not installed or not on PATH." },
] as const;

export type ErrorCode = (typeof errorCatalog)[number]["code"];

export class MyToolError extends Error {
  readonly code: ErrorCode;
  /** One sentence: the next step the caller can take. */
  readonly fix: string | undefined;

  constructor(code: ErrorCode, message: string, fix?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MyToolError";
    this.code = code;
    this.fix = fix;
  }
}
```

Fields are declared rather than written as constructor parameter
properties, which the house tsconfig's `erasableSyntaxOnly` rejects.

`test/error-catalog.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";
import { errorCatalog } from "../src/errors.ts";

const SRC_DIR = join(import.meta.dir, "..", "src");
const registered = new Set<string>(errorCatalog.map((entry) => entry.code));

test("every thrown code is registered", () => {
  const thrown = /new MyToolError\(\s*"([A-Z0-9_]+)"/g;
  const missing: string[] = [];
  for (const rel of new Glob("**/*.ts").scanSync({ cwd: SRC_DIR })) {
    const text = readFileSync(join(SRC_DIR, rel), "utf8");
    for (const match of text.matchAll(thrown)) {
      if (match[1] && !registered.has(match[1])) missing.push(`${rel}: ${match[1]}`);
    }
  }
  expect(missing).toEqual([]);
});

test("no duplicate or vague codes", () => {
  expect(registered.size).toBe(errorCatalog.length);
  expect(registered.has("TIMEOUT")).toBe(false);
});
```

The `ErrorCode` type already rejects an unregistered literal at compile time;
the scan also catches a code cast from a string and keeps the test
meaningful in a repo that turns type checking off for some files.

## A frozen tool list

From rosetta `src/mcp-contract.test.ts`: adding, removing or renaming a tool
fails the test until the list, and the CHANGELOG, are updated on purpose.
The same file checks that every description carries a workflow arrow.

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MCP_SOURCE = readFileSync(join(import.meta.dir, "..", "src", "mcp.ts"), "utf8");

export const EXPECTED_TOOLS = ["mytool_search", "mytool_get_page"] as const;

describe("frozen tool registry", () => {
  test("registered tools match EXPECTED_TOOLS", () => {
    const found = Array.from(
      MCP_SOURCE.matchAll(/server\.registerTool\(\s*["']([^"']+)["']/g),
      (match) => match[1],
    );
    expect(found.sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  test("every description points to a next tool", () => {
    const blocks = MCP_SOURCE.split(/(?=server\.registerTool\()/).slice(1);
    const problems: string[] = [];
    for (const block of blocks) {
      const name = block.match(/server\.registerTool\(\s*["']([^"']+)["']/)?.[1] ?? "?";
      // The description is a string literal: "…", '…' or `…` with no ${}.
      const description = block.match(/description:\s*(["'`])([\s\S]*?)\1/)?.[2];
      if (description === undefined) problems.push(`${name}: description not found`);
      else if (!description.includes("→")) problems.push(`${name}: no → in description`);
    }
    expect(problems).toEqual([]);
  });
});
```

The regex reads the source, so it needs no database or MCP client and runs
in the unit tier. It tests the description itself, not the whole
registration: an arrow in a comment, a schema field or the handler must not
pass it, and a description it cannot find fails the test rather than being
skipped. A server that builds its tool list at run time, or composes
descriptions from variables, lists its tools through an in-process MCP
client instead.

## A command that pastes

From quickchr `src/lib/names.ts`. Every value interpolated into a printed
command goes through it; ordinary values stay unquoted so the line reads
like something a person typed.

```ts
export function shellQuote(value: string): string {
  if (value.length > 0 && /^[A-Za-z0-9._:=@,+/-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// One runnable command per line; the caveat is a comment in the line's language.
const route = `mytool set ${shellQuote(name)} --device-mode rose  # power-cycles the machine`;
```

A value starting with `-` is still read as a flag however it is quoted: that
is the tool's flag parser, not the shell, so such names are refused when
created.
