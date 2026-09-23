# Progress

## Current Status

| Component | Status | Evidence / next step |
|-----------|--------|----------------------|
| npm runtime/platform launcher | Implemented | Existing `bin/cli.js`, `test/cli.test.js` and package CI |
| Interactive npm startup | Published | [PLAN-002](docs/plans/PLAN-002-interactive-cli-startup.md): automatic browser, o/q controls and ordered owned-service cleanup |
| Repository-local agent base layer | Implemented | Agent guidance, templates and single-project skill helpers from the bootstrap adoption |
| Developer workspace planning | Accepted for implementation | ADR-001 accepted; SPEC-001 and PLAN-001 track phased delivery |
| Developer workspace command | Phases 1–2 implemented | Inventory, check/preview, managed copies/ownership and interruption recovery |
| Launcher dependency alignment | Implemented for 0.1.24 | Minimum Platform 0.3.6 and Runtime 0.1.27 include Windows browser and Unix npm web-asset fixes; coordinated publication recorded in PLAN-002 |
| Unscoped npm alias release tooling | Implemented | Generated matching version/exact dependency, paired publish workflow and release checklist |
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

**Status**: implemented for cats-one 0.1.22; npm publication follows PR CI.

The 2026-09-23 alignment raises the Platform dependency from `^0.1.0` to
`^0.3.4` and Runtime from `^0.1.2` to `^0.1.25`. Publish both dependencies first,
then regenerate the lockfile from npm and verify the packed launcher before
publishing cats-one to `latest`. Workspace synchronization does not change these
production dependencies.

The npm publish workflow now installs locked developer dependencies before its
test gate, because workspace tests import YAML and proper-lockfile. Local
launcher contract validation passed all 17 tests, including authenticated Runtime
health probes. The launcher now sends `CATS_RUNTIME_API_KEY` during reuse checks
and startup polling, avoiding a 60-second timeout when the Runtime is healthy but
requires authentication. A packed-consumer check on Windows with Node 24/npm 12
installed the published dependencies into a fresh directory and home. Both
services became healthy; bundled management/catalog defaults loaded, an explicit
empty provider selection persisted, and Platform generated its session secret.
No provider commands ran or bulk config copies were created. The isolated
process tree stopped and released both ports. CI additionally gates the full
suite, Windows/macOS/Linux workspace matrix, and tarball resolution/startup/shutdown.

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

*Last updated: 2026-09-23*
