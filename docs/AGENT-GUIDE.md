# Agent Guide

Read root `AGENTS.md` and your own agent file first. Customize this guide with
project-specific procedures that are too detailed for always-loaded instructions.

## Project Context

- Read [architecture](architecture.md) for the current npm launcher and
  developer-workspace boundary.
- Workspace planning follows [ADR-001](decisions/ADR-001-own-developer-workspace-bootstrap.md),
  [SPEC-001](specs/SPEC-001-developer-workspace-bootstrap.md), and
  [PLAN-001](plans/PLAN-001-developer-workspace-bootstrap.md). Phase 1 implements
  read-only inventory, check and sync preview; managed apply/recovery is pending.
- Track delivered versus planned work in [PROGRESS.md](../PROGRESS.md). Planning
  completion is not implementation completion.
- The product entrypoint is `bin/cli.js`; developer inventory uses
  `scripts/workspace.mjs`. Tests use `node:test` in `test/` through `npm test`.
- Read [setup](setup-guide.md) and [testing](testing.md) for available commands.
  `check` and `sync --dry-run` must never generate parent files or repair state.
- Sibling links in the planning package assume the four checkouts share a parent.
  They document ownership and do not authorize modifying a sibling repository.

## Workflows

- Features: consult requirements and architecture; use existing SPEC/PLAN templates
  for complex approved work. Implement, add tests, and update affected docs.
- Bugs: reproduce, identify the cause, fix when authorized, and add regression
  coverage. A diagnosis-only request does not authorize implementation.
- Documentation: use `update-docs` if installed. Otherwise map the change to the
  existing document inventory in `docs/README.md`, update targeted sections,
  check links and examples, and report omissions.
- Tests: use `run-tests` if installed; otherwise read `docs/testing.md` and the
  actual manifest/CI commands. Do not infer pytest solely from a Python filename.
- Review: use `review-code` if installed and you did not author the code. Review
  read-only and report actionable findings with evidence.
- Scripts: use `docs/SCRIPT-STANDARDS.md` for help and naming examples.
- Research: record dated primary sources in `docs/research/` when conclusions
  depend on changing external APIs or protocols.

## Optional Protocol Integrations

A coding-agent skill is not an A2A Agent Card skill, and local agent instructions
are not wire protocol configuration. Consult `docs/terminology.md` first.

When A2A examples are installed, read `docs/a2a/README.md`. Select public versus
authenticated cards deliberately; advertise only implemented capabilities. Validate
the selected protocol revision and actual transport/auth behavior separately.
MCP host configurations belong to that host, not to A2A discovery metadata.

## Services and Ports

Consult `docs/services.md` before assigning a port. If the bootstrap checkout and
its `docs/port-registry.md` are available, check cross-project usage as well.
Choose a configurable port, warn about conflicts, update this project's service
documentation, and obtain permission before changing an external central registry.

## Branch Maintenance

Remote deletion after a squash merge does not remove local branches; ancestry alone
may not identify squash-merged work. Use the shipped merged-branch cleanup helper
only when cleanup is requested:

```powershell
.\scripts\windows\Remove-MergedBranches.ps1 -WhatIf
```

```bash
./scripts/linux/remove-merged-branches.sh --dry-run
```

The macOS copy provides the same interface. Helpers stop on dirty worktrees, skip
other worktrees and never remove the default branch or never-pushed branches.
Read their help before execution. `-ReturnToDefault` / `--return-to-default`
also updates and switches to the default branch. Do not change global Git settings
as an implicit step; use repository-scoped or explicit user choices.

## Handoff

Report the affected behavior, commands actually tested, independent-review status,
documentation updates, and any remaining blockers. Update progress/status only
within the role ownership rules in `AGENTS.md`. Never label placeholder tests or
unrun deployment/runtime checks as passing.

*Last updated: 2026-09-11*
