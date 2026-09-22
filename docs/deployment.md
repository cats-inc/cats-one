# npm Release Guide

## Two packages, one release version

| npm package | Purpose | Source |
| --- | --- | --- |
| `@cats-inc/cats-one` | Canonical Runtime/Platform launcher | Root `package.json` and `bin/cli.js` |
| `cats-one` | Public alias for `npx cats-one` | `npm-alias/bin/cli.js`; generated manifest in `.npm/alias/` |

**Every launcher release includes both packages at the same version and dist-tag.**
`npx cats-one` displays the unscoped package's version, not its dependency's
version. Publishing only `@cats-inc/cats-one` leaves that prompt on an old version.
The 2026-09-23 correction addresses exactly this: the canonical package was
0.1.22 while the alias remained 0.1.0.

`node scripts/prepare-npm-alias.mjs` derives the alias version, exact canonical
dependency, engine requirements and repository metadata from root `package.json`.
It copies the maintained forwarder, README and license into ignored `.npm/alias/`.
Do not hand-edit the generated manifest or maintain a second version counter.
The alias contains no duplicate Runtime/Platform orchestration implementation.

## Normal release

1. If Runtime/Platform dependency ranges change, publish those versions first,
   then regenerate and verify the root lockfile against npm.
2. Bump root `package.json` and `package-lock.json` together. Run relevant tests;
   `node --test test/npm-alias.test.js` checks automatic alias alignment and
   forwarding. CI's full test gate must pass before publication.
3. Generate and inspect the alias payload:

   ```sh
   node scripts/prepare-npm-alias.mjs
   npm pack ./.npm/alias --dry-run --ignore-scripts --json
   ```

   It must contain only `package.json`, `bin/cli.js`, `README.md` and `LICENSE`.
4. Commit/push according to the user's authorized Git workflow, then dispatch:

   ```sh
   gh workflow run npm-publish.yml --repo cats-inc/cats-one --ref main -f dist_tag=latest
   ```

   The workflow tests, prepares the alias, publishes the canonical package, then
   publishes the alias. Use `next` for an explicitly requested prerelease channel.
5. Confirm the workflow succeeded and verify **both** registry entries:

   ```sh
   npm view @cats-inc/cats-one@latest version
   npm view cats-one@latest version
   npm view cats-one@latest dependencies --json
   npx --yes cats-one@latest --platform-only --help
   ```

   Both versions must match the root version; the alias dependency must pin it
   exactly. Use the chosen dist-tag in these checks. A fresh npm cache/consumer
   avoids mistaking an old `npx` installation for the release. Registry metadata
   and tarball propagation can lag publication; wait and verify actual download
   availability rather than reporting success from a workflow dispatch alone.

## Recover a missing alias

If the canonical version is already published but the matching alias is missing,
keep the root version and use:

```sh
gh workflow run npm-publish.yml --repo cats-inc/cats-one --ref main -f dist_tag=latest -f alias_only=true
```

This verifies the exact canonical version exists, then publishes only the alias.
It avoids trying to overwrite an immutable canonical npm version. Do not use
alias-only recovery to skip publication of changed launcher code.

## Publishing authentication

Both packages must separately trust GitHub repository `cats-inc/cats-one` and
workflow `npm-publish.yml`. A trusted publisher for the scoped package does not
automatically authorize the unscoped package. Use npm package settings or
`npm trust` with maintainer authentication to configure a missing connection;
never commit tokens or weaken 2FA to work around a missing publisher.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and
the [npm trust command](https://docs.npmjs.com/cli/v11/commands/npm-trust/).

*Last updated: 2026-09-23*
