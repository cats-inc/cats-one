# AGENTS.md — cats-one

Cross-agent guidelines for this repository. Read this before making changes.

## What this repo is

`@cats-inc/cats-one` is the one-shot bootstrap entrypoint for the Cats
ecosystem: it starts `@cats-inc/cats-runtime` (reusing one that already
serves `CATS_RUNTIME_BASE_URL`), waits for its `/health`, then launches
`@cats-inc/cats-platform` with all arguments forwarded. If a runtime it
started dies, it tears the platform down and exits non-zero; restart
policy/supervision is future work. `--platform-only` skips the runtime.

Developer workspace bootstrap is proposed in
[ADR-001](docs/decisions/ADR-001-own-developer-workspace-bootstrap.md), with
[SPEC-001](docs/specs/SPEC-001-developer-workspace-bootstrap.md) and
[PLAN-001](docs/plans/PLAN-001-developer-workspace-bootstrap.md). It would assemble
parent-level instructions and maintenance skills for the four Cats checkouts.
The command is not implemented; do not present planned commands as available.

- Canonical npm name: `@cats-inc/cats-one` (the unscoped `cats-one` npm name is
  a reserved alias stub).
- Bin command: `cats-one`.
- History note: this package was extracted from the `one-man-digital-company`
  monorepo in 2026-07 with full history. It was named `cats-can` between
  2026-03-30 and 2026-07-21; npm's name-similarity rule blocks that unscoped
  name (`cat-scan` collision), so it returned to its original `cats-one` name.

## Contracts

- The launcher resolves ONLY the `cats-platform` key from
  `@cats-inc/cats-platform`'s `bin` field and ONLY the `cats-runtime` key from
  `@cats-inc/cats-runtime`'s `bin` field (string form also accepted). Missing
  key = loud failure. Do NOT add compatibility fallbacks — pre-release policy
  is no compatibility shims. Runtime resolution depends on
  `@cats-inc/cats-runtime`'s `"./package.json"` export (>=0.1.2).
- `bin/cli.js` exports `pickPlatformBin` for tests and only runs `main()` when
  executed directly.

## Commands

- Test: `npm test` (node:test, no dependencies needed)

## Pull Requests

- Non-trivial changes go through a branch and a PR: `git checkout -b <type>/<slug>`,
  push, open the PR, then `gh pr merge <n> --auto --squash`. The head branch is
  deleted on merge. PR titles follow Conventional Commits.
- `main` requires a pull request and **zero approvals**. This project is
  maintained from a single account, so there is no second reviewer to ask and CI
  is the gate, not peer review. A direct push to `main` succeeds only because
  `enforce_admins` is off; reserve that for trivial changes such as a docs typo
  or a version bump.
- The `test` status check is required on `main` with "branch must be up to date"
  on. Several machines develop this repo at once, so a PR opened before another
  machine's merge has to be updated before it can land — catching that is the
  reason to use a PR here.
- `gh pr merge --auto` returns success once auto-merge is *armed*, not once the
  PR is *merged*. Check `gh pr view <n> --json state,mergeStateStatus` rather
  than assuming it landed.

## Agent Skills

- Canonical skills live in `skills/`; edit them there, not in discovery copies.
  Run `scripts/windows/Sync-AgentSkills.ps1` (or `scripts/linux/sync-agent-skills.sh`)
  after changes; see `skills/README.md` for discovery paths.
- Discovery copies under `.claude/` and `.agents/` are Git-ignored, so run the sync
  once after a fresh checkout. Do not assume optional skills exist.
- These existing helpers synchronize this repository's `skills/` source. A
  `-ProjectRoot` override selects another whole project's source and destination;
  it is not the proposed multi-repository workspace aggregation command.

## Developer Workspace Planning Boundaries

- Keep workspace definitions/templates in version control here and generated
  parent outputs outside member repositories. Read `docs/AGENT-GUIDE.md` and
  the linked proposal before implementing the workspace feature.
- Member instructions and canonical skills remain member-owned. Runtime's
  maintenance source is `developer-skills/`; its separate `skills/` library is
  product-delivered and must not be aggregated as developer instructions.
- Runtime owns general product workspace-substrate capabilities. Platform owns
  Desktop packaging, App selection and install/load; Apps owns utility source
  and versioned `.catsapp` artifacts. Do not move these responsibilities into
  the developer workspace command.
- Keep the existing launcher's argument-forwarding contract. Dependency/lockfile
  alignment and build/dev orchestration are separate work packages in PLAN-001.

## Rules

- Update `test/cli.test.js` when touching `bin/cli.js`.
- Runtime dependencies (`@cats-inc/cats-platform`, `@cats-inc/cats-runtime`)
  are declared in `package.json` and recorded in the existing `package-lock.json`.
  Keep both consistent when dependency updates are in scope. Do not replace
  declared package sources with sibling imports or local-path dependencies as
  an incidental installation fix.
- Do not modify other agents' files (CLAUDE.md is Claude's, CODEX.md is
  Codex's, etc.).
