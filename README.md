# @cats-inc/cats-one

Bootstrap installer entrypoint for the Cats ecosystem.

`cats-one` resolves the `cats-platform` executable from
[`@cats-inc/cats-platform`](https://github.com/cats-inc/cats-platform) and launches it,
forwarding all CLI arguments. The platform is backed by
[`@cats-inc/cats-runtime`](https://github.com/cats-inc/cats-runtime).

> **Status**: published. `@cats-inc/cats-one` and its dependencies are live on
> npm. The unscoped [`cats-one`](https://www.npmjs.com/package/cats-one) package
> is a thin alias that forwards to this canonical package, so `npx cats-one`
> works too.

## Usage

```bash
npx @cats-inc/cats-one
```

## Known limitations

- The launcher starts the platform only; it does not yet install or supervise a
  `cats-runtime` service. Zero-to-running orchestration is planned before the first
  real release.

## License

MIT
