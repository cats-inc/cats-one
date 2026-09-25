# PLAN-002: Interactive npm entrypoints

## Metadata

| Field | Value |
| --- | --- |
| Status | Implemented and published to npm |
| Assigned to | Codex |
| Reviewer | Independent review_cli_interaction agent |
| Spec | [SPEC-002](../specs/SPEC-002-interactive-cli-startup.md) |
| Decision | [ADR-002](../decisions/ADR-002-interactive-cli-lifecycle.md) |

## Implementation

- [x] Runtime: ready-only Setup/Dashboard opening, `o`, `q`, Ctrl+C, `--no-open`.
- [x] Platform: ready-only application opening and the same terminal controls.
- [x] Preserve managed/Desktop, CI, non-TTY, machine-output and protocol modes.
- [x] cats-one: Platform owns input; IPC then Runtime EOF for ordered cleanup;
  retain reused Runtime, startup cancellation and bounded forced-stop behavior.
- [x] Watch children explicitly use managed mode.
- [x] Update usage, ownership, help, lifecycle API and coordinated-release docs.
- [x] Independent read-only review; address startup disconnect, early close,
  watch restart and queued browser-opening findings.

## Validation

All process fixtures use temporary homes, isolated ports and fake browser
openers. No user configuration or live provider sessions are used.

- cats-one focused CLI, lifecycle and alias tests: 28 passed.
- Runtime helper/startup tests: 22 passed; compiled entrypoint tests: 3 passed.
  Covers fresh bootstrap, configured Dashboard and managed JSON/EOF shutdown.
- Platform focused helper/startup/shutdown/auth/Desktop tests: 32 passed;
  compiled entrypoint tests: 4 passed after correcting Windows test-harness
  output-drain handling for an explicitly disconnected IPC channel.
- Runtime and Platform server builds passed.
- Offline `npm pack --dry-run --ignore-scripts --json` inspection passed for all
  three packages: both compiled interaction helpers are included; the launcher
  retains its four-file payload. This checks current build inclusion, not a fresh
  release build or publication.
- Isolated integration against the actual launcher and both compiled services
  passed: one automatic Platform page, `o`, `q`, ordered cleanup, both ports closed.
  Local build paths were injected only in the temporary verification driver;
  production dependency resolution remains registry-based.
- Actual Windows browser launch and physical-terminal behavior are not claimed
  by the mocked-opener tests. macOS/Linux native smoke remains for their OS jobs
  or manual validation; opener argument tests cover all three platforms.

## Publication

The user authorized direct-to-main commits and npm publication on 2026-09-23.
Runtime 0.1.26, Platform 0.3.5 and both cats-one names at 0.1.23 are published.
Remote main changes were integrated before pushing. Runtime and Platform were
published first, then the launcher's `^0.1.26` / `^0.3.5` dependency minima and
lockfile were resolved from npm before publishing both launcher names.
See the [deployment guide](../deployment.md) for the coordinated release process.

Release evidence:

- Runtime 0.1.26: [publish run](https://github.com/cats-inc/cats-runtime/actions/runs/35791354113)
  passed its full release gate at `3c503fd23b9695b456caabd9028965e94edebd7b`.
- Platform 0.3.5: [publish run](https://github.com/cats-inc/cats-platform/actions/runs/35791873040)
  passed its full test/build gate at `df8be7b1aec03a9833de816f8a4ff98cd36c7b97`.
- Both cats-one names at 0.1.23:
  [paired publish run](https://github.com/cats-inc/cats-one/actions/runs/35793743774)
  passed its full test gate and both publish steps at
  `3adbd5148c64d6827ae9f5ade9d05fd427606a60`. The unscoped package pins canonical
  0.1.23 exactly; canonical dependencies and its registry lockfile agree on
  Runtime `^0.1.26` and Platform `^0.3.5`.
- The release commits also passed their main-branch CI:
  [Runtime](https://github.com/cats-inc/cats-runtime/actions/runs/35791279520),
  [Platform](https://github.com/cats-inc/cats-platform/actions/runs/35791749338),
  [cats-one](https://github.com/cats-inc/cats-one/actions/runs/35793702327).
- The integration includes remote Junie/Auggie/Goose shortlist updates. Following
  integration, the rebuilt Runtime entrypoint's 3 tests and Platform CLI/provider
  consumer selection's 35 tests passed locally.
- Registry versions and all four downloaded package versions were confirmed.
  Fresh-cache `npx cats-one@latest --help` passed. Published Runtime and Platform
  startup, automatic opener invocation, `o`, `q` and port cleanup passed with
  isolated homes and intercepted browser openers.
- The user stopped an additional full-stack alias verification repeat and
  requested immediate commit/push without further tests. That repeat is not
  claimed as passed; no further validation was run after the stop request.

## Progress Log

- 2026-09-26 follow-up: cats-one 0.2.0 raises dependency minima to Runtime
  0.3.1 and Platform 0.5.1, both published to npm `latest` alongside the
  Desktop 0.5.1 standard-profile preview. The supported dependency contract
  crosses the Runtime 0.2/0.3 and Platform 0.4/0.5 breaking minors, so the
  launcher moves to its next minor. Its own contract is unchanged: the bins,
  `CATS_RUNTIME_*` endpoint variables, app-managed startup, `/health` and IPC
  shutdown all remain supported. Launcher tests passed 28/28, and the alias
  payload holds its four files with an exact pin. A locally packed 0.2.0 ran
  in isolated profiles on non-default ports. A profile created by cats-one
  0.1.24 (Runtime 0.1.27, Platform 0.3.6), holding the old
  `providers.yaml` and schema-1 catalog examples, started Runtime 0.3.1 and
  Platform 0.5.1. The Runtime retired the unmodified catalog copy with a
  backup and served the current ten Claude models; a repeat start was a no-op.
  A clean profile started both services with an available catalog. Both
  names were published at 0.2.0 on `latest` from `460e623` (npm-publish run
  36187020990). The registry shows `@cats-inc/cats-one` and `cats-one` at
  0.2.0, with the alias pinning canonical 0.2.0 exactly. A fresh-cache
  `npx --yes cats-one@latest --platform-only --help` installed cats-one 0.2.0,
  Platform 0.5.1 and Runtime 0.3.1.

- 2026-09-23 follow-up: cats-one 0.1.24 raises dependency minima to Runtime
  0.1.27 and Platform 0.3.6. Both fix the Windows detached PowerShell launcher,
  which could exit successfully without executing its command. Platform also
  resolves renderer files from its package root so Unix npm bin symlinks serve
  the homepage rather than a JSON 404. Platform 0.3.6 includes the user's newer
  macOS update-dialog focus change. Publish both cats-one names at 0.1.24; the
  alias must pin canonical 0.1.24 exactly. No additional local test suites or
  application builds are run for this publication; use the existing hosted gates.

- 2026-09-23: Implemented three-entrypoint interaction and owned-child cleanup;
  documented cross-repository ownership and added targeted process regressions.
  All 89 targeted tests passed; no full release suite was run for this feature.
