# Testing

## Commands

Prepare checkout dependencies with `npm ci --include=dev`, then run:

```sh
npm test
```

For the complete workspace suites:

```sh
node --test test/workspace-inventory.test.js test/workspace-cli.test.js test/workspace-apply.test.js test/workspace-wrappers.test.js
```

Tests use Node's built-in runner. CLI, crash and lock tests need permission to
create child processes. A sandbox `spawn EPERM` is not a test assertion failure.

## Fixture and Fault Coverage

Fixtures use fake member manifests, Git metadata and canonical skills beneath
OS-native temporary parents with spaces and Unicode. They never write the user's
real member checkouts, agent folders or product services. Each fixture is removed
after its test.

| Acceptance | Evidence |
| --- | --- |
| AC-1 / AC-3 | Root guidance, full resource/empty-directory copies, ownership and executable permissions |
| AC-2 | Three nested maintenance skills, empty roots, excluded proposals/product library |
| AC-4 | Equal desired contents/digests under different parent paths/timestamps |
| AC-5 | No-op byte/mtime snapshots, changed sources, new names, removal, adoption and missing mirrors |
| AC-6 / AC-7 | Invalid identity/YAML/metadata, unsafe paths, links, custom files, local edits and unselected-agent preservation |
| AC-8 | Entire temporary-tree snapshots around read-only paths, CLI exit codes and interrupted-state reporting |
| AC-9 | Forced termination, repeated recovery, partial staging/trash, ownership commit, concurrent edits and separate-process writer exclusion |

The test driver lives in `scripts/testing/workspace-sync-child.mjs`; production
CLI flags never expose fault injection. Tests kill their own child process with
SIGKILL after selected journal, stage, backup, replacement, ownership, commit and
cleanup checkpoints. After confirming the child is dead, fixtures backdate its
lock to exercise stale-lock acquisition without a 30-second test delay.

A subsequent sync must restore original outputs before retrying, or finish the
committed cleanup, with no lost unrelated files. Recovery is also interrupted and
resumed. A concurrent-edit test checks that an adopted output is not recorded as
owned after it changes before commit.

Windows and case-insensitive macOS skip a two-case-only-resource-filenames fixture.
A separate destination-alias case runs everywhere. Windows skips Unix executable
permission assertions; directory links use Windows junctions or Unix symlinks.
CLI invocation through a linked ancestor covers macOS temporary-path aliases.

`test/workspace-wrappers.test.js` exercises the new OS entrypoints in the same
isolated fixtures. Windows runs the PowerShell script through both Windows
PowerShell 5.1 and PowerShell 7 (`powershell.exe` and `pwsh.exe` on PATH).
Linux/macOS directly execute both Bash entrypoints, so missing executable bits
fail the tests. Coverage includes unrelated working directories, both skill
mirrors and resources, automatic post-sync check, no-op repeats, read-only modes,
multiple Node installations on PATH, missing dependencies, conflicts and propagation
of failures from either command.

## Launcher, Payload and CI

`test/cli.test.js` retains the existing launcher's resolution/health contract.
Production dependency ranges and npm's files allowlist remain unchanged.

```sh
npm pack --dry-run --ignore-scripts --offline --json
```

The payload must contain only `bin/cli.js`, README, LICENSE and npm's automatic
`package.json`. Workspace tooling and generated files remain checkout-only.

The Ubuntu `test` CI job runs the full suite and isolated tarball
resolution/startup/shutdown checks. The `workspace` matrix runs all four
workspace suites on Windows/macOS/Linux with Node 22 and 24, without live services.

## Validation Record

The Windows full suite passed 95 tests with two filesystem-specific skips
(97 total, including 24 apply/recovery and 10 wrapper tests). It covers forced termination through
ownership and cleanup, partial staging, repeated recovery, concurrent edits,
unsafe recovery input and two-process writer exclusion. Offline npm pack inspection
contains only the four allowed files. The implementation PR records OS-matrix results.
Author-run tests are automated validation, not independent code review. Live
parent-root Codex/Claude discovery remains a separate, unclaimed check.

*Last updated: 2026-09-11*
