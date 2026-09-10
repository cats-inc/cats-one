# Developer Setup

## Requirements

Use Node.js 22+ and npm 12+. Product launcher usage is in the [README](../README.md).
The developer workspace command runs from a cats-one source checkout and requires
all four sibling checkouts, regardless of which agent mirror is selected:

```text
<chosen parent>/
  cats-one/       skills/
  cats-runtime/   developer-skills/
  cats-platform/  skills/
  cats-apps/      skills/
```

The parent can have any name and need not be a Git repository. Each member must
have its expected package name, `AGENTS.md`, Git metadata and declared skill root.
Empty skill roots are valid. Git worktrees with a `.git` file are supported.
Source/output links and junctions are rejected in this initial copy-oriented mode.

Install developer dependencies explicitly once in the cats-one checkout:

```sh
npm ci --include=dev
```

This provides the directly declared `yaml` parser. Subsequent workspace commands
run offline, without installing dependencies or starting services. They resolve
configuration, templates and dependencies from their own cats-one checkout.

## Preview and Check

From the shared parent, on Windows, macOS or Linux:

```sh
node ./cats-one/scripts/workspace.mjs --help
node ./cats-one/scripts/workspace.mjs sync --root . --agent codex --dry-run
node ./cats-one/scripts/workspace.mjs check --root . --agent codex
```

From cats-one itself, use `--root ..`. From elsewhere, give the script path and
an explicit parent path; quote paths containing spaces. The executing cats-one
checkout must be the member of the selected root.

`--agent` defaults to `codex` (`.agents/skills`). Choose `claude`
(`.claude/skills`) or `all` for both. Root `AGENTS.md` is shared and always
included. Output lists each planned path, action and canonical source owner.

| Exit | Meaning |
| --- | --- |
| 0 | Successful preview, or a check with matching content and ownership |
| 1 | Check found drift, including missing outputs or adoption |
| 2 | Invalid input, conflict, active/interrupted apply or filesystem error |

Both available commands are strictly read-only, even when destinations and
metadata do not exist. A fresh workspace therefore normally previews `create`
actions and returns `1` from `check`. Phase 1 does not install discovery copies:
`sync` without `--dry-run` currently fails with a clear error. Managed writes and
recovery will arrive in [PLAN-001 Phase 2](plans/PLAN-001-developer-workspace-bootstrap.md).

## Updating Sources and Resolving Reports

Pull the relevant member's changes and rerun the preview. Edit canonical skill
sources or cats-one's manifest/template to share changes across development
machines. Keep skill-local resources in the skill directory; platform's nested
skills are discovered recursively. Runtime's product `skills/` is excluded.

A different existing root `AGENTS.md` or unmanaged target skill is a conflict.
Reconcile personal changes deliberately with the tracked sources, or preserve
the personal copy outside the generated destination before a future apply.
Locally edited managed entries also conflict, including entries whose source was
removed. A byte-identical unmanaged destination reports `adopt`: a future apply
would take ownership of it. Preview itself never adopts or overwrites files.

Missing members or skill roots are errors, not evidence that stale copies should
be removed. Correct the checkout layout before retrying. Unknown/malformed
ownership records fail; do not hand-edit metadata to bypass a conflict.
An active writer or pending recovery record is reported without repair.

The existing per-repository PowerShell/Bash helpers remain single-project
commands. Do not run them against a shared destination to compose this workspace.

*Last updated: 2026-09-11*
