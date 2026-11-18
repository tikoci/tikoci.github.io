# Patterns

Copyable code for the rules in [tikoci-cli-mcp](../SKILL.md), adapted from
quickchr, centrs and rosetta. `mytool` stands for the tool's name. Each
sample was run under Bun 1.4.4 with `bun test` (the MCP one with
`@modelcontextprotocol/sdk` 1.32.2), including probes that must fail (an
unregistered code in each quote style or as a cast `family/slug` literal,
a new, renamed or commented-out tool, a flipped
annotation, a description with no arrow, one composed from variables, an
arrow only in a comment, a schema field or a `${}` interpolation, a
description the source scan cannot find), and
checked with TypeScript 7.0.2 under the house `tsconfig.example.json` and
Biome 2.6.6 under the house `biome.example.jsonc` with
`--error-on-warnings`. The printed route was run through `sh`, and the
tip checked for escapes with stderr redirected.

## Tips on stderr

From quickchr `src/cli/tips.ts`. A tip names a next command; the
environment variable silences it; it is not gated on a TTY, though its
color is: no escapes unless stderr is a terminal and `NO_COLOR` is unset.

```ts
/** True when tips are switched off for this run. */
export function tipsSuppressed(): boolean {
  const value = process.env.MYTOOL_NO_TIPS;
  return value !== undefined && value !== "" && value !== "0";
}

/** Print one tip line to stderr. No-op when tips are suppressed. */
export function tip(line: string): void {
  if (tipsSuppressed()) return;
  // Color only on a terminal: tips go to stderr, so that is the stream to check.
  const color = process.stderr.isTTY && !process.env.NO_COLOR;
  const dim = color ? (s: string) => `\x1b[2m${s}\x1b[0m` : (s: string) => s;
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
  // Any literal code, UPPER_SNAKE or family/slug, cast or not.
  const thrown = /new MyToolError\(\s*(["'`])([^"'`$\s]+)\1/g;
  const missing: string[] = [];
  for (const rel of new Glob("**/*.ts").scanSync({ cwd: SRC_DIR })) {
    const text = readFileSync(join(SRC_DIR, rel), "utf8");
    for (const match of text.matchAll(thrown)) {
      const code = match[2];
      if (code && !registered.has(code)) missing.push(`${rel}: ${code}`);
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

## A frozen tool surface

Freeze what the server serves, not what its source says. The test connects
a real MCP client to the server in process (the SDK's `InMemoryTransport`,
as in centrs `test/unit/mcp-server-result.test.ts`) and compares each
tool's name and annotations with a list kept in the test. Adding, removing
or renaming a tool, or flipping `readOnlyHint`, fails it until the list,
and the CHANGELOG, are updated on purpose. Descriptions built from
variables are checked as a host sees them. The server module exports a
`createServer()` that builds the server without connecting a transport.

`test/mcp-surface.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";

// What a host sees. A change here is a surface change: update it on purpose,
// with a CHANGELOG entry when a tool is added, removed or renamed.
const EXPECTED = {
  mytool_get_page: { readOnlyHint: true },
  mytool_search: { readOnlyHint: true },
};

const server = createServer();
const client = new Client({ name: "surface-test", version: "0.0.0" });

beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
});

afterAll(async () => {
  await client.close();
  await server.close();
});

describe("MCP surface", () => {
  test("tools and annotations match the frozen list", async () => {
    const { tools } = await client.listTools();
    const served = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations ?? {}]));
    expect(served).toEqual(EXPECTED);
  });

  test("every description points to a next tool", async () => {
    const { tools } = await client.listTools();
    const missing = tools.filter((tool) => !tool.description?.includes("→")).map((tool) => tool.name);
    expect(missing).toEqual([]);
  });
});
```

### Without an SDK client

From rosetta `src/mcp-contract.test.ts`, for a server the test cannot
connect to in process: read the tool names and descriptions from the
source.

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MCP_SOURCE = readFileSync(join(import.meta.dir, "..", "src", "mcp.ts"), "utf8");

export const EXPECTED_TOOLS = ["mytool_search", "mytool_get_page"] as const;

describe("frozen tool registry", () => {
  test("registered tools match EXPECTED_TOOLS", () => {
    const found = Array.from(
      // A registration starts its line, so a commented-out one is not counted.
      MCP_SOURCE.matchAll(/^\s*server\.registerTool\(\s*["']([^"']+)["']/gm),
      (match) => match[1],
    );
    expect(found.sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  test("every description points to a next tool", () => {
    const blocks = MCP_SOURCE.split(/^(?=\s*server\.registerTool\()/m).slice(1);
    const problems: string[] = [];
    for (const block of blocks) {
      const name = block.match(/server\.registerTool\(\s*["']([^"']+)["']/)?.[1] ?? "?";
      // Supported format: the description is the config object's first
      // property, a string literal ("…", '…' or `…` with no ${}). Anchoring
      // it there keeps a schema field's description from standing in for it.
      const description = block.match(
        /^\s*server\.registerTool\(\s*["'][^"']+["']\s*,\s*\{\s*description:\s*(["'`])([\s\S]*?)\1/,
      )?.[2];
      if (description === undefined) problems.push(`${name}: description not found`);
      else if (description.includes("${")) problems.push(`${name}: composed description; use the in-process client`);
      else if (!description.includes("→")) problems.push(`${name}: no → in description`);
    }
    expect(problems).toEqual([]);
  });
});
```

The regex reads the source, so it needs no database or MCP client and runs
in the unit tier. It accepts one registration format, a call that starts
its line with the description as the config's first property, and fails
anything else: a description it cannot find, an arrow in a comment, a
schema field's description standing in for a missing tool description, a
template with `${}`. A line-commented registration is not counted; one
inside a `/* */` block still is. It cannot see a tool list built at run
time or the annotations; the in-process client above can.

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
