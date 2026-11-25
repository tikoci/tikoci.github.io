# Test patterns

Copyable shapes for the rules in [tikoci-testing](../SKILL.md). Each one comes
from a tikoci repo where the plain version failed; the repo and issue are
named so the reason can be checked.

## Gate the integration tier

```ts
import { describe, expect, test } from "bun:test";

const LIVE = Boolean(process.env.QUICKCHR_INTEGRATION); // any non-empty value, as quickchr's suite

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
// quickchr test/integration/timeouts.ts, abridged
// test timeout > boots x boot budget + forensics + test body
export function bootTestTimeoutFor(arch: Arch, accel: string, opts: BootTestTimeoutOptions = {}): number {
  const boots = opts.boots ?? 1;
  const budget = defaultBootTimeout(arch, opts.withPackages, accel);
  return boots * budget + BOOT_FORENSICS_BUDGET_MS + TEST_BODY_HEADROOM_MS + (opts.extraMs ?? 0);
}
```

The budget takes everything the library's own budget depends on: the guest
architecture, the accelerator detected on this host and whether the boot
installs packages (which doubles it). Leave one out and the copy can again be
shorter than the boot it waits on. quickchr's 300 s literal ran under a 480 s
boot budget on same-arch TCG, so Bun killed the test before the failure report
was written (quickchr #106).

## Spawn children with an explicit env

```ts
import { hermeticEnv } from "./tikoci-paths.ts"; // copied from tikoci-home's scripts/

const env = hermeticEnv(sandbox); // allowlist, real HOME, TIKOCI_SANDBOX, the user's cache
const proc = Bun.spawn(["bun", "--no-env-file", "src/cli.ts", "list"], { env, stdout: "pipe", stderr: "pipe" });
```

Without `env`, a spawned process keeps the environment the parent started
with, not later `process.env` changes, and quickchr workers wrote into the
real data directory (quickchr #214 review). Build `env` from an allowlist
rather than spreading `process.env`, so an inherited override cannot leak in,
and pass `--no-env-file` so Bun does not load the checkout's `.env` and add
one back (centrs #666). Keep the real `HOME`: the allowlist carries the
variables that locate the shared cache, and a fake `HOME` would also move the
host scope where port claims live
([isolation contract](https://tikoci.dev/house/skills/tikoci-home/references/isolation.md)).
A tool that has not adopted tikoci-home builds the same allowlist by hand and
sets its own override instead of `TIKOCI_SANDBOX`.

Without tikoci-home, the allowlist is a few lines (adapted from tzsp-sniff
`test/unit/helpers.ts`, which also drops `HOME`):

```ts
export function childEnv(): Record<string, string> {
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", NO_COLOR: "1" };
  // The real home (HOME, USERPROFILE on Windows) locates the shared cache.
  // Windows sockets need SystemRoot; keep the temp directory variables too.
  for (const key of ["HOME", "USERPROFILE", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}
```

This is a minimal allowlist. Add the tool's own override (its data
directory) when the child reads state, and pass on a cache override the
parent has (`TIKOCI_CACHE_DIR`, or the child's own, such as
`QUICKCHR_CACHE_DIR`): without it the child falls back to the default cache
and downloads again.

## Remove what you own on a signal

```ts
// tzsp-sniff test/lab/mndp/lab.ts and test/chr/quickchr.ts, abridged
const owned = new Map<string, string>(); // name -> createdAt, only what this run created
let interrupted: "SIGINT" | "SIGTERM" | undefined;

function onSignal(signal: "SIGINT" | "SIGTERM"): void {
  if (interrupted) {
    for (const name of owned.keys()) console.error(`NOT REMOVED: ${name}`);
    process.exit(signal === "SIGINT" ? 130 : 143);
  }
  interrupted = signal;
  stop(); // abort new steps and kill running children; nothing is removed here
}
process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGTERM", () => onSignal("SIGTERM"));

// The main path, which the handled signal returns to:
const results = await Promise.allSettled(targets.map((t) => lab(t))); // every worker ends
const left = await cleanupAll(); // waits for in-flight creates, then removes `owned`
for (const name of left) console.error(`NOT REMOVED: ${name}`);
if (interrupted) process.exit(interrupted === "SIGINT" ? 130 : 143);
const failed = results.some((r) => r.status === "rejected" || !r.value); // lab() resolves false on failure
process.exit(failed || left.length > 0 ? 1 : 0);

async function cleanupAll(): Promise<string[]> {
  // A create still running cannot be stopped; wait for it to settle.
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
  const names = [...owned.keys()]; // creates that succeeded
  const removed = await Promise.all(names.map((name) => teardown(name))); // remove, then list to confirm
  const left = names.filter((_, i) => !removed[i]);
  // A create that threw may still have started QEMU (quickchr #298): look for its process.
  for (const name of failedCreates) {
    if (qemuFor(name).length > 0 && !left.includes(name)) left.push(name);
  }
  return left;
}
```

Ownership has two parts: `owned` holds the machines whose create succeeded,
and `failedCreates` the names whose create threw after it may have started a
VM. Cleanup reports both, so an interrupted run never exits without naming a
VM it started.

With default handling, Bun skips pending `finally` blocks when a signal ends
the process, so cleanup that lives only in `finally` leaks the VM on Ctrl-C.
A handler that only stops work returns control to the main path, which
drains in-flight work before it removes anything: removing first would race
a create that finishes after the cleanup pass. Track only what this run
created: a name collision must fail the create (quickchr `add` refuses an
existing name), never adopt someone else's machine. After removal, list the
machines again to confirm, and exit non-zero naming any left.

## Undo a module mock

```ts
import { afterAll, mock } from "bun:test";

// quickchr test/unit/snapshot-budgets.test.ts, abridged
const real = { ...(await import("../../src/lib/channels.ts")) };
afterAll(() => {
  mock.module("../../src/lib/channels.ts", () => real);
});

mock.module("../../src/lib/channels.ts", () => ({
  ...real,
  monitorCommand: async (_machineDir: string, command: string) => {
    calls.push(command);
    return command === "info snapshots" ? LISTING : "";
  },
}));
```

quickchr's own version replaces every other export with a stub that throws
when called, so a test that reaches an unexpected function fails by name
instead of running the real one.

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
// rosetta src/extract-docusaurus.test.ts, abridged
process.env.DB_PATH = ":memory:";

import { describe, expect, test } from "bun:test";

const { parsePage } = await import("./extract-docusaurus.ts"); // imports db.ts at the top
```

A static import of a module that reaches the database is hoisted above the
assignment and opens the real one.
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
// after quickchr test/integration/examples-smoke.test.ts
const proc = Bun.spawnSync(["sh", "examples/quickstart/quickstart.sh"], { env });
const out = proc.stdout.toString();
expect(proc.exitCode).toBe(0);
expect(out).toContain("starting examples-quickstart-"); // the script's first step
expect(out).toContain('"descriptorVersion": 1');        // printed by quickchr inspect, the last command
```

The last marker comes from the tool, not from the script's own `echo`, and from
the final command, so a script that stops early or never reaches quickchr
fails. A PowerShell parse error and a bare Python `return` past `sys.exit(rc)` each
shipped an example that exited 0 having done nothing (quickchr #102).
