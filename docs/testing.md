# Testing

## Commands

Prepare checkout dependencies with `npm ci --include=dev`, then run from cats-one:

```sh
npm test
```

The suite uses Node's built-in `node:test` runner. To run only workspace behavior:

```sh
node --test test/workspace-inventory.test.js test/workspace-cli.test.js
```

CLI tests spawn Node child processes. Run in an environment that permits process
creation; a sandbox `spawn EPERM` is not a test assertion failure.

## Workspace Coverage

Fixtures create four fake checkouts beneath OS-native temporary parents with
spaces and Unicode. They do not use the user's real member sources, Git state,
agent folders or product services. Each fixture is removed after the test.

| Acceptance | Evidence in the Phase 1 tests |
| --- | --- |
| AC-2 / AC-3 | Three maintenance skills, nested platform sources, empty roots, excluded proposals/product library, byte-preserving resources and routing text |
| AC-4 | Different parent names and timestamps produce equal desired bytes/digests |
| AC-6 | Missing/invalid members, worktrees, YAML/name errors, duplicate skills, unsafe ownership, links/junctions and case aliases |
| AC-7 | Custom root conflicts, explicit adoption, managed local edits and stale-entry protection in the planner |
| AC-8 | Full temporary-tree byte/mtime snapshots around preview/check/error paths, CLI exit codes and retained unselected-agent ownership |

Phase 1 tests arrange managed files as fixtures to exercise planning; this is not
evidence of implemented synchronization. Apply, rollback and interrupted-recovery
tests remain Phase 2 work. Live parent-session skill discovery remains Phase 3.

Windows normally cannot represent two files differing only in name casing; that
one resource-collision fixture is skipped there (and on case-insensitive macOS).
The separate case-alias destination test runs on every platform. Directory links
use Windows junctions and Unix symlinks.

The CLI is also exercised through a linked ancestor directory, covering macOS
temporary paths whose invocation name differs from the module's physical path.

## Launcher and Package Contract

`test/cli.test.js` covers the existing launcher's resolution and health behavior.
Workspace tooling must keep production dependency ranges and `files` unchanged.

Inspect the npm payload without creating a tarball:

```sh
npm pack --dry-run --ignore-scripts --offline --json
```

The payload is limited to `bin/`, README, LICENSE and npm's automatic
`package.json`; no workspace script, config, template or generated file belongs
in the published package.

The existing Ubuntu `test` CI job installs dependencies, runs `npm test`, packs
and installs a tarball in an isolated consumer, and verifies startup/shutdown.
The separate `workspace` matrix runs the isolated workspace suites on
Windows/macOS/Linux with Node 22 and 24; it does not start product services.

## Validation Record

On 2026-09-11, the Windows full suite completed 62 tests: 61 passed and one
case-sensitive-resource fixture skipped. That initial run included 47 workspace
tests and 15 existing launcher tests. The added entrypoint-alias regression and
all five CLI tests also passed on Windows after the path-resolution fix.
Offline npm pack inspection contained only the four
allowed files. A read-only preview of the real four-member workspace found the
expected three canonical maintenance skills. CI results belong in the
implementation PR. Author-run tests are automated validation, not independent
code review. Live Codex/Claude discovery has not been validated by Phase 1.

*Last updated: 2026-09-11*
