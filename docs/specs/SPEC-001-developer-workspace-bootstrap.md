# SPEC-001: Developer Workspace Bootstrap

## Metadata

| Field | Value |
|-------|-------|
| Status | Phases 1–2 implemented; live-host discovery validation pending |
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

Tracked inputs, inventory/planning, managed materialization and interruption
recovery are implemented. The command generates parent files explicitly through
`sync`; `check` and `sync --dry-run` remain read-only. Live-host discovery is a
separate validation item in PLAN-001.

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
  tooling in the published package. Direct development dependencies provide YAML parsing and writer locking.
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
| `cats-runtime` | `@cats-inc/cats-runtime` | `skills/` |
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
node ./cats-one/scripts/workspace.mjs sync --root . --agent codex
node ./cats-one/scripts/workspace.mjs check --root . --agent codex
```

- The Node CLI requires an existing explicit `--root`; do not assume its name is
  `cats-inc` or change the process working directory to redirect output implicitly.
- Support `codex`, `claude` and `all`; default to `codex`. Codex writes
  `.agents/skills`, Claude writes `.claude/skills`, and `all` targets both.
  Other agents may consume a shared path, but are not separately certified here.
- `sync` without `--dry-run` creates/updates outputs, including a fresh workspace.
  It recovers any interrupted operation before planning new changes. It never
  delegates mutation to the sibling sync helpers.
- `sync --dry-run` and `check` are strictly read-only, including when outputs or
  ownership metadata are absent. Neither creates directories or temporary files.
- Exit codes: `0` for a successful sync/preview or an in-sync check; `1` for a
  valid check that found drift; `2` for invalid input, conflicts or I/O failure.
- Report create/update/remove/unchanged/conflict actions with source ownership.
  `--help` is available without `--root` or the parser dependency. Unknown or
  repeated arguments fail explicitly; `--dry-run` is only accepted with `sync`.
- The executable is a developer command from a checkout. The existing `cats-one`
  npm bin keeps forwarding platform arguments and is not the dispatch surface.

Convenience entrypoints are `scripts/windows/Sync-WorkspaceSkills.ps1` and
`scripts/{linux,macos}/sync-workspace-skills.sh`. With no arguments they derive
the workspace parent from their script location, pass an explicit root and
`--agent all` to Node `sync`, and run Node `check` only after a successful sync.
The caller's working directory cannot redirect their outputs. Both commands'
exit codes propagate. They reuse the complete Node validation/recovery protocol.

`-WhatIf` / `--dry-run` runs only read-only preview; `-Check` / `--check` runs only
read-only check. Combining those modes fails without writing. `-Help` / `--help`
needs no Node installation or developer dependencies. Unknown options fail.
The PowerShell helper supports Windows PowerShell 5.1 and PowerShell 7; Bash
entrypoints are committed with mode `100755` and support direct execution on
Linux/macOS. Setup remains explicit and the wrappers never install dependencies.

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
bytes are not normalized. The notice provides the OS sync helpers and explains
preview, with setup guidance for individual targets. The same rendering feeds
preview and apply.

### FR-4: Canonical skill discovery and materialization

Recursively discover `SKILL.md` under each explicitly declared source root.
Stop descending once a skill root is found, so bundled resources are not treated
as separate skills. Exclude pending `*.bootstrap` proposals. Never scan arbitrary
workspace folders, ignored discovery copies or `cats-runtime/runtime-skills/`.

Validate the required frontmatter and safe skill names using the Agent Skills
format. Do not implement YAML parsing with ad hoc line splitting; choose and
test an appropriate existing parser during implementation. A leaf directory name
must match the declared skill name. Copy the complete skill directory to
`<selected-discovery-root>/<name>/`, preserving resources and bytes.

Reject duplicate skill names across sources before any writes, including
case-insensitive filesystem collisions. Report both origins rather than using
discovery order, renaming a skill implicitly or silently choosing one version.

Snapshot observed on 2026-09-11:

- Runtime: `maintain-provider-model-catalogs` under `skills/`.
- Platform: `a2a-handoff` and `project-memory-sync` under `skills/orchestration/`.
- One and Apps: declared `skills/` roots with no skills yet.

This snapshot guides fixtures; production discovery remains data-driven.

The 2026-09-11 owner-approved directory alignment sets all four canonical roots
to `skills/`. The runtime product library is `runtime-skills/` and remains
excluded. For existing generated ownership only, accept the exact former
`cats-runtime` source `developer-skills/maintain-provider-model-catalogs` for
that same skill name. Reconcile it to the new source with normal content-digest,
selection, conflict and journal checks; do not discover retired roots or accept
other historical/product sources. Unselected mirrors retain their ownership
until selected in a later sync.

The command uses cats-one's direct `yaml` development dependency with strict YAML
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

Preview validates existing ownership; successful sync writes the reconciled
record after replacing outputs. The v1 object has exactly `schemaVersion: 1`
and `entries`. Each entry has exactly
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
do not. Materialized copies preserve file/directory permission bits (including
Unix executable resources), separately from content freshness. A content no-op
does not rewrite files solely to reset their permissions.

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
The protocol below defines those reserved paths. Read-only commands return `2`
when any lock, recovery, transaction, pending publication or commit marker exists;
they never acquire a lock or repair/clean up the state.

#### Writer and recovery protocol

Only `sync` mutates `.cats-workspace/`. A clean no-op returns before creating a
lock or changing directory/file timestamps. Invalid inventory, metadata and
ordinary conflicts likewise fail before state creation.

Writer exclusion uses the direct `proper-lockfile` dependency with an empty
`writer.lock/` directory, a fixed 30-second stale interval and 10-second heartbeat
for every invocation. A live/recent lock fails immediately; retry after the writer
finishes or the stale interval following a crash. Never delete the lock manually
or override lease timings. A compromised writer stops; another writer must own
the lock before recovering. See the [lock research note](../research/2026-09-11-workspace-writer-lock.md).

Before staging or replacing outputs, publish `recovery.json` by writing and
syncing `recovery.pending`, then renaming it. A partial unpublished record cannot
have changed outputs and is discarded by the next sync. The recovery object has
exactly these fields:

| Field | Contract |
| --- | --- |
| `schemaVersion` | `1` |
| `agent` | `codex`, `claude` or `all` |
| `beforeMetadata` | Exact previous ownership JSON text, or `null` |
| `afterMetadata` | Exact next ownership JSON text |
| `operations` | Ordered objects containing only `path`, `before`, `after`; digests or `null` mean present or absent |
| `createdDirectories` | Selected discovery ancestors that were absent; rollback may remove them only when empty |

Validate both ownership texts using the normal ownership schema, require all
unselected entries to remain equal, and derive allowed operation paths/digests
from them. Every physical output operation is within that selected set.
The final operation is `managed.json`, whose digests match the two exact JSON
texts. Its before/after digests can be equal when recreating a missing mirror.

Stage complete desired snapshots at `transaction/new/<index>`. Before each
replacement, recheck the destination and canonical source; re-inventory before
apply and before ownership commit, including unchanged/adopted destinations.
Rename an existing destination to `transaction/old/<index>`, then rename its
staged replacement into place. Backups retain the original bytes/permissions.
The operation is not a single atomic multi-file transaction; a pending journal
prevents a partial result being reported as synchronized.

After all replacements and ownership installation, atomically publish
`committed.json` via `commit.pending`. Its exact fields are
`schemaVersion: 1`, `recoveryDigest` and `metadataDigest`; both digests must match
the journal and final ownership. This explicit marker is needed even when old
and new ownership bytes are identical.

On the next sync, validate the whole journal, staged/backup paths and destinations
before any recovery mutation. Without the commit marker, restore backups in
reverse order and remove only the transaction's newly created outputs. With the
marker, require committed outputs to match and finish cleanup. Changed originals,
backups or outputs stop recovery and preserve evidence for deliberate conflict
resolution. Incomplete staging is disposable only while its original destination
remains unchanged and has no backup.

Move disposable entries into `transaction/trash/<side>-<index>` before recursive
deletion; `side` is `new`, `old` or `installed`. Only validated transaction
slots are permitted, with no links or arbitrary paths. Trash can be partially
deleted on restart. This also makes interrupted rollback deletion recoverable.
Remove empty transaction directories, then the journal, then the commit marker.
A leftover commit marker without a journal is removed only when ownership still
matches its recorded digest. Unknown/orphan transaction state is preserved and
reported rather than interpreted as permission to delete arbitrary files.

Files are synced before publication and directories are synced where Node's
platform API supports it. Tests inject process termination, including SIGKILL;
they do not claim filesystem/hardware power-loss certification. All persistent
ownership content is relative and deterministic; locks/journals are transient
protocol state.

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
  developer dependencies. YAML and proper-lockfile are direct development
  dependencies recorded in the lockfile; never import from a sibling checkout's
  node_modules. Setup may use the ordinary cats-one npm
  install workflow, but sync itself must run offline, never install dependencies
  or start a runtime. Missing developer dependencies produce setup guidance.
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
commands are deferred scope, not hidden prerequisites. Parser selection, ownership schemas and durable recovery mechanics are
implemented above. Live agent-host discovery remains a separate validation item.

## References

- [ADR-001](../decisions/ADR-001-own-developer-workspace-bootstrap.md)
- [Architecture](../architecture.md)
- [PLAN-001](../plans/PLAN-001-developer-workspace-bootstrap.md)
- [Codex local skill discovery](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)

*Created: 2026-09-11*
