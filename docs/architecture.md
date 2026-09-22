# System Architecture

## Current Launcher

`cats-one` is a Node.js npm entrypoint. It resolves the declared runtime and
platform packages, reuses a healthy runtime or starts a local one, waits for
health, and launches platform with forwarded arguments. It coordinates child
shutdown and fails when a runtime it started exits unexpectedly.
Health probes authenticate with `CATS_RUNTIME_API_KEY` when configured, including
both reuse checks and startup polling; child services receive the same key.

Platform owns the interactive terminal and opens its browser URL after its own
listener is ready. Runtime children are app-managed and never open a second page.
The launcher requests Platform cleanup through private Node IPC, waits for its
exit, then ends its Runtime child's private stdin pipe. Both services reuse their
existing shutdown routines; a reused Runtime is outside the launcher's ownership.
Normal exit, startup cancellation and child failure share this bounded shutdown.
See [SPEC-002](specs/SPEC-002-interactive-cli-startup.md) for the three-entrypoint
contract and terminal/automation opt-outs.

Package resolution uses installed npm dependencies, not arbitrary sibling source
imports. Developer workspace tooling has its own checkout entrypoint at
`scripts/workspace.mjs`. The repository-local skill helpers operate on one
project's `skills/` and discovery directories.

## Developer Workspace

[ADR-001](decisions/ADR-001-own-developer-workspace-bootstrap.md) defines a second,
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

The manifest, canonical inventory and rendered template feed a pure action
planner. `check` and `sync --dry-run` report that plan without writes. `sync`
preflights conflicts, acquires one workspace writer lock, records the operation,
stages copies, replaces individual outputs, and commits ownership last.

An explicit commit marker distinguishes fully applied output from interrupted
work, even when ownership bytes happen to remain equal. The next sync rolls back
an uncommitted operation or finishes committed cleanup before planning again.
Backups and disposable trash keep both rollback and cleanup restartable.
[SPEC-001](specs/SPEC-001-developer-workspace-bootstrap.md) defines these schemas
and the full-member, discovery and conflict contracts.

## Repository Responsibilities

| Repository | Responsibility |
|------------|----------------|
| cats-one | npm launch orchestration; Cats development member definition, root guidance and managed maintenance-skill aggregation |
| cats-runtime | Provider execution and telemetry; runtime-delivered skills and general product workspace-substrate tools; its own maintenance skills |
| cats-platform | Product/Desktop host, App SDK, App selection/install/load and Desktop packaging; its own maintenance skills |
| cats-apps | Official utility source and individually versioned `.catsapp` builds; its own maintenance skills when added |

The Cats developer profile does not supersede
[runtime ADR-015](../../cats-runtime/docs/decisions/015-own-workspace-substrate-tools-in-cats-runtime.md).
Generic project initialization, collaboration scaffolding and product-user
workspace APIs remain runtime-owned. This developer feature composes the existing Cats
source checkouts and their parent entrypoints only.

Recognizing `cats-apps` in the development manifest does not make its private npm
workspace a launcher dependency. Platform already consumes built, pinned App
artifacts; its App bundle lock remains authoritative for Desktop distribution.

## Distribution and Version Boundaries

Three different inputs have different owners:

- `cats-one`'s npm manifest/lock choose its installed launcher dependencies.
- The developer manifest describes member paths and maintenance sources.
- Platform's Desktop App lock chooses exact App artifact versions and hashes.

Synchronizing developer instructions updates none of the package/release locks.
The 0.1.22 npm alignment requires Platform `^0.3.4` and Runtime `^0.1.25`.
Publish both dependencies before regenerating the launcher's lockfile from the
registry and publishing cats-one. The npm publish workflow installs the locked
dependencies, including developer test dependencies, before its test gate.
CI also checks the packed launcher's package resolution and isolated startup.
A successful workspace sync does not establish release compatibility between
independently checked-out revisions.

The unscoped `cats-one` npm package is a separate public entrypoint. Its generated
manifest takes the root version and pins `@cats-inc/cats-one` to that exact
version. The npm publish workflow releases the canonical package and alias
together; both registry versions must be verified. See [deployment](deployment.md)
for the release checklist and recovery of an omitted alias.

## Delivery

See [PLAN-001](plans/PLAN-001-developer-workspace-bootstrap.md) for inventory,
managed apply and cross-platform validation phases, and
[PROGRESS.md](../PROGRESS.md) for implementation status.

*Last updated: 2026-09-23*
