# npm Release Guide

## Release boundaries

This is the cats-one npm SOP. The [cross-repository release guide](release-guide.md)
covers Runtime, Platform, Desktop and individually versioned Apps.

Ordinary commits, merges and branch pushes do not bump or publish cats-one.
Release the launcher when its own behavior changes, its supported dependency
range changes, or the owner selects a new required minimum dependency baseline.
Do not bump cats-one merely to mirror every Runtime/Platform release. Use the
user's selected scope and existing authorization for release steps.

A newer compatible dependency can be selected during fresh npm resolution
without a launcher release. Existing installs and npx caches may keep older
dependencies; `npx cats-one@latest` does not promise to refresh every cached
transitive dependency. The repo lockfile is not a published consumer lockfile.
See the [range and cache examples](release-guide.md#when-cats-one-needs-a-release).

The version sources are root `package.json`, `package-lock.json.version` and
`package-lock.json.packages[""].version`. Synchronize them without creating a Git
tag, for example with `npm version <version> --no-git-tag-version`. Reuse a prepared
unpublished version where appropriate. Git tags are not required for this npm
workflow: pushing the source runs CI; the separate manual dispatch publishes it.

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

When a selected launcher release requires new dependency minima, those versions
must already be published and downloadable. Publish only missing required
versions, then update the ranges and resolve the lockfile from npm. Sibling
source checkouts are not substitutes for published dependencies. The coordinated
interactive-CLI release in SPEC-002 needed this order; it is not a requirement
to republish Runtime and Platform for every later cats-one release.

1. Integrate remote changes and select the source, version and npm dist-tag.
   If dependency ranges change, confirm the required npm versions exist before
   resolving and verifying the root lockfile.
2. Bump root `package.json` and `package-lock.json` together. Follow the repository's
   scoped validation policy and reuse relevant passing evidence. For alias changes,
   `node --test test/npm-alias.test.js` checks alignment and forwarding. The
   publication workflow retains its full gate; do not duplicate it locally solely
   for a version bump.
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
   publishes the alias. `--ref main` selects main's source at dispatch time; choose
   the intended release branch when necessary. Set the channel explicitly: the
   workflow defaults to `next`, not `latest`.
5. Confirm the workflow succeeded and verify **both** registry entries:

   ```sh
   npm view @cats-inc/cats-one@latest version
   npm view cats-one@latest version
   npm view cats-one@latest dependencies --json
   ```

   Both versions must match the root version; the alias dependency must pin it
   exactly. Use the chosen dist-tag in these checks. Registry metadata and tarball
   propagation can lag publication; verify download availability for both packages
   rather than reporting success from a workflow dispatch alone.

   When launcher or package behavior changed, verify the affected entrypoint in a
   fresh npm cache/consumer, for example
   `npx --yes cats-one@latest --platform-only --help`. Do not repeat full-stack
   startup exercises solely for a version or documentation edit.

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
