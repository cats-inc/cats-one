# Roadmap

## Direction

Keep `cats-one` as the Cats ecosystem entrypoint and deliver a reproducible
developer workspace for its source repositories. Preserve the runtime, platform
and official-app boundaries described in [architecture](docs/architecture.md).

## Existing Foundation

- [x] npm launcher that starts/reuses runtime and launches platform.
- [x] Launcher contract tests and package/consumer CI.
- [x] Repository-local agent guidance and base documentation/skill-sync helpers.

## Next: Developer Workspace Bootstrap

Planning is recorded in [ADR-001](docs/decisions/ADR-001-own-developer-workspace-bootstrap.md),
[SPEC-001](docs/specs/SPEC-001-developer-workspace-bootstrap.md), and
[PLAN-001](docs/plans/PLAN-001-developer-workspace-bootstrap.md).

- [x] Prepare the ownership proposal, behavior contract and implementation plan.
- [x] Define all four members and root routing instructions in tracked inputs.
- [x] Add read-only check/preview with conflict and provenance reporting.
- [x] Enable repeatable local synchronization with apply/recovery validation.
- [x] Preserve custom files, reconcile managed entries and verify failure recovery.
- [x] Cover Windows/macOS/Linux in CI and document setup on another machine.
- [ ] Validate live parent-root discovery in an agent-host session.

## Separate Follow-ups

- [ ] Assess and align launcher's installed runtime/platform dependencies.
- [ ] Coordinate cross-repository build/dev commands after workspace sync is proven.
- [ ] Evaluate partial/custom checkout profiles when an actual workflow needs them.
- [ ] Evaluate npm distribution of developer tooling after the checkout command
  has a stable contract.
- [ ] Coordinate Desktop/App build inputs through the existing member interfaces;
  platform retains authoritative App selection, installation and packaging.

These items have no promised release date and are not prerequisites hidden inside
the initial instruction/skill synchronization feature.

*Last updated: 2026-09-11*
