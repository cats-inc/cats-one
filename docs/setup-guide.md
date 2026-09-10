# Developer Setup

## Requirements

Use Node.js 22+ and npm 12+. Product launcher usage is in the [README](../README.md).
The developer command requires all four sibling source checkouts:

```text
<chosen parent>/
  cats-one/       skills/
  cats-runtime/   developer-skills/
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

From the shared parent on Windows, macOS or Linux:

```sh
node ./cats-one/scripts/workspace.mjs --help
node ./cats-one/scripts/workspace.mjs sync --root . --agent codex --dry-run
node ./cats-one/scripts/workspace.mjs sync --root . --agent codex
node ./cats-one/scripts/workspace.mjs check --root . --agent codex
```

From cats-one, use `--root ..`. From elsewhere, provide both the script path and
an explicit parent path; quote paths containing spaces.

The default agent is `codex` (`.agents/skills`). Choose `claude`
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

Pull the relevant member's changes and rerun preview/sync. Edit canonical skill
sources or cats-one's manifest/template to share changes with other machines.
Platform's nested maintenance skills are discovered recursively; runtime's
separate product `skills/` library is excluded.

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
