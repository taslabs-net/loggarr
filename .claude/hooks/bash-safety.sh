#!/bin/bash
# Claude Code Hook: Bash Safety
# Blocks or warns about dangerous bash commands

set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Skip empty commands
if [[ -z "$command" ]]; then
    exit 0
fi

# Dangerous patterns that should be blocked
# Pattern: rm -rf with root or home paths
if echo "$command" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|f[a-zA-Z]*r[a-zA-Z]*)\s+(/|~|\$HOME|/home|/usr|/etc|/var|/opt|\.\.)'; then
    cat >&2 << EOF
{
  "decision": "deny",
  "reason": "Dangerous rm -rf command targeting sensitive directory detected. This could delete critical system or user files.\n\nPlease:\n- Verify the exact path you want to delete\n- Use a more specific path\n- Consider moving to trash instead"
}
EOF
    exit 2
fi

# Block sudo rm -rf
if echo "$command" | grep -qE 'sudo\s+rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|f[a-zA-Z]*r[a-zA-Z]*)'; then
    cat >&2 << EOF
{
  "decision": "deny",
  "reason": "sudo rm -rf is extremely dangerous and blocked by policy.\n\nIf you need to remove system files, please do so manually with careful verification."
}
EOF
    exit 2
fi

# Warn about chmod 777
if echo "$command" | grep -qE 'chmod\s+777'; then
    cat >&2 << EOF
{
  "decision": "deny",
  "reason": "chmod 777 grants full permissions to everyone - this is a security risk.\n\nConsider:\n- chmod 755 for directories\n- chmod 644 for files\n- chmod 700 for private directories"
}
EOF
    exit 2
fi

# Warn about curl | bash patterns
if echo "$command" | grep -qE 'curl.*\|\s*(sudo\s+)?bash|wget.*\|\s*(sudo\s+)?bash'; then
    cat >&2 << EOF
{
  "decision": "ask",
  "reason": "Piping curl/wget directly to bash can execute arbitrary code.\n\nConsider:\n1. Download the script first\n2. Review its contents\n3. Then execute if safe"
}
EOF
    exit 2
fi

exit 0
