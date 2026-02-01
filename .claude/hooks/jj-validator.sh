#!/bin/bash
# Claude Code Hook: Jujutsu (jj) Command Validator
# Intercepts git commands in jj repositories and suggests jj equivalents

set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Check if we're in a jj repo
if [ ! -d ".jj" ]; then
    exit 0
fi

# Git command translations
declare -A JJ_TRANSLATIONS=(
    ["git status"]="jj status"
    ["git log"]="jj log"
    ["git diff"]="jj diff"
    ["git add"]="jj (auto-tracks, no add needed)"
    ["git commit"]="jj describe -m 'message' && jj new"
    ["git commit -m"]="jj describe -m 'message' && jj new"
    ["git commit --amend"]="jj describe -m 'message'"
    ["git push"]="jj git push"
    ["git pull"]="jj git fetch && jj rebase -d main"
    ["git fetch"]="jj git fetch"
    ["git checkout"]="jj new <revision>"
    ["git checkout -b"]="jj new main -m 'branch description'"
    ["git branch"]="jj branch list"
    ["git merge"]="jj rebase"
    ["git rebase"]="jj rebase"
    ["git stash"]="jj (not needed, working copy is auto-saved)"
    ["git reset"]="jj restore / jj abandon"
    ["git revert"]="jj backout"
    ["git cherry-pick"]="jj duplicate"
    ["git show"]="jj show"
    ["git blame"]="jj file annotate"
)

# Check if command starts with a git command
for git_cmd in "${!JJ_TRANSLATIONS[@]}"; do
    if [[ "$command" == "$git_cmd"* ]]; then
        jj_equiv="${JJ_TRANSLATIONS[$git_cmd]}"
        cat >&2 << EOF
{
  "decision": "deny",
  "reason": "This is a Jujutsu (jj) repository, not a standard git repo. Use jj commands instead.\n\nGit command: $git_cmd\nJujutsu equivalent: $jj_equiv\n\nKey jj concepts:\n- Working copy changes are automatically tracked (no 'add' needed)\n- 'jj new' creates a new change, 'jj describe' sets the message\n- Use 'jj git push' to push to remote\n- Use 'jj log' to see history"
}
EOF
        exit 2
    fi
done

# Check for git commands that are compatible with jj's colocated mode
# These can pass through but we should warn
PASSTHROUGH_CMDS=("git remote" "git config" "git clone")
for git_cmd in "${PASSTHROUGH_CMDS[@]}"; do
    if [[ "$command" == "$git_cmd"* ]]; then
        # Allow these to pass through in colocated repos
        exit 0
    fi
done

# Generic git command detection
if [[ "$command" == git\ * ]]; then
    cat >&2 << EOF
{
  "decision": "deny", 
  "reason": "This is a Jujutsu (jj) repository. Please use jj commands instead of git.\n\nCommon jj commands:\n- jj status - Show working copy status\n- jj log - Show commit history\n- jj diff - Show changes\n- jj describe -m 'msg' - Set commit message\n- jj new - Create new change\n- jj git push - Push to remote\n\nSee: https://martinvonz.github.io/jj/latest/git-comparison/"
}
EOF
    exit 2
fi

exit 0
