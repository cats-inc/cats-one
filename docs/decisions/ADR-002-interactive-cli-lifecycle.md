# ADR-002: Let the serving application own terminal interaction

## Status

Accepted, 2026-09-23. Implements the user's request for automatic browser opening
and `o` / `q` shortcuts across all three npm entrypoints.

## Context

The launcher starts Runtime before Platform. Opening a browser from both children
would create two tabs, and multiple consumers of terminal input would compete for
the same keys. On Windows, `child.kill()` terminates Node abruptly and cannot be
the normal graceful shutdown mechanism.

## Decision

- Each standalone service attaches browser and keyboard interaction after its
  own listener becomes ready. Runtime chooses Setup or Dashboard; Platform opens
  its application. Managed, noninteractive and machine-output modes opt out.
- When launched by cats-one, Platform owns the terminal. Runtime receives an
  app-managed private stdin pipe. The launcher requests Platform cleanup over a
  private Node IPC channel, waits for it, then closes its owned Runtime's stdin.
- Preserve a reused Runtime. Bound child cleanup and force termination only when
  an owned child does not cooperate. Restore terminal input modes on exit.
- Keep small helpers in the independently published Runtime and Platform
  packages. Neither package imports launcher code or sibling checkouts.
- Watch supervisors explicitly use managed mode; restarting a child must not
  take over keyboard input or open another browser tab.

## Consequences

Readiness, page selection and shutdown stay with the service that knows their
state. No new runtime dependency is required. The two package-local helpers must
retain matching behavior and matching contract tests. Shipping the launcher
requires coordinated dependency publication and minimum-version alignment.

## Alternatives Considered

- **Launcher also reads keys and opens a browser:** duplicates standalone service
  behavior and requires another readiness protocol for a feature Platform can own.
- **Use process signals for every child:** insufficient for graceful cleanup on
  Windows. Signals remain supported for direct terminal/server use.
- **Add a shared npm package:** introduces an additional publication dependency
  for a small host interaction helper; reconsider if the shared surface grows.

## References

- [SPEC-002](../specs/SPEC-002-interactive-cli-startup.md)
- [PLAN-002](../plans/PLAN-002-interactive-cli-startup.md)
- [Node child process signals](https://nodejs.org/download/release/latest-jod/docs/api/child_process.html#subprocesskillsignal)
