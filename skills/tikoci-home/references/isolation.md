# Sandboxes and test isolation

A test or CI run of a tikoci tool must not read or change the developer's own
setup, and must not download gigabytes the developer already has. Under
[tikoci-home](../SKILL.md) that is a sandbox: `TIKOCI_SANDBOX=<dir>` makes the
run a disposable guest of the user's setup. It is separate from
`TIKOCI_HOME`, which only relocates the user's own root, so a user who sets
`TIKOCI_HOME` in a shell profile keeps workspaces and the keychain.

## What a sandbox guarantees

With `TIKOCI_SANDBOX` set to a fresh directory, the tool:

1. reads and writes config, secrets and state only under `<sandbox>/<tool>/`,
   and runtime files under `<sandbox>/run/<tool>/`;
2. reads the user root only for host resource claims (which ports the owner's
   machines hold, stopped ones included), read-only;
3. discovers no workspace, unless `TIKOCI_WORKSPACE` names one;
4. reads no legacy path (`~/.config/...`, `~/.local/share/...`, `~/.rosetta`);
5. does not touch the OS keychain (`Bun.secrets`, Keychain, libsecret,
   Credential Manager), so no prompt can hang a run;
6. reads from and adds to the shared cache, and never evicts from it or
   applies its own size policy to it;
7. never creates, restarts or removes a host service, and never runs sudo;
8. writes no file that belongs to another program (`~/.ssh/known_hosts`,
   shell rc files).

`HOME` stays as it is; tests should not need to change it. For in-process
calls, a test can instead pass an env with no `HOME` and no `TIKOCI_HOME`:
the resolver then finds no user root at all, rather than falling back to
`os.homedir()` and the developer's real files
([centrs#654](https://github.com/tikoci/centrs/issues/654)).

## What the harness does

The tool cannot tell an inherited variable from one the test set, and
`CENTRS_CDB_FILE` or `QUICKCHR_DATA_DIR` exported in a developer's shell would
otherwise win. So the harness:

- builds each child's environment from an allowlist (`PATH`, `HOME`, temp and
  locale variables, and `TIKOCI_HOME` and `TIKOCI_CACHE_DIR`, which describe
  the user's setup), never by copying `process.env`;
- sets `TIKOCI_SANDBOX` to a new directory per run or per file, and
  `TIKOCI_CACHE_DIR` to the cache the developer already has;
- adds back only the tool variables the test means to set;
- runs `bun` children with `--no-env-file`, so a checkout's `.env` cannot add
  variables (`bun <file>` ignores a shebang that says so;
  [centrs#666](https://github.com/tikoci/centrs/issues/666));
- calls libraries with that env as an argument rather than mutating
  `process.env`, and expects them to pass it on to other tools' libraries.

[`hermeticEnv()`](../scripts/tikoci-paths.ts) in the reference resolver does
the first three:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hermeticEnv } from "./tikoci-paths.ts";

// macOS tmpdir() is about 50 bytes; a short base keeps socket paths in bounds.
const base = process.platform === "darwin" ? "/tmp" : tmpdir();
const sandbox = mkdtempSync(join(base, "tikoci-"));
const proc = Bun.spawn(["bun", "--no-env-file", "src/cli.ts", "devices", "list"], {
    env: hermeticEnv(sandbox),
});
```

## CI

A random sandbox per run leaves nothing for upload steps to find. CI uses a
fixed path, such as `$RUNNER_TEMP/tikoci-sandbox`, and the upload step names
the files under it (quickchr's `failures/`, `boot-log.ndjson` and
`machine.json`). A cache restored by `actions/cache` excludes lease
directories, which a recycled pid could otherwise keep alive.

## Socket paths

A sandbox under the system temp directory can be long (macOS
`/var/folders/...`). The tool checks socket lengths at creation (103 bytes)
and names the variable to change in the error. Where sockets live in a state
directory (quickchr's machine directory), only a shorter sandbox path helps,
so harnesses on macOS start from `/tmp`.

## Acceptance cases

An adopting repo proves the contract with tests like these. Each sets up the
trap, runs the tool in a sandbox, and asserts the trap was not touched.

| Case | Setup | Expect |
| --- | --- | --- |
| Populated legacy directories | Files at the tool's legacy paths under a fake home | Not read; the run behaves as on a fresh machine |
| Workspace above the test | A `.tikoci/<tool>/` in a parent of the working directory, with a setting that would change the result | Not discovered |
| Encrypted CDB at the default path ([centrs#654](https://github.com/tikoci/centrs/issues/654)) | An encrypted CDB where the user root would find it | No `cdb/password-required`; the run uses its own CDB |
| Inherited tool variable | `CENTRS_CDB_FILE` or `QUICKCHR_DATA_DIR` in the parent environment | The harness drops it; the child never sees it |
| Keychain | A keychain stub that fails when called | Never called |
| Warm cache | An image or DB already in the user's cache | Reused; no download |
| Small cache policy | A user cache over the default size limit, with images the owner's machines need | Nothing evicted |
| Owner's ports | A stopped machine in the user root holding a port block | The sandbox picks other ports |
| Host services | A managed network in the user root | Not restarted or removed; no sudo |
| Long root | A sandbox whose socket path would exceed 103 bytes | A clear error before QEMU starts |
| Host files | A read-only `~/.ssh/known_hosts` under a fake home | Unchanged |
| Library pass-through | A sandboxed centrs call that resolves a quickchr machine | quickchr sees the sandbox, not the user's machines |

Owner behavior (discovery, legacy fallback, eviction) gets its own tests that
set those directories up deliberately, also under a fake home.
