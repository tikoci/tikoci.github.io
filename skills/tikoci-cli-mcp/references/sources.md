# Sources

The rules in [tikoci-cli-mcp](../SKILL.md) come from the November 2026
survey of tikoci instruction files and skills. Row ids refer to
[2026-11-survey.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-survey.tsv);
settled disagreements are in
[2026-11-conflicts.tsv](https://github.com/tikoci/tikoci.github.io/blob/main/docs/house/2026-11-conflicts.tsv).
Planning: Phase 3 of [issue #21](https://github.com/tikoci/tikoci.github.io/issues/21).
The skill was planned as `tikoci-interfaces` and renamed on 2026-11-17 so
its name says when it applies. Repo files were read at centrs 80a6f9f,
quickchr 939f878, rosetta a51b201 and restraml 0e476ce. The centrs and
rosetta agents reviewed #38; rules they added or corrected name them below.

| Rule | Rows | Notes |
| --- | --- | --- |
| No house output shape; agent-friendly output | quickchr-036 | Settles `output-shape` (maintainer, 2026-11-17). centrs `docs/CONSTITUTION.md` "Result envelope" (the envelope, warnings vs tips, lossless text render, "Text stdout is data", #470 and #473); quickchr `src/cli/tips.ts`. |
| Tips name a next command, not TTY-gated; a caller can drop them | quickchr-036 | quickchr `src/cli/tips.ts` header and `QUICKCHR_NO_TIPS`; tip codes from the centrs review of #38 (centrs `tip/*` in `src/execute.ts`, `src/discover.ts`). |
| A warning on every normal run stays out of text | - | centrs review of #38. centrs CONSTITUTION ("`transport/provider-trust` is left out of text"). |
| Plain text when stdout is not a terminal; `NO_COLOR` | - | rosetta `MANUAL.md` (`browse` output). |
| Big results summarized, MCP included | restraml-28 | restraml `CLAUDE.md` "Tool Design Conventions" (diff returns stats and capped path lists); rosetta's token-budget block in `src/mcp-contract.test.ts`; centrs #605 (open) for MCP result size. |
| Errors are public API; internals as structured cause | centrs-14 | centrs `.github/instructions/actionable-errors.instructions.md`; CONSTITUTION "Error model" (`message`, `fix`, `cause`). |
| One name per field on every surface | - | centrs review of #38: centrs CONSTITUTION says `message` and `fix`, `src/errors.ts` emits `remediation` and both `detailsUrl` and `details_url`. |
| One registry of codes, a test, no vague codes | quickchr-033, centrs-14 | quickchr `general.instructions.md` "Error Handling" (`ErrorCode` union, no bare `TIMEOUT`); centrs `src/core/error-catalog.ts` and `test/unit/error-catalog.test.ts`. Code spelling: settled `error-code-style` (maintainer, 2026-11-18). |
| The tool's errors apart from the system's; a code says who failed | centrs-14 | centrs CONSTITUTION "Error model" (`routeros/*`, `src/core/routeros-errors.ts`). "Who failed" from the centrs review of #38. |
| A way to more information, in whatever form | centrs-14 | Settles `error-details` (maintainer, 2026-11-17). centrs `docs/errors/README.md` (per-code pages, drift guard). The rosetta `bunx` refresh gap is the maintainer's example, made precise in the rosetta review of #38: `ROSETTA_OFFLINE` error and `staleClientNotice` in `src/mcp.ts`; MANUAL.md "How Updates Work" (#226). |
| Recovery commands run as printed | quickchr-098 | quickchr `provisioning.instructions.md` "A refusal's route must be a line you can paste"; `shellQuote()` in `src/lib/names.ts`. |
| Refuse, never drop; absent is not `false` | quickchr-096 | quickchr `provisioning.instructions.md` (`PROVISIONING_WINDOW_CLOSED`, #176; `flagOptionalBool()`, #185). |
| All or nothing for one thing; per-target results across many | quickchr-105 | quickchr `provisioning.instructions.md` "Provisioning Failure Modes" and `rollbackFailedProvisioning()`; centrs CONSTITUTION fan-out (`FanoutData`, exit codes 0, 2, 1). Scoped in the Codex review of #38. |
| Multi-target writes: confirm once with the blast radius; empty selection; a sent write is never retried | - | centrs review of #38. centrs CONSTITUTION fan-out (#460, #448, `transport/write-outcome-unknown`). |
| Missing local tool: install hint per platform | centrs-14 | centrs `actionable-errors.instructions.md`; quickchr `QuickCHRError`'s `installHint`. |
| Crash early while failure modes are unknown | user-31 | A user-level note; catching at the output boundary reconciles it with typed errors. |
| A doctor where outside dependencies cause classes of failure; every tool flags setup it has not done | - | Maintainer, 2026-11-17, and made general on 2026-11-18 (not every tool needs one; the point is ruling setup out). quickchr `cmdDoctor` in `src/cli/index.ts` and `QuickCHR.doctor()`; rosetta `local-db-grounding.instructions.md` (`classifyDbGrounding`, `db:doctor`); centrs `tip/no-devices` and `tip/credentials-missing`. |
| The library never prints or exits | quickchr-032 | quickchr `general.instructions.md` "Layer Rules". |
| Shared core, thin adapters | rosetta-48 | rosetta `query-core-not-adapter.instructions.md`. That rosetta's own code is still too coupled is the maintainer's read (2026-11-17). |
| One helper for external calls | - | Settled `fetch-helper` (quickchr-022, quickchr-053). |
| `--help` before dispatch; flag registry; declared arity; removed flags | quickchr-035 | quickchr `general.instructions.md` "CLI Conventions" (`wantsCommandHelp`, `ADD_FLAGS`/`START_FLAGS`, `VALUE_FLAGS`, `REMOVED_FLAGS`, the two unit tests). |
| A few verbs, not one tool per command | - | bench-routeros-tools `REPORT.md` (the 166-tool figures), cited by centrs `commands/mcp/README.md` "Why a scoped surface" (attribution corrected in the centrs review of #38); `src/mcp/tools.ts` (six tools); rosetta `DESIGN.md` "Why endpoint-shaped MCP is not the answer". |
| Descriptions route: boundaries, arrows, empty-result hints | rosetta-45 | rosetta `mcp-tool-descriptions.instructions.md`; the arrow test in `src/mcp-contract.test.ts`. |
| CLI's shape; `isError` on failure, not per target; typed output an open choice | - | centrs `commands/mcp/README.md` "Intent"; `src/mcp/server.ts`; centrs #605 (open), from the centrs review of #38. |
| Not found is an error only for a named thing | - | rosetta review of #38. rosetta `routeros_get_page` ("Page not found") in `src/mcp.ts`. |
| Validate in code; honest annotations; write gates | restraml-28 | restraml `CLAUDE.md` "WebMCP" (`untrustedContentHint` rule); centrs `commands/mcp/README.md` (`destructiveHint` on `execute`). |
| A write opt-in the agent cannot reach | - | centrs review of #38. centrs `commands/mcp/README.md` (`mcp=rw` plus `confirm: true`); `test/unit/mcp-tools.test.ts` (an MCP agent sets `mcp=rw`); `docs/MATRIX.md` "Auth and secrets" (the gap). |
| Frozen tool list, with annotations, through an in-process client | rosetta-54 | rosetta `tool-surface-change.instructions.md` and `EXPECTED_TOOLS`; the in-process client from the centrs review of #38 (centrs `test/unit/mcp-server-result.test.ts`, #606). |
| Resources for datasets, tools for queries | - | rosetta `DESIGN.md` "MCP resources complement tools". |
| Client diversity is the deployment gate | user-61 | rosetta `DESIGN.md` "Deployment strategy and MCP client diversity"; centrs `commands/mcp/README.md` "Client install snippets". |
| CLI and TUI parity with MCP | user-120 | Maintainer, 2026-11-17. rosetta `MANUAL.md` (`browse --once` dot-commands); centrs CONSTITUTION invariant (one settings vocabulary). Moved here from the data skill. |
| A command's spec is normative | centrs-27 | centrs `done-definition.instructions.md`; `docs/MATRIX.md` "Cell states" (`examples.md` green on CHR). |
| Examples are onboarding | quickchr-044 | quickchr `examples.instructions.md`. |

Moved out: quickchr-062 ("type what you use; RouterOS shapes drift by
version") went to tikoci-testing's "RouterOS versions".
