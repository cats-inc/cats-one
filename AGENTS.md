# AGENTS.md — cats-one

Cross-agent guidelines for this repository. Read this before making changes.

## What this repo is

`@cats-inc/cats-one` is the one-shot bootstrap installer entrypoint for the
Cats ecosystem. It is intentionally tiny: it resolves the `cats-platform`
executable from `@cats-inc/cats-platform` and launches it, forwarding all
arguments. The platform is backed by `@cats-inc/cats-runtime`.

- Canonical npm name: `@cats-inc/cats-one` (the unscoped `cats-one` npm name is
  a reserved alias stub).
- Bin command: `cats-one`.
- History note: this package was extracted from the `one-man-digital-company`
  monorepo in 2026-07 with full history. It was named `cats-can` between
  2026-03-30 and 2026-07-21; npm's name-similarity rule blocks that unscoped
  name (`cat-scan` collision), so it returned to its original `cats-one` name.

## Contracts

- The launcher resolves ONLY the `cats-platform` key from
  `@cats-inc/cats-platform`'s `bin` field (string form also accepted). Missing
  key = loud failure. Do NOT add compatibility fallbacks — pre-release policy
  is no compatibility shims.
- `bin/cli.js` exports `pickPlatformBin` for tests and only runs `main()` when
  executed directly.

## Commands

- Test: `npm test` (node:test, no dependencies needed)

## Rules

- Update `test/cli.test.js` when touching `bin/cli.js`.
- Runtime dependencies (`@cats-inc/cats-platform`, `@cats-inc/cats-runtime`)
  are not yet published; `package-lock.json` cannot be generated until they
  are. Do not "fix" installs by pointing dependencies at other sources.
- Planned before first real release: orchestrate `cats-runtime`
  install/supervision (currently the launcher starts the platform only).
- Do not modify other agents' files (CLAUDE.md is Claude's, CODEX.md is
  Codex's, etc.).
