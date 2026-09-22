# PLAN-002: Interactive npm entrypoints

## Metadata

| Field | Value |
| --- | --- |
| Status | Implemented and locally verified; unpublished |
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

## Publication Follow-up

No versions have been changed or published for this feature. Before release,
publish the changed Runtime and Platform, raise cats-one's minimum dependencies,
regenerate the registry lockfile, and publish both scoped and unscoped cats-one.
Run the release checks and clean packed-consumer verification in the
[deployment guide](../deployment.md).

## Progress Log

- 2026-09-23: Implemented three-entrypoint interaction and owned-child cleanup;
  documented cross-repository ownership and added targeted process regressions.
  All 89 targeted tests passed; no full release suite was run for this feature.
