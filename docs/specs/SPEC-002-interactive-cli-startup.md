# SPEC-002: Interactive npm entrypoints

## Status

Approved for implementation by the user on 2026-09-23. Implemented and published
to npm as cats-one 0.1.23, Platform 0.3.5 and Runtime 0.1.26.
See [ADR-002](../decisions/ADR-002-interactive-cli-lifecycle.md) for ownership
and [PLAN-002](../plans/PLAN-002-interactive-cli-startup.md) for validation evidence.

## Contract

- `cats-one`, `@cats-inc/cats-platform`, and `@cats-inc/cats-runtime` open the
  corresponding browser page once the service is ready in an interactive terminal.
- Platform opens `/` (the application handles first setup). Runtime opens
  `/setup` in bootstrap mode, otherwise `/`. Use the actual listening port and
  a dialable loopback address for wildcard binds, including IPv6.
- Show the address and `o` to open the browser, `q` to stop, and `Ctrl+C` to stop.
  Single-key input must restore the terminal on shutdown. `--no-open` suppresses
  the initial browser launch while preserving `o`.
- App-managed/Desktop, CI, redirected/non-TTY, JSON/silent lifecycle output,
  help, and Runtime's MCP/ACP/diagnostic commands must not open browsers or
  consume interactive keyboard input. An opener failure leaves the service
  running and the URL visible.
- `q`, Ctrl+C, and parent shutdown use each service's existing cleanup path.
  `cats-one` waits for Platform, then closes the Runtime it started. A reused
  Runtime remains running. Cancellation during startup must not spawn a later
  service. Unresponsive owned children receive a bounded force-stop fallback.

## Ownership and implementation

Platform owns the terminal/browser interaction when launched by `cats-one`.
The launcher keeps Runtime app-managed with a private stdin pipe, and uses a
private Node IPC channel to request Platform shutdown. Browser opening follows
Platform's own listener callback, without parsing human logs or probing its port.
Standalone Platform and Runtime keep small package-local terminal helpers;
neither acquires a product dependency on the launcher or on sibling checkouts.

## Validation

Focused tests cover keyboard input and terminal restoration, browser command
selection and failure, all opt-out modes, bootstrap/IPv6 URLs, parent shutdown,
startup cancellation, child failure, and preservation of a reused Runtime.
Use temporary homes and fixtures; never open real browsers from automated tests.
Build the affected server/runtime outputs and exercise the packaged entrypoints.

## Sources

- [Node.js child process signals](https://nodejs.org/download/release/latest-jod/docs/api/child_process.html#subprocesskillsignal): Windows process kill is abrupt; it is not the normal graceful shutdown mechanism.
- [Node.js readline keypress input](https://nodejs.org/api/readline.html#readlineemitkeypresseventsstream-interface)
- [Node.js terminal raw mode](https://nodejs.org/api/tty.html#readstreamsetrawmodemode): handle Ctrl+C explicitly while raw input is enabled.

*Last updated: 2026-09-23*
