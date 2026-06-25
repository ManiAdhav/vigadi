# Agent instructions (local + Cloud)

This repo vendors the [Superpowers](https://github.com/obra/superpowers) plugin so Cloud Agents get the same skills and workflows as local Cursor.

## Superpowers in this repo

| Asset | Location |
|-------|----------|
| Skills (14) | `.cursor/skills/<name>/SKILL.md` |
| Code reviewer subagent | `.cursor/agents/code-reviewer.md` |
| Bootstrap rule (replaces `sessionStart` hook) | `.cursor/rules/superpowers-bootstrap.mdc` |
| Sync manifest | `.cursor/superpowers-manifest.json` |

## Cloud vs local

- **Local:** Superpowers also runs via the marketplace plugin and `sessionStart` hook.
- **Cloud:** Uses the **repo copies** above. User-level `~/.cursor/plugins/` is not available on Cloud VMs.

After changing Superpowers locally, re-sync into the repo:

```bash
./scripts/sync-superpowers.sh
git add .cursor/ scripts/sync-superpowers.sh
git commit -m "chore: sync Superpowers to repo for Cloud Agents"
git push
```

## Skill usage

Before implementing features, fixing bugs, or planning work, check `.cursor/skills/` for a matching skill. If one might apply (even slightly), read its `SKILL.md` and follow it.

Key workflows:

- New feature or behavior change → `brainstorming`, then `writing-plans` or `test-driven-development`
- Bug or test failure → `systematic-debugging`
- Multi-step plan ready → `executing-plans` or `subagent-driven-development`
- Major step complete → `requesting-code-review` (uses `code-reviewer` agent)
- Before claiming done → `verification-before-completion`
