# SPEC-001: Developer Workspace Bootstrap

## Metadata

| Field | Value |
|-------|-------|
| Status | In progress; Phase 1 read-only inventory/planning implemented |
| Owner | cats-one maintainers |
| Review | Owner requested implementation; automated validation recorded in PLAN-001 |
| Decision | [ADR-001](../decisions/ADR-001-own-developer-workspace-bootstrap.md) |
| Plan | [PLAN-001](../plans/PLAN-001-developer-workspace-bootstrap.md) |

## Summary

Provide a repeatable local command that assembles agent instructions and
repository-maintenance skills for a Cats development workspace. Tracked inputs
live in `cats-one` and its member repositories; generated outputs live in their
parent directory, which need not be a Git repository. Every machine can rebuild
the same setup from the same source content without copying machine-specific
agent folders between computers.

Phase 1 supplies the tracked inputs and read-only command. Requirements describing
materialization, ownership writes and recovery remain Phase 2 targets; generated
parent files and live-host discovery are not delivered by this phase.

## Goals

- Support agent conversations opened at the parent of the Cats source checkouts.
- Include runtime, platform, apps and one in a versioned workspace definition.
- Preserve repository ownership and skill-relative resources during aggregation.
- Make first-time generation, subsequent updates and drift checks predictable.
- Use one Node.js command across Windows, macOS and Linux, with offline operation
  after explicit developer dependency setup.

## Non-Goals

- Creating a parent Git repository, cloning/fetching/resetting checkouts, installing
  dependencies, or starting/stopping services.
- Synchronizing credentials, user-global agent settings or product persisted state.
- Replacing runtime's generic workspace-substrate APIs or per-repository scaffolds.
- Distributing runtime product skills, App packages or Desktop release artifacts.
- Changing production npm dependencies, launch behavior, or distributing workspace
  tooling in the published package. A declared development parser dependency is
  allowed when implementing the command.
- Implementing arbitrary workspace profiles, custom member layouts or shared
  release revision pinning in the first slice.

## User Stories

1. After checking out the four repositories on a second machine, a developer runs
   one command from their chosen parent directory and gets the workspace setup.
2. After pulling a changed skill, a developer previews and synchronizes the update
   without losing an independently installed skill or a local customization.
3. An agent working from the parent can identify the owning repository and read
   its rules before interpreting relative paths or running commands.

## Requirements

### FR-1: Tracked workspace definition

The tracked `config/developer-workspace.json` in `cats-one` declares a versioned
schema, stable member IDs, relative member paths and canonical skill roots:

| Member ID and relative path | Expected package name | Maintenance-skill root |
|-----------------------------|-----------------------|------------------------|
| `cats-one` | `@cats-inc/cats-one` | `skills/` |
| `cats-runtime` | `@cats-inc/cats-runtime` | `developer-skills/` |
| `cats-platform` | `@cats-inc/cats-platform` | `skills/` |
| `cats-apps` | `@cats-inc/cats-apps` | `skills/` |

All four checkouts and declared source roots are required for the initial full
workspace. An existing empty skill root is valid; a missing member/source root
is an error before any writes or removals. Do not interpret an unavailable
checkout as a deletion of its previously managed skills.

Member identities must match their package names and contain `AGENTS.md`.
Recognize ordinary Git checkouts and worktrees with a `.git` file. Do not require
equal repository versions or matching branch names. The manifest describes
development composition, not an installable npm workspace or release lock.

The manifest and root instruction template resolve relative to the executing
`cats-one` checkout, never an arbitrary caller's current directory. Member paths
resolve relative to the explicit workspace root, and must remain within it.
Verify the executing checkout is the declared `cats-one` member.

Schema v1 has exactly `schemaVersion: 1` and `members`. Each member has exactly
`id`, `path`, `packageName`, `skillRoots` (an array), and `role` (a nonempty,
single-line Markdown table cell). It requires each row above once, with its fixed
path/package and single approved source root. Unknown fields, versions, duplicate
IDs and custom/overlapping layouts fail. `role` supplies the routing template.
Checkout validation reads `.git` or its `gitdir:` pointer and a valid `HEAD`;
it neither runs Git nor compares branches/versions.

### FR-2: Explicit command and scope

Available interface, run from the workspace parent after preparing the developer
dependencies in the cats-one checkout:

```sh
node ./cats-one/scripts/workspace.mjs sync --root . --agent codex --dry-run
node ./cats-one/scripts/workspace.mjs check --root . --agent codex
```

- Require an existing explicit `--root`; do not assume its name is `cats-inc` or
  change the process working directory to redirect output implicitly.
- Support `codex`, `claude` and `all`; default to `codex`. Codex writes
  `.agents/skills`, Claude writes `.claude/skills`, and `all` targets both.
  Other agents may consume a shared path, but are not separately certified here.
- Phase 2 will enable `sync` without `--dry-run` to create/update outputs,
  including a fresh workspace. Phase 1 rejects that invocation with exit `2` and
  an explicit materialization-not-implemented message.
- `sync --dry-run` and `check` are strictly read-only, including when outputs or
  ownership metadata are absent. Neither creates directories or temporary files.
- Exit codes: `0` for a successful sync/preview or an in-sync check; `1` for a
  valid check that found drift; `2` for invalid input, conflicts or I/O failure.
- Report create/update/remove/unchanged/conflict actions with source ownership.
  `--help` is available without `--root` or the parser dependency. Unknown or
  repeated arguments fail explicitly; `--dry-run` is only accepted with `sync`.
- The executable is a developer command from a checkout. The existing `cats-one`
  npm bin keeps forwarding platform arguments and is not the dispatch surface.

### FR-3: Root routing instructions

Render `<root>/AGENTS.md` from the tracked
`templates/workspace/AGENTS.md.template`. Include a generated-file notice, the
source template, the resync command, and the four members' responsibilities.

The instructions must direct agents to:

1. Identify which member owns each requested change.
2. Read that member's `AGENTS.md`, their own agent-specific file when present,
   and relevant member guides before working there.
3. Read only their own agent-specific file, preserving the members' existing
   file-ownership rules.
4. Run repository-relative commands with that member as the working directory;
   interpret a skill's repository-relative references in its owning repository.
   Skill-local resource links remain relative to the skill directory.
5. Treat each checkout's Git state independently and apply only applicable member
   rules. A cross-repository task can require reads from several members.

Generate a compact routing document rather than concatenating all instructions.
It applies to the conversation opened at the parent; do not claim that merely
changing a shell command's working directory reloads an active agent's skills.
Repository-local sessions continue to use each repository's local setup.

The template has exactly one `{{MEMBERS}}` and one `{{SKILLS}}` placeholder;
unknown placeholders fail. Tables include member responsibilities and each
skill's relative canonical origin. Template CRLF is normalized to LF; skill
bytes are not normalized. Phase 1 renders in memory and provides a preview-refresh
command in the notice; Phase 2 must update that notice when apply becomes available.

### FR-4: Canonical skill discovery and materialization

Recursively discover `SKILL.md` under each explicitly declared source root.
Stop descending once a skill root is found, so bundled resources are not treated
as separate skills. Exclude pending `*.bootstrap` proposals. Never scan arbitrary
workspace folders, ignored discovery copies or `cats-runtime/skills/`.

Validate the required frontmatter and safe skill names using the Agent Skills
format. Do not implement YAML parsing with ad hoc line splitting; choose and
test an appropriate existing parser during implementation. A leaf directory name
must match the declared skill name. Copy the complete skill directory to
`<selected-discovery-root>/<name>/`, preserving resources and bytes.

Reject duplicate skill names across sources before any writes, including
case-insensitive filesystem collisions. Report both origins rather than using
discovery order, renaming a skill implicitly or silently choosing one version.

Snapshot observed on 2026-09-11:

- Runtime: `maintain-provider-model-catalogs` under `developer-skills/`.
- Platform: `a2a-handoff` and `project-memory-sync` under `skills/orchestration/`.
- One and Apps: declared `skills/` roots with no skills yet.

This snapshot guides fixtures; production discovery remains data-driven.

Phase 1 uses cats-one's direct `yaml` development dependency with strict YAML
1.2 core parsing. Duplicate keys, unknown tags, aliases and malformed frontmatter
fail; additional metadata fields are allowed. The portable v1 name is 1–64 ASCII
lowercase letters/digits separated by single hyphens, excluding Windows device
names. Description must be a nonempty string of at most 1024 characters; folded
and literal block strings are supported. A UTF-8 BOM and CRLF delimiters are valid.
Skill snapshots include file bytes, nested resources and empty directories.

### FR-5: Ownership and update rules

Maintain one `<root>/.cats-workspace/managed.json` record for this
workspace tool, separate from all existing repository sync manifests. Store a
schema version, generated relative paths, agent target, owning member, relative
canonical source and last-applied content digests. Source/template content
digests determine freshness; timestamps and absolute machine paths do not.

Treat metadata as untrusted input: validate every path and owner before use,
reject malformed records, and never let a record authorize arbitrary deletion.

Phase 1 reads this contract for previews; it does not create ownership records.
The v1 object has exactly `schemaVersion: 1` and `entries`. Each entry has exactly
`path`, `agent`, `member`, `source`, and `digest`:

- Root guidance: path `AGENTS.md`, agent `shared`, member `cats-one`, source
  `templates/workspace/AGENTS.md.template`.
- Skills: path `.agents/skills/<name>` or `.claude/skills/<name>`, matching agent
  `codex` or `claude`, a known member, and a member-relative source below its
  canonical root whose leaf matches the name. Proposal paths are invalid.
- Digests use `sha256:` followed by 64 lowercase hex digits. Unknown fields,
  versions, duplicate paths and invalid provenance are errors.

The digest is SHA-256 over a UTF-8 JSON tuple. A file tuple is
`["file", SHA256(bytes)]`; a directory tuple is `["directory", entries]`,
where entries are sorted depth-first by exact name, each
`[type, relativePath, SHA256(bytes)]` (or `null` for directory content).
Hashes inside the tuple are lowercase hex. Names, types, empty directories and
bytes determine equality; modification times, permissions and absolute paths
do not. Phase 2 must preserve required resource executable permissions when
materializing copies, separately from content freshness.

| Existing destination | Planned behavior |
|----------------------|------------------|
| Missing | Create from the current source and record ownership |
| Managed and unchanged locally | Update to current source, or retain without rewriting |
| Managed, source removed after a valid full inventory | Remove only if the destination still matches its recorded digest |
| Managed and locally edited | Report a conflict; preserve contents |
| Unmanaged and byte-identical to desired content | Report explicit adoption and record ownership during sync |
| Unmanaged and different | Report a conflict; preserve contents |
| Unrelated unmanaged entry | Leave untouched |

Apply these rules to root `AGENTS.md` as well as skill directories. An existing
custom root file requires deliberate manual reconciliation; there is no initial
`--force` or blanket `--clean`. The preview must identify any byte-identical
adoption because future cleanup will then regard that entry as managed.

Selecting one agent must retain metadata and files for unselected agent targets.
Root `AGENTS.md` is shared and checked on every invocation. Syncing `all` preflights
both discovery trees before changing either one.

Preflight the complete inventory, paths and conflicts before writes. A repeat
sync with the same inputs performs no content or metadata rewrites. Persist the
new ownership record only for successfully applied outputs; interruption must
not mark incomplete work as synchronized. Stage replacements and keep recoverable
operation state so a failed apply can restore or finish only its own changes.
The first implementation must test this failure path before claiming completion.
Serialize apply operations with a workspace-local writer lock, and recheck that
sources/destinations still match the previewed inventory before replacing them.
Read-only commands report an active/interrupted apply without repairing it.
Phase 1 reserves `.cats-workspace/writer.lock` and
`.cats-workspace/recovery.json`; the presence of either fails with exit `2`.
Phase 2 must specify and test their durable apply/recovery contents before enabling
writes. Neither reserved file is created by Phase 1.

### FR-6: Path and source protection

Normalize and validate the root and every source/target physically before writes.
Allow an arbitrary existing parent directory and different drive/path names on
different machines, including spaces and Unicode. Reject overlapping member or
source/output roots and traversal outside declared boundaries.

For the initial copy mode, reject symbolic links/junctions in managed source or
destination trees, including the ownership-record path. Do not follow links
during cleanup. Git worktree metadata may point outside the workspace because it
is read for identity/provenance only and is never a mutation target.

Only generated root outputs may change. Member sources, member discovery copies,
Git metadata, user-global skill folders and product state remain outside this
command's write scope. Tests use isolated temporary workspaces.

## Acceptance Criteria

| ID | Scenario and required result |
|----|------------------------------|
| AC-1 | Four fixture checkouts under a non-Git parent produce root guidance, selected mirrors and ownership metadata; no parent Git initialization |
| AC-2 | The current three skills are discovered, including platform's nested skills; empty One/Apps roots succeed and runtime product skills are excluded |
| AC-3 | Skill-local resources remain available; generated guidance maps repository-relative operations to the correct member |
| AC-4 | Byte-identical sources/templates under a different parent name/path produce identical generated contents without absolute machine paths |
| AC-5 | A second sync is a no-op; a source edit updates its mirror; a rename/removal cleans only unmodified managed entries |
| AC-6 | A missing member/source, duplicate name, unsafe path or malformed record fails before mutation; unrelated content survives |
| AC-7 | Custom root instructions and locally edited mirrors are preserved and reported as conflicts; adoption of identical files is visible |
| AC-8 | Fresh/existing-workspace check and preview modes write nothing and return the defined codes; agent selection preserves other targets |
| AC-9 | Interrupted apply can be recovered without losing existing files or trusting an incomplete ownership record |
| AC-10 | Windows, macOS and Linux fixture tests pass; a temporary parent-root Codex session can discover and read a generated skill |
| AC-11 | Existing launcher tests/production dependency ranges remain unaffected and checkout tooling stays outside the npm payload; no service, network install or product-state write occurs during sync |

## Dependencies and Follow-ups

- Requires local Node.js 22+, the four checkouts and explicitly prepared cats-one
  developer dependencies. Declare an existing YAML parser as a direct development
  dependency with a lockfile update during implementation; never import it from
  a sibling checkout's node_modules. Setup may use the ordinary cats-one npm
  install workflow, but sync itself must run offline, never install dependencies
  or start a runtime. Missing parser dependencies produce setup guidance.
- Platform's shallow repository helper is a separate fix in its owning repo;
  this aggregator reads canonical sources and does not depend on that helper.
- Launcher dependency/lockfile alignment is a separate work package. As inspected
  on 2026-09-11, `cats-one` declares platform `^0.1.0` and locks `0.1.1`, while
  the sibling is `0.2.3`; runtime is declared `^0.1.2`, locked `0.1.2`, and the
  sibling is `0.1.21`. These observations do not prove registry availability or
  compatibility and are not synchronization gates.

## Open Questions

No unresolved product choice is needed for the approved first slice.
Custom/partial checkout profiles, npm distribution and cross-repository build/dev
commands are deferred scope, not hidden prerequisites. Parser selection and
read-only schemas are settled above. Durable apply/recovery mechanics must be
finalized and tested in Phase 2 before materialization is enabled.

## References

- [ADR-001](../decisions/ADR-001-own-developer-workspace-bootstrap.md)
- [Architecture](../architecture.md)
- [PLAN-001](../plans/PLAN-001-developer-workspace-bootstrap.md)
- [Codex local skill discovery](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)

*Created: 2026-09-11*
