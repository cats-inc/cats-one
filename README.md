# @cats-inc/cats-one

Bootstrap installer entrypoint for the Cats ecosystem.

`cats-one` resolves the `cats-platform` executable from
[`@cats-inc/cats-platform`](https://github.com/cats-inc/cats-platform) and launches it,
forwarding all CLI arguments. The platform is backed by
[`@cats-inc/cats-runtime`](https://github.com/cats-inc/cats-runtime).

> **Status**: pre-release. The `@cats-inc/cats-platform` and `@cats-inc/cats-runtime`
> dependencies are not yet published to npm, so this package is not installable yet.
> The unscoped [`cats-one`](https://www.npmjs.com/package/cats-one) npm name is a
> reserved alias for this package.

## Usage (once published)

```bash
npx @cats-inc/cats-one
```

## Known limitations

- The launcher starts the platform only; it does not yet install or supervise a
  `cats-runtime` service. Zero-to-running orchestration is planned before the first
  real release.

## License

MIT
