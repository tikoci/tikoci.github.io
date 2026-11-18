# Local agent notes

<!-- Starting copy from tikoci-house (assets/local-notes.example.md). Save it as
     ~/.agents/AGENTS.md. ~/.claude/CLAUDE.md is the one line
     @~/.agents/AGENTS.md, and ~/.codex/AGENTS.md is a symlink to this file.
     Machine facts only: a rule belongs in a house skill. -->

tikoci rules are in the house skills: read
<https://tikoci.dev/house/skills/tikoci-house/SKILL.md> first. Which repo owns
what: <https://tikoci.dev/house/skills/tikoci-crossref/SKILL.md>.

## This machine

- `<name>`: `<OS and version>`, `<CPU architecture>`, `<cores>` cores,
  `<RAM>` GB.
- Bun `<version>`; QEMU for `<x86_64, aarch64>` with `<KVM, HVF or TCG>`.
- Tools outside the usual set, and how they are installed.
- Checkouts: `~/<folder>/<repo>`.

## Accounts

- GitHub: `<account>`, reaching the tikoci org through `gh`.

## Other machines

Machines an orchestrator such as T3 Code reaches from here. Check that one is
reachable before relying on it.

| Name | OS, CPU | Role | Lifetime |
| --- | --- | --- | --- |
| `<name>` | `<OS>`, `<CPU>` | `<role, for example the main workstation>` | permanent |
| `<name>` | RouterOS CHR with a T3 Code `/app` | test box | may fail tests or be deleted |
