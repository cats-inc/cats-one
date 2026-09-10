# System Architecture

## Current Launcher

`cats-one` is a Node.js npm entrypoint. It resolves the declared runtime and
platform packages, reuses a healthy runtime or starts a local one, waits for
health, and launches platform with forwarded arguments. It coordinates child
shutdown and fails when a runtime it started exits unexpectedly.

Package resolution uses installed npm dependencies, not arbitrary sibling source
imports. The current launcher does not create a source workspace or include a
developer workspace command. The repository-local skill helpers operate on one
project's `skills/` and discovery directories.

## Proposed Developer Workspace

[ADR-001](decisions/ADR-001-own-developer-workspace-bootstrap.md) proposes a second,
explicit developer entrypoint in the `cats-one` checkout. Tracked configuration
and templates describe the source workspace; generated files live in its parent.

```text
cats-one tracked manifest + root instruction template
  + each member's canonical maintenance skills
                        |
             explicit workspace sync
                        |
          developer-chosen non-Git parent
          |-- AGENTS.md
          |-- .agents/skills/       (Codex target)
          |-- .claude/skills/       (when selected)
          `-- .cats-workspace/      (ownership/recovery metadata)
```

The diagram is proposed behavior. These workspace outputs and the sync command
are not supplied by this planning change. [SPEC-001](specs/SPEC-001-developer-workspace-bootstrap.md)
defines the initial full-member profile, source discovery and conflict contract.

## Repository Responsibilities

| Repository | Responsibility |
|------------|----------------|
| cats-one | Current npm launch orchestration; proposed Cats development member definition, root guidance and skill aggregation |
| cats-runtime | Provider execution and telemetry; runtime-delivered skills and general product workspace-substrate tools; its own maintenance skills |
| cats-platform | Product/Desktop host, App SDK, App selection/install/load and Desktop packaging; its own maintenance skills |
| cats-apps | Official utility source and individually versioned `.catsapp` builds; its own maintenance skills when added |

The Cats developer profile does not supersede
[runtime ADR-015](../../cats-runtime/docs/decisions/015-own-workspace-substrate-tools-in-cats-runtime.md).
Generic project initialization, collaboration scaffolding and product-user
workspace APIs remain runtime-owned. This proposal assembles the existing Cats
source checkouts and their parent entrypoints only.

Recognizing `cats-apps` in the development manifest does not make its private npm
workspace a launcher dependency. Platform already consumes built, pinned App
artifacts; its App bundle lock remains authoritative for Desktop distribution.

## Distribution and Version Boundaries

Three different inputs have different owners:

- `cats-one`'s npm manifest/lock choose its installed launcher dependencies.
- The proposed developer manifest describes member paths and maintenance sources.
- Platform's Desktop App lock chooses exact App artifact versions and hashes.

Synchronizing developer instructions updates none of the package/release locks.
The launcher currently has a dependency-alignment follow-up, documented with a
dated local snapshot in SPEC-001. A successful workspace sync does not establish
release compatibility between independently checked-out revisions.

## Delivery

See [PLAN-001](plans/PLAN-001-developer-workspace-bootstrap.md) for read-only
inventory, managed apply and cross-platform validation phases, and
[PROGRESS.md](../PROGRESS.md) for implementation status.

*Last updated: 2026-09-11*
