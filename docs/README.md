# Documentation Index

## Current Work

Developer workspace planning was prepared on 2026-09-11. The command is not yet
implemented. Start with the three documents below; their statuses distinguish
the proposal from the existing npm launcher.

| Document | Status | Purpose |
|----------|--------|---------|
| [ADR-001](decisions/ADR-001-own-developer-workspace-bootstrap.md) | Proposed | Why cats-one should own Cats development composition and root setup |
| [SPEC-001](specs/SPEC-001-developer-workspace-bootstrap.md) | Draft | Member/source scope, sync/check behavior and acceptance criteria |
| [PLAN-001](plans/PLAN-001-developer-workspace-bootstrap.md) | Draft | Implementation phases, verification and separate follow-ups |

## Project Entry Points

| Document | Status | Purpose |
|----------|--------|---------|
| [README](../README.md) | Current + proposal | Existing launcher usage and proposed developer-workspace entrypoint |
| [PROGRESS](../PROGRESS.md) | Current | Delivered work versus pending implementation |
| [ROADMAP](../ROADMAP.md) | Current | Next workspace slice and deferred coordination work |
| [Architecture](architecture.md) | Current + proposal | Launcher behavior, four-repository boundaries and planned composition |
| [Agent guide](AGENT-GUIDE.md) | Current | Task routing and documentation/implementation discipline |

## Planning Collections

- [Decisions](decisions/README.md)
- [Specifications](specs/README.md)
- [Implementation plans](plans/README.md)
- [Research](research/README.md)

## Base-Layer Guides

These files came from the repository bootstrap. A template entry is a scaffold,
not evidence of an implemented feature, configured service or runnable command.
Update the affected guide when its feature is implemented.

| Document | Status | Purpose |
|----------|--------|---------|
| [Requirements](requirements.md) | Template | Broad project requirements; workspace requirements currently live in SPEC-001 |
| [API](api.md) | Template | API documentation scaffold |
| [Setup](setup-guide.md) | Template | Environment setup scaffold; current launcher usage is in README |
| [Testing](testing.md) | Template | Test documentation scaffold; actual current command is `npm test` using `test/` |
| [Deployment](deployment.md) | Template | Deployment scaffold |
| [Security](security-guidelines.md) | Template | Security documentation scaffold |
| [MCP](mcp-config.md) | Template | Optional MCP integration guidance |
| [Services](services.md) | Template | Service registry scaffold |
| [Script standards](SCRIPT-STANDARDS.md) | Base guidance | Script help and naming conventions |
| [Terminology](terminology.md) | Base guidance | Collaboration/protocol terminology |
| [A2A](a2a/README.md) | Optional | Protocol integration pointer |
| [Scripts](../scripts/README.md) | Base guidance | Existing repository automation layout |
| [Skills](../skills/README.md) | Current | Repository-local canonical sources and sync helpers; no skills defined yet |

## Documentation Rules

Use the existing ADR/spec/plan templates, link related documents and update their
indexes and dates. Keep proposed commands visibly labeled until they exist.
Sibling links in architecture/planning documents assume the four Cats checkouts
share a parent; ordinary project docs must work in a standalone cats-one checkout.

*Last updated: 2026-09-11*
