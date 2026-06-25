#!/usr/bin/env bash
# Sync Superpowers plugin assets from your local Cursor install into this repo.
# Run after updating the Superpowers marketplace plugin so Cloud Agents stay in sync.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_SKILLS="$REPO_ROOT/.cursor/skills"
DEST_AGENTS="$REPO_ROOT/.cursor/agents"
DEST_COMMANDS="$REPO_ROOT/.cursor/commands"
MANIFEST="$REPO_ROOT/.cursor/superpowers-manifest.json"

find_plugin_root() {
  if [[ -n "${SUPERPOWERS_PLUGIN_ROOT:-}" && -d "$SUPERPOWERS_PLUGIN_ROOT/skills" ]]; then
    printf '%s' "$SUPERPOWERS_PLUGIN_ROOT"
    return 0
  fi

  local cache_root="${HOME}/.cursor/plugins/cache/cursor-public"
  if [[ -d "$cache_root" ]]; then
    local match
    match="$(find "$cache_root" -maxdepth 5 -path '*/skills/using-superpowers/SKILL.md' 2>/dev/null | head -1 || true)"
    if [[ -n "$match" ]]; then
      dirname "$(dirname "$(dirname "$match")")"
      return 0
    fi
  fi

  echo "Could not find Superpowers plugin. Install with /add-plugin superpowers in Cursor, or set SUPERPOWERS_PLUGIN_ROOT." >&2
  return 1
}

PLUGIN_ROOT="$(find_plugin_root)"
VERSION="$(node -pe "JSON.parse(require('fs').readFileSync('$PLUGIN_ROOT/.cursor-plugin/plugin.json','utf8')).version" 2>/dev/null || grep -o '"version": "[^"]*"' "$PLUGIN_ROOT/.cursor-plugin/plugin.json" | head -1 | cut -d'"' -f4)"

echo "Syncing Superpowers v${VERSION} from:"
echo "  $PLUGIN_ROOT"
echo "into:"
echo "  $REPO_ROOT/.cursor/"

mkdir -p "$DEST_SKILLS" "$DEST_AGENTS" "$DEST_COMMANDS"

for skill_dir in "$PLUGIN_ROOT"/skills/*/; do
  name="$(basename "$skill_dir")"
  rm -rf "$DEST_SKILLS/$name"
  cp -a "$skill_dir" "$DEST_SKILLS/$name"
done

rm -rf "$DEST_AGENTS"/* "$DEST_COMMANDS"/*
cp -a "$PLUGIN_ROOT"/agents/* "$DEST_AGENTS/"
cp -a "$PLUGIN_ROOT"/commands/* "$DEST_COMMANDS/"

cat > "$MANIFEST" <<EOF
{
  "name": "superpowers",
  "source": "cursor-marketplace-plugin",
  "syncedVersion": "$VERSION",
  "syncedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sourcePath": "obra/superpowers via Cursor marketplace",
  "skills": [
    "brainstorming",
    "dispatching-parallel-agents",
    "executing-plans",
    "finishing-a-development-branch",
    "receiving-code-review",
    "requesting-code-review",
    "subagent-driven-development",
    "systematic-debugging",
    "test-driven-development",
    "using-git-worktrees",
    "using-superpowers",
    "verification-before-completion",
    "writing-plans",
    "writing-skills"
  ],
  "agents": ["code-reviewer"],
  "notes": "Cloud Agents load repo skills from .cursor/skills/. The bootstrap rule in .cursor/rules/superpowers-bootstrap.mdc replaces the local sessionStart hook."
}
EOF

echo "Done. Commit and push .cursor/ changes so Cloud Agents pick them up."
