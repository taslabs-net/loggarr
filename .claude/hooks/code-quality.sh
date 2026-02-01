#!/bin/bash
# Claude Code Hook: Code Quality Warnings
# Warns about debug statements and other code quality issues after file writes

set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // ""')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.filePath // ""')

# Only check Write and Edit operations
if [[ "$tool_name" != "Write" && "$tool_name" != "Edit" ]]; then
    exit 0
fi

# Skip if no file path
if [[ -z "$file_path" || "$file_path" == "null" ]]; then
    exit 0
fi

# Skip non-code files
case "$file_path" in
    *.md|*.txt|*.json|*.yaml|*.yml|*.toml|*.lock|*.sum)
        exit 0
        ;;
esac

# Check if file exists
if [[ ! -f "$file_path" ]]; then
    exit 0
fi

warnings=()

# Check for debug statements based on file type
case "$file_path" in
    *.go)
        if grep -qE '^\s*fmt\.Print|^\s*log\.Print|^\s*println\(' "$file_path" 2>/dev/null; then
            warnings+=("Go debug statements (fmt.Print/log.Print) detected - use structured logging")
        fi
        ;;
    *.js|*.ts|*.jsx|*.tsx)
        if grep -qE '^\s*console\.(log|debug|info)\(' "$file_path" 2>/dev/null; then
            warnings+=("console.log statements detected - consider using a proper logger or removing before commit")
        fi
        if grep -qE '^\s*debugger\s*;?' "$file_path" 2>/dev/null; then
            warnings+=("debugger statement detected - remove before commit")
        fi
        ;;
    *.py)
        if grep -qE '^\s*print\s*\(' "$file_path" 2>/dev/null; then
            warnings+=("print() statements detected - consider using logging module")
        fi
        if grep -qE '^\s*breakpoint\s*\(\)' "$file_path" 2>/dev/null; then
            warnings+=("breakpoint() detected - remove before commit")
        fi
        ;;
    *.rs)
        if grep -qE '^\s*println!\s*\(' "$file_path" 2>/dev/null; then
            warnings+=("println! macro detected - consider using log/tracing crate")
        fi
        if grep -qE '^\s*dbg!\s*\(' "$file_path" 2>/dev/null; then
            warnings+=("dbg! macro detected - remove before commit")
        fi
        ;;
esac

# Check for TODO/FIXME in new code (all file types)
if grep -qE '(TODO|FIXME|XXX|HACK):?' "$file_path" 2>/dev/null; then
    warnings+=("TODO/FIXME comments found - consider addressing or creating an issue")
fi

# Output warnings if any
if [[ ${#warnings[@]} -gt 0 ]]; then
    echo ""
    echo "Code Quality Warnings for $file_path:"
    for warning in "${warnings[@]}"; do
        echo "  - $warning"
    done
    echo ""
fi

exit 0
