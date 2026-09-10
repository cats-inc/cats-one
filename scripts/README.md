# Scripts

## Developer Workspace (Node.js)

`workspace.mjs` is a checkout-only developer command. Prepare dependencies with
`npm ci --include=dev` in cats-one, then run from that checkout:

```sh
node scripts/workspace.mjs --help
node scripts/workspace.mjs sync --root .. --agent codex --dry-run
node scripts/workspace.mjs sync --root .. --agent codex
node scripts/workspace.mjs check --root .. --agent all
```

`--root` requires all four declared checkouts. Codex is the default target.
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

`windows/` contains PowerShell helpers; `linux/` and `macos/` contain Bash
equivalents. Their existing skill sync helpers target one repository's
`skills/`. Read each helper's help before running it.

Follow [script standards](../docs/SCRIPT-STANDARDS.md) for naming and help.
