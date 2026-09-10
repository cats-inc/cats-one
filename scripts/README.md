# Scripts

## Developer Workspace (Node.js)

`workspace.mjs` is a checkout-only, portable developer command. Prepare the
cats-one developer dependencies once with `npm ci --include=dev`.

From cats-one:

```sh
node scripts/workspace.mjs --help
node scripts/workspace.mjs sync --root .. --agent codex --dry-run
node scripts/workspace.mjs check --root .. --agent all
```

`--root` is required, with all four declared checkouts. The default target is
Codex. Phase 1 only inventories and previews; both commands write nothing.
`sync` without `--dry-run` fails until managed apply/recovery is implemented.
See [setup](../docs/setup-guide.md) for exit codes and conflict handling, and
[SPEC-001](../docs/specs/SPEC-001-developer-workspace-bootstrap.md) for schemas.

| Module | Responsibility |
| --- | --- |
| `workspace.mjs` | CLI validation, reporting and exit codes |
| `shared/workspace-fs.mjs` | Containment, unlinked paths and deterministic byte snapshots |
| `shared/workspace-inventory.mjs` | Manifest/member validation, YAML skill discovery and in-memory guidance |
| `shared/workspace-plan.mjs` | Ownership validation, read-only observation and pure action planning |
| `testing/workspace-fixtures.cjs` | Isolated test setup; never invoked by the developer command |

## Repository Helpers

`windows/` contains PowerShell helpers; `linux/` and `macos/` contain Bash
equivalents. The existing skill sync helpers target a single repository's
`skills/`, not the multi-repository workspace. Read each helper's help first.

Follow [script standards](../docs/SCRIPT-STANDARDS.md) for naming and help.
