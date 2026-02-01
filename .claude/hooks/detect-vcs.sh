#!/bin/bash
# Claude Code Hook: VCS Detection
# Detects the version control system and sets environment variables

set -euo pipefail

cd "$CLAUDE_PROJECT_DIR" || exit 1

# Detect VCS type
if [ -d ".jj" ]; then
    echo "Detected Jujutsu (jj) repository"
    echo "export VCS_TYPE=jj" >> "$CLAUDE_ENV_FILE"
    
    # Check if colocated with git
    if [ -d ".git" ]; then
        echo "  (colocated with git)"
        echo "export JJ_COLOCATED=true" >> "$CLAUDE_ENV_FILE"
    fi
    
    # Show current status
    if command -v jj >/dev/null 2>&1; then
        echo ""
        echo "Current jj status:"
        jj log --limit 3 2>/dev/null || true
    fi
elif [ -d ".git" ]; then
    echo "Detected Git repository"
    echo "export VCS_TYPE=git" >> "$CLAUDE_ENV_FILE"
else
    echo "No version control detected"
    echo "export VCS_TYPE=none" >> "$CLAUDE_ENV_FILE"
fi

exit 0
