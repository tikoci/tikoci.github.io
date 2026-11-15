# Test patterns

Copyable shapes for the rules in [tikoci-testing](../SKILL.md). Each one comes
from a tikoci repo where the plain version failed; the repo and issue are
named so the reason can be checked.

## Gate the integration tier

```ts
import { describe, expect, test } from "bun:test";

const LIVE = process.env.QUICKCHR_INTEGRATION === "1";

describe.skipIf(!LIVE)("start and stop", () => {
  test("boots and answers REST", async () => {
    // boot through quickchr, assert through the router, remove in finally
  }, bootTestTimeout());
});
```

The flag is the only skip. A skip added later to hide a failure is masking
([tikoci-grounding](https://tikoci.dev/house/skills/tikoci-grounding/SKILL.md)).

## Clean up a live router in `finally`

```ts
import { QuickCHR } from "@tikoci/quickchr";

test("package appears as active", async () => {
  const chr = await QuickCHR.start({ name: `test-pkg-${crypto.randomUUID().slice(0, 8)}`, background: true });
  try {
    // exercise the feature, then read the result back from the router
  } finally {
    await chr.remove();
  }
}, bootTestTimeout());
```

The fixed `test-` prefix lets a later run reap machines a crashed run left
behind. Check the quickchr version you depend on for the exact option names.

## Derive timeouts from the operation's budget

```ts
// test/integration/timeouts.ts
// test timeout > boots x boot budget + evidence capture + test body
export function bootTestTimeout({ boots = 1, bodyMs = 60_000 } = {}): number {
  return boots * defaultBootTimeout() + EVIDENCE_BUDGET_MS + bodyMs;
}
```

quickchr's 300 s literal ran under a 480 s boot budget on same-arch TCG, so
Bun killed the test before the failure report was written (quickchr #106).

## Spawn children with an explicit env

```ts
const env = { PATH: process.env.PATH ?? "", HOME: sandboxHome, TIKOCI_SANDBOX: sandbox };
const proc = Bun.spawn(["bun", "src/cli.ts", "list"], { env, stdout: "pipe", stderr: "pipe" });
```

Without `env`, a spawned process keeps the environment the parent started
with, not later `process.env` changes, and quickchr workers wrote into the
real data directory (quickchr #214 review). Build `env` from an allowlist
rather than spreading `process.env`, so an inherited override cannot leak in
([isolation contract](https://tikoci.dev/house/skills/tikoci-home/references/isolation.md)).

## Undo a module mock

```ts
import { afterAll, mock } from "bun:test";

const real = { ...(await import("../../src/lib/channels.ts")) };
mock.module("../../src/lib/channels.ts", () => ({ ...real, resolveChannel: () => "7.20.8" }));
afterAll(() => {
  mock.module("../../src/lib/channels.ts", () => real);
});
```

`mock.restore()` left 28 failures in other files of the same run on Bun 1.4.4
(quickchr #224). The other fix is to run the mocked test in a worker process.

## Mock HTTP at the layer the code uses

```ts
import { createServer } from "node:http";

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end("[]");
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as { port: number };
// pass port to the code under test; close the server in afterEach
```

Code on `node:http` bypasses `globalThis.fetch`, so a fetch mock tests nothing
there.

## Import a module with side effects safely

```ts
process.env.DB_PATH = ":memory:";
const { extractAll } = await import("../src/extract-all.ts");
```

A static import is hoisted above the assignment and opens the real database.
rosetta saw it as an order-dependent CI flake (rosetta #98) and closed it with
a test that scans test files for static imports that reach the database
module.

## Swap env vars on Windows

```ts
for (const name of ["HTTPS_PROXY", "https_proxy"]) delete process.env[name];
process.env.HTTPS_PROXY = "http://127.0.0.1:3128";
```

Setting one spelling and deleting the other in one loop deletes what was just
set, because Windows treats them as one variable (quickchr #226).

## Assert output markers, not exit codes

```ts
const proc = Bun.spawnSync(["sh", "examples/quickstart/quickstart.sh"], { env });
const out = proc.stdout.toString();
expect(proc.exitCode).toBe(0);
expect(out).toContain("RouterOS");           // printed by the tool, not by echo
expect(out).toContain("quickstart: done");   // the last line of the script
```

A PowerShell parse error and a bare Python `return` past `sys.exit(rc)` each
shipped an example that exited 0 having done nothing (quickchr #102).
