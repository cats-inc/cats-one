# PLAN-001: Developer Workspace Bootstrap

## Metadata

| Field | Value |
|-------|-------|
| Status | Phases 1–2 implemented; live-host discovery validation pending |
| Owner | cats-one maintainers |
| Implementation assignment | Codex, requested by the repository owner on 2026-09-11 |
| Review | Owner approved implementation; repository CI is the merge gate |

## Related Spec

[SPEC-001: Developer Workspace Bootstrap](../specs/SPEC-001-developer-workspace-bootstrap.md)
defines the command and acceptance contract. [ADR-001](../decisions/ADR-001-own-developer-workspace-bootstrap.md)
records the accepted ownership boundary. The owner requested implementation
after the planning PR merged. Inventory/planning and managed apply/recovery are
implemented; live-host discovery remains an explicit, separate validation item.

## Overview

Build a narrowly scoped developer command in `cats-one` that reads the declared
Cats checkouts, computes one desired workspace view, previews it, then reconciles
only its managed root outputs. Keep discovery, planning and mutation separable
so check mode uses the same decisions without writing.

## Implementation Phases

### Phase 0: Planning package

- [x] Inspect current launcher, repository helpers, canonical skill roots and
  runtime/platform/apps ownership records.
- [x] Draft ADR-001, SPEC-001 and this plan.
- [x] Connect README, project status, architecture and document indexes.

**Deliverable**: A reviewable proposal. No workspace command or generated parent
files are created in this phase.

### Phase 1: Manifest and read-only inventory

- [x] Add the four-member manifest and root routing template at the proposed
  paths below. State schema/validation rules in the spec when implementation
  resolves details.
- [x] Add a Node.js checkout command with `--help`, explicit `--root`, selected
  agent targets and unknown-argument rejection.
- [x] Validate member identity, `.git` directory/file checkouts, source roots and
  physical containment before any output planning.
- [x] Implement recursive skill discovery with leaf boundaries, proposal
  exclusion, frontmatter validation, deterministic digests and collision errors.
- [x] Select an existing YAML parser and declare it as a direct development
  dependency in cats-one with a matching lockfile update. Document explicit
  one-time setup; sync stays offline, never runs npm install and never imports
  a sibling implementation or dependency tree.
- [x] Implement a pure desired-state/action planner with read-only `check` and
  `sync --dry-run`, including empty and missing destination cases.

**Deliverable**: Inspectable actions and exit codes with no filesystem writes.
Cover AC-2, AC-4, AC-6 and the read-only part of AC-8 using isolated fixtures.

### Phase 2: Managed materialization and recovery

- [x] Materialize the in-memory root instructions and complete skill directory copies.
- [x] Add the workspace-specific ownership record, separate from repository
  helper manifests; retain per-agent records when syncing one target.
- [x] Implement all destination states in SPEC-001, including visible adoption,
  locally edited generated files, absent sources and scoped stale-entry cleanup.
- [x] Preflight all selected targets before any writes. Never execute the sibling
  sync helpers with a shared destination or mutate member checkouts.
- [x] Serialize writers and detect changes since inventory before replacement;
  another sync or concurrent source edit must not silently invalidate the plan.
- [x] Implement bounded staging, a durable recovery record and per-output
  replacement/rollback. Validate recovery paths with the same containment rules.
  Inject failures between replacement and metadata commit, including cleanup.
- [x] On a subsequent sync, report and recover an interrupted operation before
  planning new changes. Check/preview must report pending recovery without
  performing it. Never delete an entire discovery directory.
- [x] Prove no-op synchronization leaves content and metadata unchanged.

**Deliverable**: Repeatable generation/update with conflict protection and
recoverable failures. Cover AC-1, AC-3, AC-5, AC-7, AC-8 and AC-9.

### Phase 3: Cross-platform validation and developer handoff

- [x] Introduce read-only fixture coverage in `test/` and a Windows/macOS/Linux
  Node 22/24 CI matrix during Phase 1, without sibling checkouts or live services.
- [x] Extend that matrix to managed apply and recovery.
- [x] Use fake package manifests and canonical skills under OS-native temporary
  roots. Exercise worktrees, different root names, Unicode/spaces, missing
  members, duplicate names, resource copies and linked paths where supported.
- [x] Verify the existing launcher contract and npm package allowlist still
  exclude checkout-only developer tooling and generated files.
- [x] Write executable setup/update/check instructions only after the command
  exists. Explain how to resolve custom-root-file conflicts and rerun sync after
  pulling changes to any member's canonical skills.
- [x] Add no-argument Windows/macOS/Linux helpers that locate the workspace from
  the script, sync both agents and check automatically; preserve read-only modes,
  failure codes and Bash executable permissions.
- [ ] Validate Codex discovery in a temporary parent-root session with generated
  test skills. For Claude, verify the selected filesystem mirror; claim live
  discovery only if that host has actually been tested.
- [x] Record commands, configured OS coverage and unavailable live-host checks.
- [x] Use the repository PR/CI merge workflow; author tests are not independent review.

**Deliverable**: AC-10 and AC-11 evidence, current documentation and a completed
SPEC-001 checklist. Fixtures never write to the user's real workspace or state.

## Files to Create or Modify During Implementation

The implementation supplies manifest/template, CLI, inventory/planning, safe
filesystem writes, journal/recovery and behavioral/fault tests. The Node command
is the portable implementation; OS wrappers provide the requested no-argument workflow.

| Path relative to cats-one | Action | Responsibility |
|--------------------------|--------|----------------|
| `config/developer-workspace.json` | Create | Versioned Cats member/source definition |
| `templates/workspace/AGENTS.md.template` | Create | Small parent-level routing document |
| `scripts/workspace.mjs` | Create | CLI and explicit sync/check dispatch |
| `scripts/windows/Sync-WorkspaceSkills.ps1`, `scripts/{linux,macos}/sync-workspace-skills.sh` | Create | No-argument sync and check for both agents, with script-relative workspace discovery |
| `scripts/shared/workspace-*.mjs` | Create as needed | Inventory, planning and managed apply |
| `package.json`, `package-lock.json` | Update in Phases 1–2 | Direct YAML/writer-lock development dependencies; retain production dependency ranges and npm files allowlist |
| `test/workspace-*.test.js` | Create | Behavioral fixture coverage using node:test |
| `.github/workflows/ci.yml` | Update | Isolated cross-platform workspace checks |
| `docs/setup-guide.md`, `docs/testing.md`, `scripts/README.md` | Update | Actual developer commands and verified behavior |
| `README.md`, `AGENTS.md`, `PROGRESS.md`, `ROADMAP.md`, planning indexes | Update | Accurate implementation status and entrypoints |

Generated parent outputs are `AGENTS.md`, selected `.agents/skills/` and/or
`.claude/skills/` entries, and `.cats-workspace/` ownership/recovery metadata.
They are not committed as copies in `cats-one` or another member repository.

## Technical Decisions

### 2026-09-11 Developer directory alignment

The owner approved using `skills/` in every member, following project-bootstrap.
Runtime's shipped product library moves to `runtime-skills/`; the manifest,
inventory profile, fixtures and generated guidance follow that separation.
Existing recorded provenance for the one relocated runtime maintenance package
is reconciled with existing digest/conflict checks and journal recovery.

- [x] Align the four source roots and exclude the new runtime product root.
- [x] Cover existing ownership relocation, single-agent selection and edited mirrors.
- [x] Complete focused/full workspace validation and refresh the real parent workspace.

Validation: `npm test` passed 97 tests with two filesystem-specific skips (99
total) on Windows. The real OS helper migrated the recorded runtime source,
updated parent guidance and both affected mirrors, then passed its automatic
read-only check with all seven outputs unchanged. Independent review found no
remaining code issues after fixes. No live-host discovery is claimed by this
directory change.

- Use one inventory and reconciliation plan for all members to avoid one repo's
  cleanup removing another repo's skills.
- Read current canonical content, not generated mirrors; copy resources intact.
- Keep the explicit full four-member profile for v1. An absent required checkout
  fails before cleanup; empty declared skill roots succeed.
- Record relative provenance and content digests. Synchronization does not select
  commits, enforce exact CLI versions or rewrite npm/App lockfiles.
- Scope the implementation to Cats checkout composition. General workspace
  substrate work remains behind the runtime-owned API described by ADR-015.
- Use fixed writer lease settings and the recovery/commit/trash protocol documented
  in SPEC-001. Incomplete staging, rollback and cleanup must all survive process
  termination. Never treat a partial ownership write as a completed operation.
- Keep this command out of `bin/cli.js` because that entrypoint already forwards
  platform arguments. Developer tooling does not run implicitly during npm install
  or normal product startup.

## Testing Strategy

Map tests to SPEC-001 acceptance IDs. Use real temporary files for copying,
conflict handling, stale cleanup and failure recovery, and process-spawn tests
for CLI exit codes and read-only behavior. Snapshot the complete temporary tree
before and after check/preview to detect unintended writes.

Run the narrow workspace suite while implementing it, then the existing
`npm test` gate. Keep platform/App package builds and live provider probes outside
this feature's tests. Review generated instruction text for correct member
routing in addition to testing the file operations.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Existing root AGENTS or mirrors contain personal edits | Digest-based ownership, full conflict preflight and no force mode |
| Shallow helper misses platform's nested skills | Recursive inventory directly from declared canonical roots |
| One sync removes another source/agent's entries | Single workspace manifest with per-source/per-target ownership |
| Failure leaves ambiguous state | Staged replacements and tested recovery before ownership commit |
| Root setup is mistaken for a product workspace scaffold | Fixed Cats membership, explicit write scope and runtime ADR-015 boundary |
| Current launcher's installed packages lag sibling source | Separate dependency-alignment work package with consumer validation |

## Follow-up Work Packages

| Work | Owner | Dependency and scope |
|------|-------|----------------------|
| Launcher dependency alignment | cats-one | Independently verify published versions, select compatible runtime/platform releases, update manifest and lock together, and run package-resolution/startup/shutdown checks in isolation |
| Platform repository-local skill helper | cats-platform | Correct nested discovery and ownership-aware cleanup in a separate change; not a prerequisite for canonical workspace aggregation |
| Cross-repository build/dev orchestration | cats-one | After workspace sync is proven; compose existing member commands with explicit working directories |
| Desktop/App release coordination | cats-one + platform/apps owners | Compose built App artifacts and platform packaging later; keep authoritative App selection/install behavior in platform |

The dependency-alignment package must verify registry availability and run
isolated consumer checks before changing the manifest and lockfile together.
The 2026-09-23 follow-through targets Platform `^0.3.4` and Runtime `^0.1.25` for
cats-one 0.1.22; current delivery evidence is in `PROGRESS.md` WP-2. Dependency
alignment remains separate from skill synchronization.

## Progress Log

| Date | Update |
|------|--------|
| 2026-09-11 | Planning PR #4 merged; owner requested implementation. |
| 2026-09-11 | Implemented Phase 1: schema v1, routing template, direct yaml dependency, recursive inventory, ownership preflight and pure read-only action planning. |
| 2026-09-11 | Phase 1 Windows full suite: 61 pass, one filesystem-dependent skip. Offline npm payload has only the four allowed files; real-parent preview finds three skills. Node 22/24 OS matrix added. |
| 2026-09-11 | Implemented managed copies/ownership, fixed writer locking, journal/commit markers, restartable rollback and trash cleanup. Windows full suite: 85 pass, two filesystem-specific skips (87 total, including 24 apply/recovery tests). Offline package inspection passes. See the implementation PR for OS-matrix results. Live-host discovery remains pending. |
| 2026-09-11 | Added the requested Windows/macOS/Linux no-argument sync/check entrypoints for both agents. Windows full suite: 95 pass, two filesystem-specific skips (97 total), including ten PowerShell 5.1/7 wrapper tests. Both Bash scripts pass syntax checks, are tracked as executable and are directly exercised in the OS matrix. |

*Created: 2026-09-11*
