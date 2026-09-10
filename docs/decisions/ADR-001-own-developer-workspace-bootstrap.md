# ADR-001: Own Cats Developer Workspace Bootstrap in cats-one

## Status

Proposed — planning requested on 2026-09-11. This record proposes ownership and
scope; implementation has not started.

## Context

Cats development spans sibling `cats-one`, `cats-runtime`, `cats-platform`, and
`cats-apps` checkouts. Their parent directory, often called `cats-inc`, is not a
repository. An agent conversation can start there to work across repositories,
but each repository currently supplies only its own instructions and skill
discovery copies. A manually maintained parent `AGENTS.md` or copied skill set
does not travel with Git to another development machine.

`cats-one` already owns the ecosystem's npm launch entrypoint. Its latest base
layer also provides documentation templates and repository-local skill helpers,
but it has no developer workspace manifest or parent-directory bootstrap command.
The existing launcher resolves installed runtime/platform packages; it does not
manage sibling source checkouts.

Two existing decisions constrain the proposed responsibility:

- Runtime ADR-015 owns the general workspace-substrate service exposed to Cats
  products and user workspaces. Runtime ADR-036 distinguishes development skills
  from runtime-delivered skills.
- Platform ADR-114 and Apps ADR-001 assign App SDK, installation, loading and
  Desktop bundle selection to platform, and utility source/package production
  to apps.

## Decision

1. Make `cats-one` the version-controlled owner of the **Cats developer workspace
   definition**: member repositories, canonical maintenance-skill roots, shared
   routing instructions, and a command that materializes this definition locally.
2. Keep the parent directory outside Git. Generate its root `AGENTS.md`, selected
   agent skill mirrors and ownership metadata from tracked inputs. Recreating
   the workspace on another machine requires prepared checkouts/developer
   dependencies and one explicit sync.
3. Include all four repositories from the first implementation. Each repository
   continues to own its instructions, source and canonical skills. Empty skill
   roots are valid; membership does not require an installed skill.
4. Start with an offline Node.js command from the `cats-one` checkout. Scope it
   to the Cats member manifest, root routing document and maintenance-skill
   aggregation. Preserve the existing npm launcher's argument forwarding and
   package resolution. Publishing developer tooling through npm is deferred.
5. Read canonical sources directly in one synchronization pass. Do not compose
   the existing per-repository helpers against one shared destination: runtime's
   ownership file assumes one source set, while platform's helper is shallow
   and its `-Clean` removes the entire discovery directory.
6. Use copies for the first version, including all skill resources. Record each
   generated entry's owning repository, relative source and content digest.
   Detect conflicts before applying a plan; preserve unrelated local files and
   locally edited generated content. See SPEC-001 for reconciliation rules.
7. Keep generated root guidance small. It routes work to member-owned rules and
   makes repository-relative command execution explicit. It does not concatenate
   every member's instruction file or make one repository's rules global.
8. Keep the runtime workspace-substrate boundary intact. This command assembles
   an existing Cats source workspace; it does not create a general project
   scaffold, generate member documentation, initialize product user workspaces,
   or expose a competing substrate API. Requirements for those capabilities
   must use the runtime-owned contract rather than grow this command into a
   second general bootstrap engine.
9. Let `cats-one` recognize `cats-apps` as a development member. Desktop App
   version/hash selection, installation, activation and release remain owned
   by platform. A development manifest is not an App bundle lock or npm lockfile.

## Consequences

### Positive

- Root-level agent setup can be reconstructed after clone/pull on another machine.
- Skills retain their repository-owned sources and travel with their resources.
- Cats Apps participates in development routing without changing the App boundary.
- A parent directory needs neither a Git repository nor a specific directory name.

### Negative

- Developers must rerun synchronization after relevant source/template changes.
- An ownership record and explicit conflict handling are required for safe updates.
- Sibling revisions can differ; synchronization records provenance but does not
  establish or claim a tested runtime/platform/apps compatibility set.

### Neutral

- Existing repository-local sync commands remain useful for conversations opened
  inside a single repository. Parent setup does not replace those entrypoints.
- The first implementation requires the four checkouts. Automated cloning,
  partial profiles and cross-repository build/dev orchestration are later work.

## Alternatives Considered

### Maintain parent files manually

Simple locally, but has no tracked source or reproducible update process across
development machines. Rejected for the shared setup.

### Open every conversation in an individual repository

Useful for single-repository tasks, but does not cover the existing workflow of
working across Cats repositories from their parent. Retained as a separate mode.

### Put skills in a user-global discovery directory

Makes them visible across projects, but creates machine-wide state and loses the
workspace's checked-out version relationship. Rejected as the workspace default.

### Turn the parent into another repository or use submodules

Could version the root directly, but changes checkout/version-management policy
for a problem that tracked templates and a sync command can solve. Deferred
unless independent workspace revision pinning becomes a concrete requirement.

### Extend runtime's generic substrate service for the Cats checkout layout

Would make the installed product runtime know Cats-specific member paths and
development sources, and make initial setup depend on a live runtime service. Keep the
Cats composition in `cats-one`; retain runtime ownership of generic substrate
capabilities rather than duplicating that service here.

## References

- [SPEC-001](../specs/SPEC-001-developer-workspace-bootstrap.md)
- [PLAN-001](../plans/PLAN-001-developer-workspace-bootstrap.md)
- [Architecture](../architecture.md)
- [Runtime ADR-015](../../../cats-runtime/docs/decisions/015-own-workspace-substrate-tools-in-cats-runtime.md)
- [Runtime ADR-036](../../../cats-runtime/docs/decisions/036-separate-repository-maintenance-skills-from-runtime-delivered-skills.md)
- [Platform ADR-114](../../../cats-platform/docs/decisions/114-separate-official-app-sources-and-coordinate-desktop-distribution.md)
- [Apps ADR-001](../../../cats-apps/docs/decisions/001-own-official-utility-apps-and-coordinate-desktop-distribution.md)
- [Codex local skill discovery](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)

Sibling links resolve in the proposed four-repository checkout layout.

*Proposed: 2026-09-11*
