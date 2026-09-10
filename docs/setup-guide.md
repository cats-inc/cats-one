# Developer Setup

## Requirements

Use Node.js 22+ and npm 12+. Product launcher usage is in the [README](../README.md).
The developer command requires all four sibling source checkouts:

```text
<chosen parent>/
  cats-one/       skills/
  cats-runtime/   skills/
  cats-platform/  skills/
  cats-apps/      skills/
```

The parent can have any name and need not be a Git repository. Each member needs
its expected package name, `AGENTS.md`, Git metadata and declared skill root.
Empty roots and Git worktrees are supported. Source/output links and junctions
are rejected; ordinary ancestor aliases are normalized physically.

Install dependencies explicitly once in cats-one:

```sh
npm ci --include=dev
```

This prepares the directly declared YAML parser and writer-lock library.
Workspace commands then run offline without installing dependencies or starting
product services. Configuration, templates and dependencies resolve from the
executing cats-one checkout, which must be the member of the selected workspace.

## Generate, Preview and Check

After the one-time dependency setup, run the helper for your OS from `cats-one`:

| OS | Sync both agents and check, with no parameters |
| --- | --- |
| Windows (PowerShell 5.1 or 7) | `.\scripts\windows\Sync-WorkspaceSkills.ps1` |
| macOS | `./scripts/macos/sync-workspace-skills.sh` |
| Linux | `./scripts/linux/sync-workspace-skills.sh` |

The helpers find the workspace parent from their own location, regardless of the
calling shell's working directory. Outputs go beside `cats-one`, at the shared
parent. Both `.agents/skills` and `.claude/skills` are synchronized by default,
followed by a check; a failed sync stops before the check. Node exit codes are
preserved. The Bash scripts are committed as executable (`100755`).

For a read-only preview, add `-WhatIf` on Windows or `--dry-run` on Bash.
For a read-only check, add `-Check` or `--check`. Help is available with
`-Help` or `--help` without Node or installed dependencies. Check and preview
cannot be combined. These helpers do not install dependencies automatically.

If running from the shared parent, prefix the helper path with `cats-one/`.
For example, on Windows: `.\cats-one\scripts\windows\Sync-WorkspaceSkills.ps1`.

The explicit Node interface remains available for choosing a single agent.
From the shared parent on Windows, macOS or Linux:

```sh
node ./cats-one/scripts/workspace.mjs --help
node ./cats-one/scripts/workspace.mjs sync --root . --agent codex --dry-run
node ./cats-one/scripts/workspace.mjs sync --root . --agent codex
node ./cats-one/scripts/workspace.mjs check --root . --agent codex
```

From cats-one, use `--root ..`. From elsewhere, provide both the script path and
an explicit parent path; quote paths containing spaces.

The Node interface defaults to `codex` (`.agents/skills`). Choose `claude`
(`.claude/skills`) or `all` for both. Root `AGENTS.md` is shared. Sync copies
complete skills/resources and writes `.cats-workspace/managed.json` to record
ownership. The tool maintains ownership and recovery files; do not create or
maintain them manually.

| Exit | Meaning |
| --- | --- |
| 0 | Successful sync/preview, or a check with matching content and ownership |
| 1 | Check found drift, including missing outputs or adoption |
| 2 | Invalid input, conflict, active/interrupted apply or filesystem error |

`check` and `sync --dry-run` never create files, acquire a lock or repair state.
A fresh workspace normally previews `create` actions and checks with exit `1`.
After sync, a repeat with unchanged inputs/outputs performs no writes.

## Pulling Changes and Resolving Conflicts

Pull the relevant member's changes and rerun the same OS helper. If cats-one's
dependency lockfile changed, run `npm ci --include=dev` in cats-one first.
Edit canonical skill sources or cats-one's manifest/template to share changes
with other machines.
Platform's nested maintenance skills are discovered recursively; runtime's
separate product `runtime-skills/` library is excluded.

All four members use `skills/` for developer skills. Workspaces synchronized
before the 2026-09-11 directory alignment may record the runtime maintenance
package's former `developer-skills/` source. Normal sync updates that one known
ownership entry through existing digest checks and journal recovery. Edited
mirrors still conflict; the retired source is never scanned. No manual ownership
file edits or directory cleanup are needed.

A custom root `AGENTS.md`, different unmanaged target skill, or locally edited
managed entry is a conflict. Reconcile those edits with tracked sources, or save
the personal copy outside the generated destination before retrying. There is no
force or blanket-clean option. Unrelated skills and unselected agents are retained.
Byte-identical unmanaged content reports `adopt`; sync then takes ownership,
including responsibility for future scoped cleanup.

Missing checkouts or canonical roots are errors. Correct the layout before
retrying; absence is never treated as permission to remove their managed skills.

## Interrupted Sync

Rerun the same `sync` command. It restores an uncommitted operation or completes
cleanup after a committed operation, then plans the current source state.
Ordinary caught failures attempt recovery immediately. Forced termination can
leave an active-looking writer lock for up to 30 seconds; retry after that interval.
Do not delete the lock or edit ownership/recovery records to bypass it.

A second concurrent writer fails while the first writer owns the lock.
Preview/check report pending recovery without performing it. Recovery refuses
locally changed outputs/backups, malformed records and unsafe paths, preserving
the files and journal for deliberate conflict resolution.

The [specification](specs/SPEC-001-developer-workspace-bootstrap.md) describes
the journal, commit marker and restartable trash cleanup. These are generated
implementation state; routine setup needs only the sync command.

## Agent Discovery

Generated root guidance routes work to each member's rules and canonical skills.
Use a parent-root agent session for the aggregated setup; repository-local sessions
retain their own setup. Live host discovery is separate from the tested filesystem
mirrors, and changing a shell command's working directory does not reload an active
conversation's skills.

The existing repository PowerShell/Bash helpers remain single-project commands.
Do not compose them against a shared destination.

*Last updated: 2026-09-11*
