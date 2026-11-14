# Test isolation contract

A test that runs a tikoci tool must not read or write the developer's own
files, and must not download gigabytes it already has. Under
[tikoci-home](../SKILL.md) one variable does both: `TIKOCI_HOME` pins the run.

## What a pinned run guarantees

With `TIKOCI_HOME` set to a fresh directory, the tool:

1. reads and writes config, secrets and state only under `$TIKOCI_HOME/<tool>/`;
2. discovers no workspace, unless `TIKOCI_WORKSPACE` names one;
3. reads no legacy path (`~/.config/...`, `~/.local/share/...`, `~/.rosetta`);
4. does not touch the OS keychain (`Bun.secrets`, Keychain, libsecret,
   Credential Manager), so no prompt can hang a run;
5. reuses the user's cache, unless `TIKOCI_CACHE_DIR` is set;
6. keeps runtime files under `$TIKOCI_HOME/run/<tool>/`, unless
   `TIKOCI_RUNTIME_DIR` is set;
7. writes no file that belongs to another program (`~/.ssh/known_hosts`,
   shell rc files).

`HOME` stays as it is. Tests should not need to change it; one that does sets
`TIKOCI_CACHE_DIR` explicitly so the cache does not move with it.

## What the harness does

The tool cannot tell an inherited variable from one the test set, and
`CENTRS_CDB_FILE` or `QUICKCHR_DATA_DIR` exported in a developer's shell would
otherwise win. So the harness:

- builds each child's environment from an allowlist (`PATH`, `HOME`, temp and
  locale variables), never by copying `process.env`;
- sets `TIKOCI_HOME` to a new temp directory per run or per file, and
  `TIKOCI_CACHE_DIR` to the cache the developer already has;
- adds back only the tool variables the test means to set;
- runs `bun` children with `--no-env-file`, or from a directory with no
  `.env`, so a checkout's `.env` cannot add variables;
- for in-process calls, passes that environment as an argument rather than
  mutating `process.env`, where the tool's API allows it.

[`hermeticEnv()`](../scripts/tikoci-paths.ts) in the reference resolver does
the first three:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hermeticEnv } from "./tikoci-paths.ts";

const home = mkdtempSync(join(tmpdir(), "tikoci-"));
const proc = Bun.spawn(["bun", "--no-env-file", "src/cli.ts", "devices", "list"], {
    env: hermeticEnv(home),
});
```

## Socket paths

A pinned root under the system temp directory can be long (macOS
`/var/folders/...`). The tool checks socket lengths at creation (103 bytes)
and names `TIKOCI_RUNTIME_DIR` in the error; a harness that hits it sets
`TIKOCI_RUNTIME_DIR` to a short directory such as one under `/tmp`.

## Acceptance cases

An adopting repo proves the contract with tests like these. Each sets up the
trap, runs the tool pinned, and asserts the trap was not touched.

| Case | Setup | Expect |
| --- | --- | --- |
| Populated legacy directories | Files at the tool's legacy paths under a fake home | Not read; the run behaves as on a fresh machine |
| Workspace above the test | A `.tikoci/<tool>/` in a parent of the working directory, with a setting that would change the result | Not discovered |
| Encrypted CDB at the default path ([centrs#654](https://github.com/tikoci/centrs/issues/654)) | An encrypted CDB where the unpinned default would find it | No `cdb/password-required`; the run uses its own CDB |
| Inherited tool variable | `CENTRS_CDB_FILE` or `QUICKCHR_DATA_DIR` in the parent environment | The harness drops it; the child never sees it |
| Keychain | A keychain stub that fails when called | Never called |
| Warm cache | An image or DB already in the user's cache | Reused; no download |
| Long root | A root whose socket path would exceed 103 bytes | A clear error naming `TIKOCI_RUNTIME_DIR`, before QEMU starts |
| Host files | A read-only `~/.ssh/known_hosts` under a fake home | Unchanged |

Unpinned behavior (discovery, legacy fallback) gets its own tests that set
those directories up deliberately, also under a fake home.
