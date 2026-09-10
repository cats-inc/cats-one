# Progress

## Current Status

| Component | Status | Evidence / next step |
|-----------|--------|----------------------|
| npm runtime/platform launcher | Implemented | Existing `bin/cli.js`, `test/cli.test.js` and package CI |
| Repository-local agent base layer | Implemented | Agent guidance, templates and single-project skill helpers from the bootstrap adoption |
| Developer workspace planning | Accepted for implementation | ADR-001 accepted; SPEC-001 and PLAN-001 track phased delivery |
| Developer workspace command | Phases 1–2 implemented | Inventory, check/preview, managed copies/ownership and interruption recovery |
| Launcher dependency alignment | Follow-up identified | Declared/locked package versions need a separate compatibility assessment |
| Cross-repository build/dev and release coordination | Deferred | Outside the first workspace synchronization slice |

## WP-1: Developer Workspace Bootstrap

**Owner**: cats-one maintainers. **Implementation**: Phases 1–2 delivered; live-host discovery validation remains.

- [x] Identify the four member repositories and their canonical skill roots.
- [x] Record ownership boundaries, requirements, acceptance criteria and phases.
- [x] Implement manifest validation and read-only inventory/check/preview.
- [x] Implement generated root instructions and managed skill reconciliation.
- [x] Cover forced process termination, restartable recovery/cleanup and writer exclusion.
- [ ] Validate live parent-root skill discovery in an agent-host session.
- [x] Publish sync/check/setup instructions and isolated fixture evidence.
- [x] Add no-argument Windows/macOS/Linux sync-and-check helpers for both agents,
  with script-relative root discovery and executable Bash entrypoints.

Use [PLAN-001](docs/plans/PLAN-001-developer-workspace-bootstrap.md) for the
detailed task checklist and [SPEC-001](docs/specs/SPEC-001-developer-workspace-bootstrap.md)
for acceptance criteria. Documentation delivery does not mark those criteria met.

## WP-2: Launcher Dependency Alignment

**Status**: follow-up; production dependency ranges and resolved versions are unchanged.

The 2026-09-11 local snapshot shows platform declared as `^0.1.0`, locked at
`0.1.1`, and checked out at `0.2.3`; runtime is declared as `^0.1.2`, locked at
`0.1.2`, and checked out at `0.1.21`. Assess published artifacts and compatibility
separately before updating both package files and running isolated consumer tests.

## Workspace Delivery

The 2026-09-11 implementation adds tracked member definitions, a routing template
and `scripts/workspace.mjs`. It validates all four members, inventories maintenance
skills recursively, and previews/applies create/update/remove/adopt actions with
conflict protection. Sync preserves resources and executable permissions,
maintains stable ownership, serializes writers and recovers interrupted work.
YAML and proper-lockfile are direct development dependencies; npm's product
payload and launcher contract remain unchanged.

`Sync-WorkspaceSkills.ps1` and the Linux/macOS `sync-workspace-skills.sh` helpers
now provide the routine workflow without root/agent arguments. They synchronize
both agents, check after success, and preserve the Node CLI's failure codes.

Fixtures cover read-only behavior, ownership conflicts, worktrees, resources,
unsafe inputs, forced termination at multiple transaction boundaries, interrupted
cleanup and concurrent writers. CI runs the same workspace suites on Node 22/24
on Windows/macOS/Linux. Live parent-session discovery remains pending.
See [testing](docs/testing.md) and the implementation PR for verification evidence.

*Last updated: 2026-09-11*
