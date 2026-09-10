#!/bin/bash
#
# Synchronize and check all developer workspace skills.
# With no options, sync .agents/skills and .claude/skills, then check the result.
# The workspace is the parent of this cats-one checkout, independent of cwd.
# Prepare dependencies once with npm ci --include=dev in cats-one.
#
# Usage: ./sync-workspace-skills.sh [--check | --dry-run | --help]
#
set -euo pipefail

usage() {
    cat <<'EOF'
Synchronize and check .agents/skills and .claude/skills in the workspace parent.
The workspace is located from this script; no directory or agent option is needed.

Usage: ./sync-workspace-skills.sh [OPTIONS]

Options:
    -c, --check      Check both targets without writing (exit 1 means drift)
    -n, --dry-run    Preview both targets without writing or recovery
    -h, --help       Show help

Setup once in cats-one: npm ci --include=dev
EOF
}

mode=sync
while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        -c|--check|-n|--dry-run)
            if [ "$mode" != sync ]; then
                echo "Choose either --check or --dry-run, once." >&2
                exit 2
            fi
            case "$1" in
                -c|--check) mode=check ;;
                *) mode=preview ;;
            esac
            shift
            ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    esac
done

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js 22+ is required. Install it and reopen your terminal." >&2
    exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
workspace_root="$(cd -- "$script_dir/../../.." && pwd -P)"
workspace_command="$script_dir/../workspace.mjs"

case "$mode" in
    check) exec node "$workspace_command" check --root "$workspace_root" --agent all ;;
    preview) exec node "$workspace_command" sync --root "$workspace_root" --agent all --dry-run ;;
esac

node "$workspace_command" sync --root "$workspace_root" --agent all
exec node "$workspace_command" check --root "$workspace_root" --agent all
