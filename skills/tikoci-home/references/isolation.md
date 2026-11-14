# Sandboxes and test isolation

A test or CI run of a tikoci tool must not read or change the developer's own
setup, and must not download gigabytes the developer already has. Under
[tikoci-home](../SKILL.md) that is a sandbox: `TIKOCI_SANDBOX=<dir>` replaces
the user scope for the run. It is separate from `TIKOCI_HOME`, which only
moves the user scope, so a user who sets `TIKOCI_HOME` in a shell profile
keeps projects, trust and the keychain.

This is cooperative storage isolation: it keeps a well-behaved tool and a
careful harness away from the user's files. It is not a security sandbox.

## What a sandbox guarantees

With `TIKOCI_SANDBOX` set to a fresh directory, the tool:

1. reads and writes config, secrets, state and trust records only under
   `<sandbox>/<tool>/`, and runtime files under `<sandbox>/run/<tool>/`. This
   wins over `TIKOCI_HOME` and over the tool's home variables
   (`<TOOL>_HOME`, `QUICKCHR_DATA_DIR`);
2. still honors file and cache variables the test sets on purpose
   (`CENTRS_CDB_FILE`, `<TOOL>_CACHE_DIR`) and reports them as such;
3. discovers no project. `TIKOCI_PROJECT` can name one; its traveling files
   are read as usual, and its `local/` only with a trust record made inside
   the sandbox;
4. reads no legacy path (`~/.config/...`, `~/.local/share/...`, `~/.rosetta`);
5. does not touch the OS keychain (`Bun.secrets`, Keychain, libsecret,
   Credential Manager), so no prompt can hang a run;
6. reads from and adds to the shared cache, and never evicts from it. A test
   of eviction, corruption or a cold start points `TIKOCI_CACHE_DIR` inside
   the sandbox and then owns that cache, eviction included;
7. never creates, restarts or removes a host service, and never runs sudo;
   it takes ports from its own range, through the same host-wide allocation
   lock as every other run;
8. writes no file that belongs to another program (`~/.ssh/known_hosts`,
   shell rc files).

`HOME` stays as it is; tests should not need to change it. For in-process
calls, a test can instead pass an env with no `HOME` and no `TIKOCI_HOME`:
the resolver then finds no user scope at all, rather than falling back to
`os.homedir()` and the developer's real files
([centrs#654](https://github.com/tikoci/centrs/issues/654)).

## What the harness does

The tool cannot tell an inherited variable from one the test set, and
`CENTRS_CDB_FILE` exported in a developer's shell would otherwise win. So the
harness:

- builds each child's environment from an allowlist (`PATH`, `HOME`, temp and
  locale variables, and `TIKOCI_HOME` and `TIKOCI_CACHE_DIR`, which locate the
  user's cache), never by copying `process.env`;
- sets `TIKOCI_SANDBOX` to a new directory per run or per file, and
  `TIKOCI_CACHE_DIR` to the cache the developer already has;
- adds back only the variables the test means to set;
- runs `bun` children with `--no-env-file`, so a checkout's `.env` cannot add
  variables (`bun <file>` ignores a shebang that says so;
  [centrs#666](https://github.com/tikoci/centrs/issues/666));
- calls libraries with that env (and a cwd) as arguments rather than
  mutating `process.env` or changing directory, and expects them to pass both
  on to other tools' libraries.

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
the files under it (quickchr's `logs/` and `machine.json`). A cache restored
by `actions/cache` excludes lease directories, which a reused pid could
otherwise keep alive.

## Socket paths

A sandbox under the system temp directory can be long (macOS
`/var/folders/...`). Sockets go in `run/<tool>/` under short names, the tool
checks their length at creation (103 bytes) and names the variable to change
in the error: `TIKOCI_RUNTIME_DIR`, or a shorter sandbox base (`/tmp` on
macOS).

## Acceptance cases

An adopting repo proves the contract with tests like these. Each sets up the
trap, runs the tool in a sandbox, and asserts the trap was not touched.

| Case | Setup | Expect |
| --- | --- | --- |
| Populated legacy directories | Files at the tool's legacy paths under a fake home | Not read; the run behaves as on a fresh machine |
| Project above the test | A `.tikoci/<tool>/` in a parent of the working directory, with a setting that would change the result | Not discovered |
| Named project | `TIKOCI_PROJECT` naming a project the user trusted, with a `local/` CDB | Traveling settings apply; `local/` is not read |
| Encrypted CDB at the default path ([centrs#654](https://github.com/tikoci/centrs/issues/654)) | An encrypted CDB where the user scope would find it | No `cdb/password-required`; the run uses its own CDB |
| Inherited home variable | `CENTRS_HOME` or `QUICKCHR_DATA_DIR` in the parent environment | The harness drops it; set on purpose, the sandbox still wins |
| Explicit file variable | `CENTRS_CDB_FILE` set by the test outside the sandbox | Used, and reported as an explicit source |
| Keychain | A keychain stub that fails when called | Never called |
| Warm cache | An image or DB already in the user's cache | Reused; no download |
| Small cache policy | A user cache over the default size limit, with images the user's machines need | Nothing evicted |
| Private cache | `TIKOCI_CACHE_DIR` inside the sandbox, over its size limit | The sandbox evicts its own cache, and only that |
| User's ports | A stopped machine in the user scope holding a port block | The sandbox picks ports from its own range |
| Concurrent sandboxes | Two sandboxes allocating at once | Different ports, through the host-wide lock |
| Host services | A managed network in the user scope | Not restarted or removed; no sudo |
| Long root | A sandbox whose socket path would exceed 103 bytes | A clear error before QEMU starts |
| Host files | A read-only `~/.ssh/known_hosts` under a fake home | Unchanged; centrs uses only the sandbox's file |
| Library pass-through | A sandboxed centrs call that resolves a quickchr machine | quickchr sees the sandbox and centrs' project, not the user's machines |

User-scope behavior (discovery, trust, legacy fallback, eviction) gets its
own tests that set those directories up deliberately, also under a fake home.
