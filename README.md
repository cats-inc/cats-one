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

## Usage

```bash
npx @cats-inc/cats-one
```

## Behavior

- If a runtime already answers at `CATS_RUNTIME_BASE_URL` (default
  `http://127.0.0.1:3110`), it is reused instead of starting a second one.
- Otherwise `cats-one` starts `cats-runtime`, waits up to 60s for `/health`,
  then starts `cats-platform`; startup fails loudly if the runtime never
  becomes healthy.
- If a runtime that `cats-one` started dies while the platform is running, the
  launcher shuts the platform down and exits non-zero (automatic restart /
  supervision is future work).
- `--platform-only` skips runtime orchestration entirely.
- Ctrl+C / SIGTERM stops both processes.

## License

MIT
