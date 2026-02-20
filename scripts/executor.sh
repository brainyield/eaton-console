#!/usr/bin/env bash
# executor.sh — Launches a Claude Code executor instance for a given task
#
# Usage: ./scripts/executor.sh <task-file>
# Example: ./scripts/executor.sh scripts/executor-tasks/task-002.md
#
# The executor runs non-interactively with tool permissions,
# makes code changes, and exits. The commander reviews the diff.

set -euo pipefail

TASK_FILE="${1:?Usage: $0 <task-file>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$TASK_FILE" ]; then
  echo "ERROR: Task file not found: $TASK_FILE"
  exit 1
fi

TASK_NAME="$(basename "$TASK_FILE" .md)"
LOG_DIR="$REPO_ROOT/scripts/executor-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${TASK_NAME}-$(date +%Y%m%d-%H%M%S).log"

echo "=== Executor starting: $TASK_NAME ==="
echo "Task file: $TASK_FILE"
echo "Log file:  $LOG_FILE"
echo ""

# Snapshot current state for diff review
BEFORE_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo 'no-git')"

# Run claude in non-interactive mode with tool permissions
# --print: non-interactive, print response and exit
# --dangerously-skip-permissions: allow all tool use without prompts
# --model: use sonnet for speed on execution tasks
cd "$REPO_ROOT"
claude \
  --print \
  --dangerously-skip-permissions \
  --model sonnet \
  "$(cat "$TASK_FILE")" \
  2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "=== Executor finished (exit code: $EXIT_CODE) ==="
echo ""

# Show what changed
echo "=== Files changed ==="
git -C "$REPO_ROOT" diff --stat HEAD 2>/dev/null || true
git -C "$REPO_ROOT" diff --stat --cached HEAD 2>/dev/null || true
echo ""
echo "=== Untracked files ==="
git -C "$REPO_ROOT" ls-files --others --exclude-standard 2>/dev/null || true

echo ""
echo "Log saved to: $LOG_FILE"
echo "Review with: git diff"
exit $EXIT_CODE
