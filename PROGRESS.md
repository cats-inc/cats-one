# Progress

## Current Status

| Component | Status | Evidence / next step |
|-----------|--------|----------------------|
| npm runtime/platform launcher | Implemented | Existing `bin/cli.js`, `test/cli.test.js` and package CI |
| Repository-local agent base layer | Implemented | Agent guidance, templates and single-project skill helpers from the bootstrap adoption |
| Developer workspace planning | Accepted for implementation | ADR-001 accepted; SPEC-001 and PLAN-001 track phased delivery |
| Developer workspace command | Phase 1 implemented | Manifest/template, inventory and read-only check/preview; managed apply/recovery pending |
| Launcher dependency alignment | Follow-up identified | Declared/locked package versions need a separate compatibility assessment |
| Cross-repository build/dev and release coordination | Deferred | Outside the first workspace synchronization slice |

## WP-1: Developer Workspace Bootstrap

**Owner**: cats-one maintainers. **Implementation**: Phase 1 delivered; Phase 2 next.

- [x] Identify the four member repositories and their canonical skill roots.
- [x] Record ownership boundaries, requirements, acceptance criteria and phases.
- [x] Implement manifest validation and read-only inventory/check/preview.
- [ ] Implement generated root instructions and managed skill reconciliation.
- [ ] Validate failure recovery, cross-platform behavior and parent-root discovery.
- [x] Publish Phase 1 setup/testing instructions and isolated fixture evidence.

Use [PLAN-001](docs/plans/PLAN-001-developer-workspace-bootstrap.md) for the
detailed task checklist and [SPEC-001](docs/specs/SPEC-001-developer-workspace-bootstrap.md)
for acceptance criteria. Documentation delivery does not mark those criteria met.

## WP-2: Launcher Dependency Alignment

**Status**: follow-up; production dependency ranges and resolved versions are unchanged.

The 2026-09-11 local snapshot shows platform declared as `^0.1.0`, locked at
`0.1.1`, and checked out at `0.2.3`; runtime is declared as `^0.1.2`, locked at
`0.1.2`, and checked out at `0.1.21`. Assess published artifacts and compatibility
separately before updating both package files and running isolated consumer tests.

## Phase 1 Delivery

The 2026-09-11 implementation adds tracked member definitions, a routing template
and `scripts/workspace.mjs`. It validates all four members, inventories maintenance
skills recursively, and reports create/update/remove/unchanged/adopt/conflict
actions without writing. YAML is a direct development dependency; npm's product
payload and launcher contract remain unchanged.

Windows fixture coverage validates read-only behavior, ownership conflicts,
worktrees, resources and unsafe inputs. CI adds Node 22/24 on Windows/macOS/Linux.
Managed apply, durable recovery and live parent-session discovery remain pending.
See [testing](docs/testing.md) and the implementation PR for verification evidence.

*Last updated: 2026-09-11*
