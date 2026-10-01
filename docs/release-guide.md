# Cross-Repository Release Guide

Accepted by the owner on 2026-09-23. This is the release-scope guide for Runtime,
Platform, cats-one, Desktop and the individual Apps in cats-apps. Each owning
repository's deployment guide supplies its executable SOP.

## Release scope

Accumulate commits independently in each repository. Prepare a version when the
owner selects a release target; do not bump on every commit. Implementation,
documentation, commit/push and merge requests alone do not authorize publication.
Use the user's request and existing session authorization to determine the targets.
A request to publish a selected target covers its necessary version preparation;
do not ask again for already authorized steps. Clarify only genuinely unresolved
scope, rather than silently releasing every repository.

| Selected target | Version source | Publication trigger | No automatic follow-on release |
| --- | --- | --- | --- |
| Runtime npm | Runtime root `package.json` and `package-lock.json` | Manually dispatch `npm-publish.yml` | Platform, cats-one, Desktop, Apps |
| Platform npm | Platform root `package.json` and `package-lock.json` | Manually dispatch `npm-publish.yml` | Runtime, cats-one, Desktop, Apps |
| cats-one npm | cats-one root `package.json` and `package-lock.json`; generated alias | Manually dispatch `npm-publish.yml`; publish both names | Runtime/Platform already available on npm, Desktop, Apps |
| Desktop official | Same version fields as Platform npm | Push a matching `vX.Y.Z` Git tag in cats-platform | npm packages, new App releases |
| Desktop preview | Same version fields as Platform npm | Manually dispatch `desktop-release.yml` with a matching unused tag | npm packages, new App releases |
| One App | `apps/<slug>/cats.app.json` and `package.json`; root lockfile workspace entry | Push `<slug>-vX.Y.Z` in cats-apps | Other Apps, Desktop, npm packages |

Ordinary branch pushes run the configured CI. A successful CI run or uploaded
CI artifact is not a published npm package, Desktop release, or App release.

## Release preparation and completion

Owner instruction accepted 2026-10-01, for all Cats repositories and agents.

Prepare the version fields, release notes, exact source/artifact pins,
compatibility and migration notes, and applicable signing profile together in
the original bump commit/PR before publication. State expected trust and planned
checks honestly; results that do not exist yet must not be described as passed.
Use the user's authorized Git workflow, including direct commit/push to main
when requested. Preparation does not require a second documentation delivery.
Pin external Runtime/App inputs in that change. Select this repository's source
SHA from the completed bump commit; do not create another tracked edit to insert
that commit's own SHA. The existing workflow records resolved source identities.

Write that preparation so it stays true after publication. Keep status words such
as "prepared" or "published" out of headings and sentences, and do not phrase
hosted checks as pending work. State the planned trigger, expected trust and the
checks the workflow enforces, then point to the hosted record for results, for
example "Publication results: the `vX.Y.Z` GitHub Release and its workflow run."
Repository docs keep procedures, not a running list of published versions; point
to GitHub Releases or the npm registry for that list.

After publication, complete the existing workflow, registry and artifact checks
for the selected target, reuse applicable passing evidence, and report the actual
results and limitations in the final response. That report ends the release.
GitHub Actions run results/logs, the generated release assets and npm registry
metadata are the hosted records. Do not create a GitHub Release for an npm-only
publication. Existing tracked workflow definitions change only when their
behavior needs changing, not to record each version's outcome. Required generated
checksums/provenance/source receipts remain ordinary release assets.

MUST NOT, after publication, edit the published GitHub Release (description,
title, assets or flags) or create tracking files, status edits, commits or PRs to
flip "prepared" to "published", append verification/checksums, or update release
history in README, PROGRESS or repository docs. MUST NOT offer any of these as an
optional follow-up either. This release-specific rule overrides generic durable
project-memory and documentation-sync requirements for routine publication
outcomes. Only a concrete release defect within authorized scope, or the owner's
explicit request for that specific change, justifies a post-publication change.
Do not propose one.

Once the selected immutable release is published and its required checks pass,
perform only its authorized branch/worktree cleanup and finish. Later unrelated
main commits do not invalidate that release or require rebasing, rebuilding,
republishing, or keeping the task open for a documentation PR.

## Compatibility and data upgrades

The owner adopted this rule on 2026-09-23 for every Cats package and App:

- Preserve compatibility within a `0.x` minor line. Breaking public API, CLI,
  configuration-file, persisted-data or supported user-workflow changes require
  the next minor (`0.1.z` -> `0.2.0`). Compatible fixes can use patch releases;
  compatible features may use a minor release. At `1.0.0` and above, follow
  SemVer: breaking changes increment major, compatible features minor, fixes patch.
- Schema numbers and software versions are independent. Changing an internal
  schema with a transparent, lossless migration is not by itself a breaking API
  change. Rejecting previously supported user configuration is a breaking change.
- Preview and pre-1.0 status do not waive existing-user data protection. A schema
  change must ship a tested upgrade path: detect the exact old format, validate a
  complete conversion, back up, atomically apply, and verify the new state. Unknown
  data or failures preserve the original and expose actionable diagnostics.
- Keep one current execution contract. A bounded one-time data migration is
  permitted; it is not permission to keep legacy execution APIs or fallback tables.
- Verify both clean install and an isolated previous-version profile, including
  repeat startup, failed conversion and recovery. Health checks, release notes,
  or converter unit tests alone do not establish a working installed upgrade.
- Classify each selected release independently; do not bump unrelated repositories.
  Check dependency ranges, App host/SDK declarations and Desktop App pins when a
  compatibility boundary changes. A version bump never substitutes for migration.

The catalog schema-2 transition requires the next authorized release to use
Runtime `0.2.0` and Platform/Desktop `0.4.0`, instead of continuing the old patch
lines. This records the intended release boundary; it does not publish packages,
change versions immediately, or authorize release of the launcher or Apps.

SemVer explicitly leaves `0.x` unstable; the same-minor guarantee above is Cats'
stricter policy. See [SemVer](https://semver.org/#spec-item-4) and
[npm caret ranges](https://github.com/npm/node-semver#caret-ranges-123-025-004).

## Three different version identifiers

- A package version, such as `0.3.7`, identifies the package being built.
- A Git tag identifies a source commit. `v0.3.7` triggers the official Desktop
  workflow in cats-platform; `usage-v0.2.2` triggers the Usage App release in cats-apps.
- An npm dist-tag, such as `latest` or `next`, points to a published npm version.
  Selecting an npm dist-tag does not create a Git tag or publish Desktop.

Keep package versions and their tracked lockfile entries synchronized. If the
intended source already has a prepared version that is unused on the selected
publication target, reuse it instead of adding another bump. Never overwrite an
already published version with changed bytes or recreate an existing release tag.

For npm-only version preparation, update the files directly or use
`npm version <version> --no-git-tag-version`. In particular, plain `npm version`
can create a Git tag that must not accidentally reach Desktop's release trigger.
Release commands in member guides are examples to run only for an authorized target.

## Runtime and Platform npm

1. Select the package(s), intended source commits and npm dist-tag. Integrate
   remote changes without discarding other work.
2. Prepare only the selected package versions and root lockfiles, then commit/push
   using the user's authorized Git workflow.
3. Dispatch each selected repository's npm-publish.yml. The workflows run their
   existing gates and trusted publication; pushing source alone does not publish.
4. Confirm workflow success, the registry version/dist-tag and tarball availability.

Release Runtime and Platform together only when requested or required by the
specific compatibility contract being delivered. A Runtime implementation change
does not by itself authorize a new Platform or cats-one release.

Local SOPs: [Runtime](https://github.com/cats-inc/cats-runtime/blob/main/docs/release-guide.md),
[Platform](https://github.com/cats-inc/cats-platform/blob/main/docs/deployment.md#release-boundaries).

## When cats-one needs a release

Release the launcher when its own behavior changes, its supported dependency
range changes, or the owner chooses a new required minimum dependency baseline.
Do not raise its minimum versions merely to mirror every Runtime/Platform patch.

For example, `^0.1.27` accepts Runtime `0.1.28` but excludes `0.2.0`; `^0.3.6`
accepts Platform `0.3.7` but excludes `0.4.0`. These are compatibility ranges, not
a promise that every later patch is safe without maintaining the contract.
[npm semver rules](https://github.com/npm/node-semver#caret-ranges-123-025-004).

Fresh dependency resolution can select a newer version within those ranges
without a cats-one release. Existing installations and npx caches may retain an
older dependency tree. `npx cats-one@latest` requests the launcher tagged `latest`; it does
not guarantee that all cached transitive dependencies are refreshed. The repo's
package-lock.json is for its own reproducible installation/CI and is not published
as the consumer's lockfile. See [npm exec caching](https://docs.npmjs.com/cli/v11/commands/npm-exec/#a-note-on-caching)
and [npm lockfiles](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/#package-lockjson-vs-npm-shrinkwrapjson).

When a chosen launcher release needs new dependency minima, ensure those versions
are published and downloadable first; then resolve its lockfile from npm. Already
published dependencies do not need another release. Publish `@cats-inc/cats-one`
and `cats-one` at the same version and dist-tag, with the alias pinning that exact
canonical version. Follow the [launcher SOP](deployment.md).

## Desktop keeps the shared Platform version

Platform npm and Desktop continue to share the root version fields. Their
publication timing is independent: Platform npm can publish `0.3.7` and `0.3.8`
while the latest Desktop remains `0.3.6`; the next Desktop can be `0.3.9`.
These are illustrative versions, not release instructions. Skipped Desktop
numbers are valid; an independent Desktop version counter is not adopted.

A Desktop release records its Platform source commit, packaged Runtime revision
and exact App artifacts. Runtime is bundled from source, so a Runtime npm release
is not a prerequisite. Record the chosen revisions and App hashes.

- Official: push the matching `vX.Y.Z` tag in cats-platform to trigger the Desktop
  workflow. The workflow's guard requires the tag and package/lockfile versions
  to agree. The release guard resolves Runtime from `main` once and supplies that
  immutable commit to every OS build and the complete Desktop source bundle.
- Preview: dispatch desktop-release.yml from the intended source with the unused
  matching tag and an immutable `runtime_ref`. The workflow creates the preview
  tag/release itself. Do not push the tag first: that selects the official path.
- Preview status and signing are separate. A preview uses the *standard* signing
  profile (each platform signs with the credentials it has) unless `unsigned=true`
  selects the *unsigned override*, which today breaks macOS self-update. Do not
  report a bare "signed preview" or "unsigned preview"; name the profile and each
  platform's trust, and confirm the override's consequences with the operator
  before dispatch, as defined in
  [Desktop signing profiles](https://github.com/cats-inc/cats-platform/blob/main/docs/deployment.md#desktop-signing-profiles).
  Current preview tags still use `vX.Y.Z`, without a prerelease suffix.

Follow the [Desktop SOP](https://github.com/cats-inc/cats-platform/blob/main/docs/deployment.md#desktop-publication).

Desktop's complete source ZIP includes its exact Platform/Runtime commits and the
producer source for each selected App, with licenses, lockfiles and build guidance.
The matching manifest/checksum and all three packaged source receipts gate draft
publication. GitHub's automatic source archives remain Platform-only. The separate
cats-one launcher and unbundled Plugins are not part of the Desktop input set; this
packaging change does not require their release or an App version bump. See the
[complete-source SOP](https://github.com/cats-inc/cats-platform/blob/main/docs/deployment.md#complete-desktop-source-downloads).

## Individually versioned Apps

cats-apps is a private npm workspace. Each App is independently versioned and
published as a `.catsapp` artifact on GitHub Releases. The private root version
does not control individual App releases; unrelated Apps need no matching bump.

For a selected App, synchronize its manifest version, package version and the
root lockfile's workspace record, commit/push, then separately push its matching
`<slug>-vX.Y.Z` tag. The App release workflow checks the manifest/package/tag
versions and publishes the archive, exact-version lock and provenance.

Publishing an App does not update existing Desktop installations. To include it
in an authorized later Desktop release, update cats-platform's
`config/desktop-apps.lock.json` with the exact App version, published URL and
SHA-256, and check the declared Platform/App SDK compatibility. Independent
installed-App updates through a remote catalog remain future work.

Follow the [App SOP](https://github.com/cats-inc/cats-apps/blob/main/docs/deployment.md#release-boundaries).

### App compatibility with Desktop and the SDK

An App's own version is independent of the host versions it supports. Every App
manifest already declares `compatibility.catsPlatform` and `compatibility.appSdk`.
Since Desktop and Platform currently share their version source, `catsPlatform`
also specifies the Desktop host version requirement; no duplicate `minDesktopVersion`
field is needed. The SDK has its own interface version within Platform.

Release guidance is to declare the oldest required host/SDK and an upper boundary,
not an open-ended minimum. For example, `^0.3.2` accepts stable Platform versions
from `0.3.2` through the rest of `0.3.x`, excluding `0.4.0`; `^1.2.0` accepts SDK
1.2.0 and later 1.x versions, excluding 2.0.0. Same-minor acceptance in 0.x is an
explicit project compatibility choice, not a guarantee made by SemVer itself.
See [SemVer's initial-development rule](https://semver.org/#spec-item-4) and
[caret range semantics](https://github.com/npm/node-semver#caret-ranges-123-025-004).

Required project discipline: preserve the declared App-facing contract within a 0.x
minor line; a breaking host change moves to the next minor line. Stable SDK 1.x
uses a major bump for breaking API changes. If a compatible line cannot yet be
committed to, use an exact verified host/SDK version rather than implying support
for unknown versions. Record actual verification separately from the declared
range; version matching alone does not prove behavior.

The current installer checks both fields and rejects unsupported range syntax.
It accepts exact stable versions, carets, `major.x` and `major.minor.x`, not the
full npm range grammar. Use supported syntax; expressions such as `>=0.3.2 <0.4.0`
are explanatory equivalents, not accepted manifest values today. See the
[App compatibility SOP](https://github.com/cats-inc/cats-apps/blob/main/docs/deployment.md#host-and-sdk-compatibility)
for examples and when a changed declaration requires a new App artifact.

### Apps build with the Platform App SDK

Platform npm carries the public `@cats-inc/cats-platform/app-sdk` entry from
Platform 0.6.0 onward ([Platform ADR-123](https://github.com/cats-inc/cats-platform/blob/main/docs/decisions/123-expose-app-sdk-contract-as-platform-npm-subpath.md)):
manifest and browser SDK types, the installer's own package validation and an
encoder whose bytes are identical on every OS. cats-apps pins one exact Platform
version as a root devDependency and builds and validates every App with it.

- A Platform npm release does not change cats-apps. Raising that pin is a cats-apps
  change, and it can change archive bytes, so never rebuild a released App version
  under a new pin.
- An App that needs a new SDK capability, or validation against a newer host, needs
  that Platform version published to npm first. A Desktop-only release is not enough.
- Platform 0.6.0's `exports` allows only `.`, `./package.json` and `./app-sdk`; other deep
  package paths no longer resolve. Removing a public path later needs a Platform minor.
- cats-one depends on neither the SDK nor any App, and Apps and Plugins are not npm
  packages. A standalone `@cats-inc/app-sdk` is a later stage with its own authorization.

## Validation and completion

- Documentation/rules-only changes check the diff, links and described commands;
  do not run application tests or builds just to document this policy.
- Executable changes use each repository's scoped validation policy. Existing
  publication workflows retain their gates. Do not duplicate a full passing
  candidate suite locally merely to commit, bump or publish.
- Match evidence to the selected source/artifacts and changed behavior. Reuse
  relevant passing checks; a new failure or changed input can require new checks.
- A dispatched workflow is pending work. Confirm successful publication and the
  selected registry entries/release assets before reporting completion. Allow
  registry propagation time instead of attempting to republish the same version.
- Keep entrypoint verification proportional to launcher/package changes. Do not
  repeat full-stack startup exercises solely for a version or documentation edit.

*Last updated: 2026-10-01*
