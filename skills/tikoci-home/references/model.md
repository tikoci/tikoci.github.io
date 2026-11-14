# Concept model (proposal)

**Status: a proposal under review on
[PR #24](https://github.com/tikoci/tikoci.github.io/pull/24).** It answers
the conceptual review of the three-root model. [SKILL.md](../SKILL.md), the
resolver and the tests still describe that model. Once this page is agreed,
they are rewritten to match, and only then does migration come up. Nothing
here changes a tool.

## Four concepts

| Concept | What it is | Travels with a clone? | Default home | Written by |
| --- | --- | --- | --- | --- |
| **Intent** | What a project means: topology, logical devices, desired config, lab definitions, tool pins, project setting defaults | yes | the project's `.tikoci/` (house schema) | people and the tool that owns each schema |
| **Bindings and authority** | What this user, on this host, allows and connects: trust, grants, credential bindings, host bindings | no | the user root | a person, through dedicated commands |
| **Artifacts** | Reusable, immutable files that can be fetched again: images, rosetta DBs, MIBs | no (re-fetched) | a cache root, shared by default | the tool that publishes them |
| **Execution state** | What was realized: machines, processes, reservations, sockets | no | the context that realized it | that context only |

The three roots stay, as storage defaults under these concepts:

- the **user root** (`TIKOCI_HOME`) holds bindings, authority and execution
  state, and the default cache;
- the project's **`.tikoci/`** holds intent;
- a **sandbox** (`TIKOCI_SANDBOX`) is an execution context with its own
  bindings and state. It is not a storage class.

What changes from the three-root model: a workspace is no longer a "guest".
Opening a project selects intent and never confers or removes authority.
Authority comes from records and from the context, never from a directory.

## Scope, class and authority (thread 1)

These are three separate dimensions, and a file has a value for each.

- **Scope**: where it applies. The *host namespace* (see Host resources),
  *user*, *project* (portable), *instance* (one checkout or worktree),
  *context* (the user's own or a sandbox), *process*.
- **Class**: config, secret, state, artifact (cache), runtime, reservation,
  install. The class rules in SKILL.md stay: owner-only secrets, atomic
  state, sockets within 103 bytes, and so on.
- **Authority**: what an invocation may do. It is a set of capabilities:

| Capability | Lets a run | Comes from | In a sandbox |
| --- | --- | --- | --- |
| `read-intent` | read project data beyond allowlisted settings | trust of the instance | the sandbox's own trust records |
| `use-credential` | use a bound credential for a logical device | a grant plus a binding | sandbox records; no keychain |
| `provision` | create or change a realization, run provisioning scripts | a grant (or the lab preset) | sandbox records |
| `write-device` | change a device's configuration | a grant | sandbox records |
| `agent-reach` | expose a device to agents (`mcp=rw`) | a grant | sandbox records |
| `collect` | evict from a cache | being that cache's collector | only for a cache inside the sandbox |
| `host-services` | create, restart or remove system services; sudo | the user's own context, interactively | never |
| `legacy` | read and migrate pre-tikoci-home paths | the user's own context | never |
| `keychain` | use the OS keychain or `Bun.secrets` | the user's own context | never |

The resolver returns this set (and why each member is present) in place of
today's `owner: !sandboxed`, so a run in a workspace no longer looks like an
owner because it is not sandboxed. The placement questions change the same
way: "disk space" is dropped. The question that sorts host files is
**does it need coordinating with other contexts?** (ports, socket names,
services), and the answer is a reservation, not a directory.

## Identity (thread 3)

Four identities, never derived from one another by path:

| Identity | Example | Where it comes from | Used for |
| --- | --- | --- | --- |
| Project | `acme-net` | `id` in the committed `.tikoci/project.toml` | names, grouping, reports; never authority, since anyone can copy it |
| Logical device | `edge1` | intent; unique within a project | what people, agents and every tool call a device |
| Instance | a random id | made locally the first time a checkout is used | everything local: trust, grants, bindings, realizations |
| Realization | quickchr machine for (instance, `edge1`); a box's serial number | the tool that realizes it, or a binding to hardware | execution state, reservations, cleanup |

An instance is one checkout or worktree on one host. It is recorded twice:
a marker file `.tikoci/instance` (gitignored) holding the id, and a record in
the user root (`$TIKOCI_HOME/instances/<id>`) holding the canonical path,
the project id and the git common directory. Both must agree.

| Event | Marker | Record | Result |
| --- | --- | --- | --- |
| Fresh clone, or a new worktree | absent | none | new instance: untrusted, no grants or bindings |
| Same checkout again | matches | path matches | same instance |
| Checkout deleted and re-cloned at the same path | absent | old record, path matches | new instance; the old one is orphaned |
| Checkout moved | present | old path gone | `rebind` (a person) moves the record; until then, untrusted |
| Directory copied | present | old path still has it | new instance for the copy |
| Synced folder on another host | present (synced) | none on that host | new instance |

Realizations are keyed by instance, so `edge1` in two projects, or in two
worktrees of one project, is two machines. Two instances share a machine only
through an explicit local binding ("`edge1` here is my machine `lab-edge`"),
never through committed data. An orphaned instance's realizations and
reservations are listed by a cleanup command and removed only explicitly.

The user's own context also has a project-less scope, where today's flat
machine names (quickchr) and personal devices (centrs' user CDB) keep working.

## Intent (thread 2)

Intent lives in `.tikoci/`. When the working directory is in a project with
a `.tikoci/` directory, that is what every tikoci tool reads, and the house
defines its schema. No tool's own layout sets it, a prototype's least of
all: routeros-muse adopts `.tikoci/` like any other repo.

```text
.tikoci/
  project.toml           project id and tool pins
  devices/<id>.toml      one logical device per file
  labs/<name>.toml       lab definitions
  config/<id>/           desired configuration, per device
  <tool>/<tool>.env      allowlisted settings
```

```toml
# .tikoci/project.toml (house schema)
id = "acme-net"

[pins]
quickchr = "0.5.5"
centrs = "0.1.9"
```

All of these are committed. The `.gitignore` a tool writes in `.tikoci/`
excludes everything else: the instance marker, `<tool>.local.env`, and any
state or runtime file. An absent directory means the project has none of
that kind.

Ownership is one writer per artifact kind:

| Artifact | Schema owner | Writers | Readers |
| --- | --- | --- | --- |
| `project.toml` (`id`, `[pins]`) | house (this skill) | people | every tool; bootstrap and doctor checks |
| Device file, `[device]` table (`id`, `role`, `site`, `label`) | house | people | every tool |
| Device file, per-tool table (`[quickchr]`, `[centrs]`, `[expect]`) | that tool | that tool, people | anyone |
| Lab definition (devices, links, provisioning) | quickchr | quickchr, people | centrs, muse |
| Desired configuration | house (layout only) | people, agents | centrs (apply), muse (drift) |
| `<tool>/<tool>.env` (allowlisted settings) | that tool | `settings set --project` | that tool |

Rules:

- **No tool keeps a competing copy.** A tool may generate a mirror (a
  device list for display), which says it is generated and from what, and
  is never read as a source.
- **A tool edits only its own table** and preserves the rest of the file.
- **No secrets, addresses that need credentials, serial numbers or host
  paths in intent.** Those are bindings. An address that is part of the
  design (a management subnet) is intent; which credential reaches it is not.
- **Adopting it in muse** means its prototype files map onto this layout:
  `inventory/<device-id>.toml` and `router.toml` become
  `.tikoci/devices/<id>.toml`, `workspace.toml [pins]` becomes
  `project.toml [pins]`, and the `serial` and `cdb` fields become local
  bindings. Its `[home]`, `[backup]` and `[upstreams]` are muse's own and stay
  outside `.tikoci/`.

### Device sources

A tool finds logical devices through **sources**, never through one fixed
file. A project's `.tikoci/devices/` is one source; the user's own devices
outside any project are another; later schemes (a CMR controller, a muse
inventory, an import) can be more. A run selects one inventory (see
Inheritance by kind), and each device's access comes from a binding.

For centrs this means the CDB stops being "the only durable inventory". It
stays the store for what a device needs locally (addresses of real devices,
credentials, per-device options) and the source of the user's own devices,
but no tool assumes one user-wide CDB, and centrs can take devices from
other sources as they appear.

## Trust and grants (thread 7)

**Trust** lets a run read an instance's intent as input. **Grants** let it
act: use a credential on a target, provision, write a device, give agents
reach. They are recorded separately, and trust grants none of them.

- Trust and grants are records in the user root, keyed by instance. Nothing
  inside a checkout confers either: a synced folder carries gitignored files
  too, so local files in a checkout are still content.
- A new worktree whose git common directory matches a trusted instance's
  inherits that instance's trust and grants: the common directory is local
  git metadata, not cloned content. Any other new instance starts with none.
- **Credentials bind; they never fall back.** A project's `edge1` gets a
  credential only through a binding made on this host. The user's default
  credentials (centrs' `__default__` record) never reach a project device
  implicitly, so a clone that maps `edge1` to another address gets nothing.
- **Presets** grant common cases in one step. The *lab* preset covers
  realizations this instance creates: provision, write, agent reach,
  self-signed TLS (`insecure`) and credentials the realizing tool generates.
  It never binds a user credential and never covers a real device.

Threat model:

| | Covered | How |
| --- | --- | --- |
| Hostile or careless content arriving by clone, pull or folder sync | yes | allowlisted settings; intent unread until trusted; no authority from files |
| Agent calls through agent APIs (MCP), including prompt-injected ones | yes | no agent API can trust, grant, bind or widen reach |
| Accidental inheritance in tests | yes | sandbox plus the harness allowlist |
| An agent or program with an unrestricted shell as the same OS user | **no** | it can edit the user root directly; that boundary belongs to the harness's permission rules, a separate OS user or a container |

The approval boundary is therefore: trust, grant, bind and rebind are
dedicated CLI commands with distinct names (so a harness can deny them by
pattern), never exposed through MCP, that ask for confirmation on a terminal.
The one exception is a sandbox, where they run non-interactively and affect
only that sandbox's records.

## Host resources (thread 4)

A **host namespace** is the set of contexts that can collide on a resource:
the network namespace for TCP ports, the filesystem for socket and pipe
names, the OS for system services. A container with its own network
namespace is its own host namespace; a remote host is coordinated on that
host, never from here. The namespace is independent of `TIKOCI_HOME`: two
relocated user roots, or two sandboxes, on one host share it.

Invariant, for every reserved resource:

1. **Atomic reservation.** A claim is created atomically in a registry every
   context in the namespace reads, *before* the resource is used; checking
   and then binding is not enough.
2. **Owner and lifetime.** A claim names its owner (context, instance,
   realization) and its lifetime: *live* (held by a process, identified by
   pid and start time) or *durable* (held by execution state, such as a
   stopped machine's port block, identified by its state path).
3. **Release.** The owner releases a claim when it stops or the realization
   is removed.
4. **Stale claims.** A live claim is stale when its process is gone; a
   durable one when its state path is gone. Any context may reclaim a stale
   claim; none may take a valid one.
5. **Outside claimants.** Anything not using the registry (another user, an
   unrelated program) is detected by a bind probe after reservation.

The mechanism (a file registry, OS allocation, a service) is the
implementation's choice. For file registries the default location is
`TIKOCI_HOST_DIR`, defaulting to `<home>/.tikoci/host` (`%LOCALAPPDATA%\tikoci\host`
on Windows). It is derived from the home directory, not from `TIKOCI_HOME`,
so relocating the user root does not split it, and a sandbox keeps it.

## Artifacts and caches (thread 6)

- **Identity** is the tool, the kind and every property that affects
  compatibility: source, version, digest, architecture, format
  (`quickchr/chr/7.22/x86_64/raw/sha256:…`). A version alone is not enough.
- **Publication** is atomic: write to a temporary name in the same cache
  root, verify the digest, rename. Readers never see a partial entry, and a
  corrupt one fails verification and is re-fetched.
- **Leases.** A reader holds a lease while it uses an entry, with the same
  live or durable ownership as a host claim (a machine whose reset needs its
  factory image holds a durable lease). Leases live in the cache root, so
  every context sharing it sees them.
- **One collector per cache.** Only the collector evicts, using its own
  tool's policy (size, age), and never an entry under a valid lease. The
  shared user cache's collector is the user's own context. A sandbox is the
  collector of a cache inside the sandbox and of no other.
- **Sharing is a choice of cache root, not of context.** By default a
  sandbox reads and publishes to the shared cache. A test of eviction,
  corruption or a cold start sets `TIKOCI_CACHE_DIR` inside its sandbox and
  owns that cache entirely.

## Sandbox semantics (thread 5)

A sandbox is **cooperative storage isolation**, not a security sandbox: it
keeps a well-behaved tool and a careful harness from touching the user's
setup by accident.

Guaranteed: nothing that is *defaulted or discovered* resolves outside the
sandbox, except the shared cache (read, publish, lease; no `collect`) and the
host registry (own claims only). A path outside it is used only when an
explicit variable names it; that is an authorized exception, and the tool
reports it as one. Authority still comes from the sandbox's own records.

| Case | Expected |
| --- | --- |
| `CENTRS_HOME` outside the sandbox | used; reported as `env:CENTRS_HOME (outside sandbox)`; trust and grants still from the sandbox |
| `CENTRS_CDB_FILE` outside the sandbox | used and reported; its credentials apply only through a sandbox binding |
| `TIKOCI_WORKSPACE` naming a project | resolved and reported; its intent is read only after a trust recorded in the sandbox |
| A `.tikoci/` above the working directory | not discovered |
| `TIKOCI_CACHE_DIR` inside the sandbox | private cache; the sandbox is its collector |
| No `TIKOCI_CACHE_DIR` and no user root | private cache at `<sandbox>/cache` |

## Inheritance by kind (thread 8)

Each kind of value has its own rule; there is no single precedence list for
everything.

| Kind | Examples | Allowed sources (first wins, top down) | Combine | Writes go to |
| --- | --- | --- | --- | --- |
| Bootstrap keys | `TIKOCI_HOME`, `TIKOCI_SANDBOX`, `TIKOCI_CACHE_DIR`, `TIKOCI_HOST_DIR`, `TIKOCI_WORKSPACE`, `<TOOL>_HOME`, single-file variables | flag, env, default | replace; never from a file, since files are found through them | not written |
| Host and cache policy | `cache-max-size`, `storage-reserve`, `accel` | flag, env, the collector context's user file | replace; never from a project | user file |
| Ordinary settings | `format`, `timeout`, `default-channel` | flag, env, instance override (a binding), committed project file (allowlisted), user file, default | layer key by key | `settings set`: user file; `--project`: committed file, allowlisted keys only |
| Intent | devices, labs, desired config, pins | the trusted instance's project files | select: one project per run, never merged with the user's | the owning tool's file or table |
| Inventory | which devices exist | intent in a project; the user's own outside one | select: one per run; `--context user` reaches the user's own from inside a project | as intent, or the user's store |
| Credentials | users, passwords, keys | a binding for that device; generated lab credentials | bind: exactly one, no layering; no binding fails | binding store in the user root |
| Grants and trust | trust, provision, write, agent reach | user-root records for the instance (or the sandbox's) | explicit records; sandbox limits always apply | user root |
| Execution state and runtime | machines, reservations, sockets | its owner only | never merged | the owner's state or `run/` |

Every resolved value is reported with its source: `flag`, `env:NAME`,
`file:PATH`, `intent:PATH`, `binding:ID` or `default` (centrs'
`meta.settings` already does this). A repo keeps its own variable names and
adopts kinds one at a time.

## Scenarios

| Scenario | What happens |
| --- | --- |
| **Two projects both describe `edge1` and share images** | Each project's `.tikoci/devices/edge1.toml` is intent; each checkout is its own instance, so quickchr realizes two machines, keyed (instance, `edge1`), with distinct reserved ports. Both read the same image entry (same identity) under leases. Nothing mutable is shared unless a person binds both to one machine. |
| **Two concurrent test runs** | Each harness makes its own sandbox and keeps `HOME`, so both use one host registry: reservations are atomic and never collide, and a crashed run's live claims go stale with its processes. Run A shares the user cache (read, publish, lease). Run B points `TIKOCI_CACHE_DIR` into its sandbox, is that cache's collector, and can test eviction or corruption without touching the shared one. |
| **A clone on another host** | Intent arrives. The checkout has no marker (or a synced one with no record here), so it is a new instance: untrusted, with no grants or bindings. Allowlisted committed settings apply. A person trusts it, applies the lab preset for labs, and binds credentials for real devices on this host. Nothing from the first host's user root came along. |
| **Two worktrees** | Each worktree is a new instance with the same project id. Both inherit trust and grants through the shared git common directory. Each realizes its own lab (`edge1` twice, distinct machines and ports) from shared images. Removing a worktree orphans its instance; cleanup lists and removes its machines and durable claims on request. |
| **A container is replaced** | In app-t3code `HOME` is the `/data` volume, so the user root, checkouts and their markers, instance records, grants, durable execution state (machine disks, durable claims) and caches all survive `/app/update`. The container is its own host namespace. Live claims and runtime records from the old container name dead processes (pid and start time no longer match), so they are stale and rebuilt on start. Tools in image layers are replaced and checked against the pins. |
| **`TIKOCI_HOME` is relocated while another context holds resources** | The host registry is derived from the home directory, so claims made under the old root stay visible and are respected. Durable claims stay valid while their state paths exist. Running processes keep the paths they started with. The new root has no instance records: projects appear as new instances until the user migrates the old root (an explicit command that refuses while claims are live) or trusts them again. |
| **centrs, quickchr and muse use one `edge1`** | `.tikoci/devices/edge1.toml` is the only definition: `[device]` (house), `[quickchr]` (how to realize it as a CHR), `[expect]` (muse's drift check). quickchr realizes it and records the realization by (instance, `edge1`). centrs resolves `edge1` within the project: for a lab it asks quickchr's library (passing its env) for the endpoint and generated credentials; for a real device it uses the credential binding. muse lists devices from intent and status from the tools. Each writes only its own table, and any device list muse shows is a generated mirror. |

## Open for this round

- **centrs' constitution.** The direction is settled (see Device sources):
  the CDB is one source and the binding store, not the only inventory. How
  and when the constitution says so, and whether a project's binding store
  lives in the user root per instance or in a checkout under trust, is
  centrs' call.
- **quickchr's long-term scheme.** Machines a project defines are named per
  project instance (the Identity section), so quickchr gains a
  project-level scheme, and today's flat names become the project-less
  scope. Still open: where a project's machine disks live (proposed: the
  user root, indexed by instance, since checkouts are content and can be
  synced), and when quickchr adopts it. No migration is proposed now.
- **The manifest's name**: `project.toml` here; `workspace.toml` was the
  other candidate, but muse already uses that name for something else.
- **The registry default** (`<home>/.tikoci/host`), and whether a supplied env
  with no home directory may reserve anything (proposed: no, it fails).
- **Reserved names** in the user root: `cache`, `run`, `host` and `instances`
  are not tool names.
