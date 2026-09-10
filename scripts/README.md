# Scripts

## Developer Workspace

Prepare dependencies once with `npm ci --include=dev` in cats-one. From that
checkout, use the helper for your OS with no parameters:

| OS | Sync both agents, then check |
| --- | --- |
| Windows | `.\scripts\windows\Sync-WorkspaceSkills.ps1` |
| macOS | `./scripts/macos/sync-workspace-skills.sh` |
| Linux | `./scripts/linux/sync-workspace-skills.sh` |

These wrappers infer the workspace parent from their script location and invoke
`workspace.mjs` with an explicit root and `--agent all`. They preserve failure
codes and skip the follow-up check when sync fails. Add `-WhatIf` / `--dry-run`
to preview, `-Check` / `--check` to check only, or `-Help` / `--help` for usage.
They never install dependencies or start services. Bash files are tracked with
executable mode `100755` and can be invoked directly.

### Explicit Node Interface

`workspace.mjs` is a checkout-only developer command. Prepare dependencies with
`npm ci --include=dev` in cats-one, then run from that checkout:

```sh
node scripts/workspace.mjs --help
node scripts/workspace.mjs sync --root .. --agent codex --dry-run
node scripts/workspace.mjs sync --root .. --agent codex
node scripts/workspace.mjs check --root .. --agent all
```

`--root` requires all four declared checkouts. Codex is the Node CLI's default;
the OS wrappers select both agents.
Sync materializes copies/ownership and recovers interrupted work; check and
dry-run write nothing. See [setup](../docs/setup-guide.md) for usage and
[SPEC-001](../docs/specs/SPEC-001-developer-workspace-bootstrap.md) for schemas.

| Module | Responsibility |
| --- | --- |
| `workspace.mjs` | CLI dispatch, reporting and exit codes |
| `shared/workspace-fs.mjs` | Containment, unlinked paths and deterministic snapshots |
| `shared/workspace-inventory.mjs` | Member validation, YAML discovery and routing text |
| `shared/workspace-plan.mjs` | Ownership validation, observation and pure planning |
| `shared/workspace-write.mjs` | Validated filesystem writes, moves and bounded removal |
| `shared/workspace-apply.mjs` | Writer lease, revalidation, staged apply and ownership commit |
| `shared/workspace-recovery.mjs` | Journal validation, rollback and restartable cleanup |
| `testing/workspace-fixtures.cjs` | Isolated test setup |
| `testing/workspace-sync-child.mjs` | Test-only process termination/lock driver |

## Repository Helpers

`windows/Sync-AgentSkills.ps1` and the `sync-agent-skills.sh` Bash equivalents
target one repository's `skills/`. Use the new `Sync-WorkspaceSkills.ps1` /
`sync-workspace-skills.sh` helpers above for the four-repository parent workspace.
Read each helper's help before running it.

Follow [script standards](../docs/SCRIPT-STANDARDS.md) for naming and help.
