# Workspace Writer Lock

Date: 2026-09-11

Source: [proper-lockfile's maintained documentation](https://github.com/moxystudio/node-proper-lockfile)
and the locally installed 4.1.2 implementation.

The library uses atomic directory creation for exclusion, updates lock mtime with
a heartbeat, reclaims stale locks, and reports compromised leases. Its documentation
requires consistent timing settings for users of the same lock and warns against
manual lock removal. Normal process exit releases the lock; SIGKILL can leave it
for stale-lock recovery.

Cats-one declares it as a direct development dependency and fixes the stale/update
intervals at 30/10 seconds. There are no CLI overrides. Read-only commands do not
acquire locks; sync rechecks sources/destinations and keeps a journal/commit marker
so interruption recovery does not depend on an in-memory plan. Lost leases stop
mutation. These are cats-one protocol decisions, documented in
[SPEC-001](../specs/SPEC-001-developer-workspace-bootstrap.md).

Verification uses isolated processes for writer exclusion and SIGKILL checkpoints.
Fixtures age a lock only after confirming its writer has died. Production dependency
versions and the npm files allowlist remain unchanged.
