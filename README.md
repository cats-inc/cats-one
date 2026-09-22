# @cats-inc/cats-one

Bootstrap installer entrypoint for the Cats ecosystem.

`cats-one` boots the whole Cats stack in one shot: it starts
[`@cats-inc/cats-runtime`](https://github.com/cats-inc/cats-runtime) (unless one is
already serving), waits for its `/health` endpoint, then launches
[`@cats-inc/cats-platform`](https://github.com/cats-inc/cats-platform), forwarding
all CLI arguments to the platform.

> **Status**: published. `@cats-inc/cats-one` and its dependencies are live on
> npm. The unscoped [`cats-one`](https://www.npmjs.com/package/cats-one) package
> is a thin alias that forwards to this canonical package, so `npx cats-one`
> works too.

## Requirements

- Node.js 22+
- npm 12+

## Usage

```bash
npx @cats-inc/cats-one
```

## Behavior

- The runtime endpoint comes from `CATS_RUNTIME_BASE_URL`, or
  `CATS_RUNTIME_HOST`/`CATS_RUNTIME_PORT`, defaulting to
  `http://127.0.0.1:3110`. The same endpoint drives the health probe, the
  runtime `cats-one` starts, and the platform's runtime client, so they always
  agree (wildcard binds like `0.0.0.0` are probed via loopback).
- When `CATS_RUNTIME_API_KEY` is set, health probes use it as a bearer token.
  The same environment is passed to runtime and platform.
- If a runtime already answers there, it is reused instead of starting a
  second one.
- Otherwise, for local endpoints `cats-one` starts `cats-runtime`, waits up to
  60s for `/health`, then starts `cats-platform`; startup fails loudly if the
  runtime never becomes healthy. For non-local endpoints `cats-one` refuses to
  auto-start and exits with an error instead.
- If a runtime that `cats-one` started dies while the platform is running, the
  launcher shuts the platform down and exits non-zero (automatic restart /
  supervision is future work).
- `--platform-only` skips runtime orchestration entirely.
- Ctrl+C / SIGTERM stops both processes.

## Developer Workspace

`cats-one` owns the development workspace definition for sibling `cats-one`,
`cats-runtime`, `cats-platform`, and `cats-apps` checkouts. Their parent directory
can remain outside Git. The checkout command inventories canonical maintenance
skills and synchronizes root guidance and discovery copies.

Prepare developer dependencies once with `npm ci --include=dev` in `cats-one`,
then use the helper for your OS from that checkout, with no parameters:

| OS | Command |
| --- | --- |
| Windows | `.\scripts\windows\Sync-WorkspaceSkills.ps1` |
| macOS | `./scripts/macos/sync-workspace-skills.sh` |
| Linux | `./scripts/linux/sync-workspace-skills.sh` |

Each helper locates the parent workspace from its script path, synchronizes both
`.agents/skills` and `.claude/skills`, then checks the result. Use `-WhatIf` on
Windows or `--dry-run` on Bash to preview; `-Check` / `--check` only checks.
Node.js and the four sibling checkouts are still required.

Sync copies complete skills, records their ownership, preserves local edits and
unrelated files, and recovers interrupted operations on the next sync. Repeating
an unchanged sync does not rewrite files or metadata. The underlying
`scripts/workspace.mjs` interface remains available for selecting a single agent.

`check` and `sync --dry-run` stay read-only. Sync/preview exit `0` on success;
a check with drift exits `1`; invalid input or conflicts exit `2`. See the
[setup guide](docs/setup-guide.md) for requirements, conflicts and recovery.

This developer command is available from a checkout, outside the published npm
payload. App installation, version selection and Desktop packaging remain owned
by `cats-platform`.

- [ADR-001: Ownership and boundaries](docs/decisions/ADR-001-own-developer-workspace-bootstrap.md)
- [SPEC-001: Behavior and acceptance criteria](docs/specs/SPEC-001-developer-workspace-bootstrap.md)
- [PLAN-001: Implementation phases and follow-ups](docs/plans/PLAN-001-developer-workspace-bootstrap.md)
- [Progress](PROGRESS.md), [roadmap](ROADMAP.md), and [documentation index](docs/README.md)

## License

MIT
