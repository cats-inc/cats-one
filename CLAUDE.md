# Claude-Specific Instructions

> **If you are NOT Claude, please ignore this file.**

Read `AGENTS.md` first — it holds the repo contracts and rules.

- **MUST** run `npm test` after modifying `bin/cli.js` or `test/`.
- **MUST NOT** add compatibility fallbacks to the bin resolution (pre-release
  policy: no shims; the canonical contract is the `cats-platform` bin key).
- **MUST NOT** modify other agents' files (CODEX.md, GEMINI.md).
- Commit as `Kenny Chou <sammykenny2@gmail.com>` — verify identity before
  pushing (this repo's history was rewritten once to remove legacy emails).

## Agent Skills

Claude Code discovers skills from `.claude/skills/<name>/SKILL.md`. The canonical
source is `skills/`. `.claude/` is Git-ignored, so run the sync once after a fresh
checkout and again after skill changes:

```powershell
.\scripts\windows\Sync-AgentSkills.ps1
```
