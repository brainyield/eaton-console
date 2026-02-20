#!/usr/bin/env bash
# run-all-tasks.sh — Runs all P0 optimization tasks sequentially
#
# Usage: cd ~/Projects/eaton-console && ./scripts/run-all-tasks.sh
#
# This script:
# 1. Runs each task via claude -p (non-interactive, no prompts)
# 2. After each task, runs npm run build && npm run lint
# 3. If build/lint passes, commits the changes and moves to next task
# 4. If anything fails, stops and reports which task failed
#
# All decisions have been pre-made by the commander instance.
# The executor just follows instructions.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/scripts/executor-logs"
mkdir -p "$LOG_DIR"

# Task files in execution order (per optimization-roadmap.md recommended order)
TASKS=(
  "scripts/executor-tasks/task-004-teacher-deletion-guard.md"
  "scripts/executor-tasks/task-003-historical-invoice-revenue.md"
  "scripts/executor-tasks/task-005-mailchimp-sync-logging.md"
)

# Task 002 already completed by executor, so it's not in the list

TOTAL=${#TASKS[@]}
COMPLETED=0
FAILED=""

echo "========================================"
echo "  Eaton Console — P0 Task Runner"
echo "  Tasks to run: $TOTAL"
echo "  Started: $(date)"
echo "========================================"
echo ""

for i in "${!TASKS[@]}"; do
  TASK_FILE="${TASKS[$i]}"
  TASK_NAME="$(basename "$TASK_FILE" .md)"
  TASK_NUM=$((i + 1))
  LOG_FILE="$LOG_DIR/${TASK_NAME}-$(date +%Y%m%d-%H%M%S).log"

  echo "========================================"
  echo "  Task $TASK_NUM/$TOTAL: $TASK_NAME"
  echo "  $(date)"
  echo "========================================"
  echo ""

  if [ ! -f "$TASK_FILE" ]; then
    echo "ERROR: Task file not found: $TASK_FILE"
    FAILED="$TASK_NAME (file not found)"
    break
  fi

  # Run the executor
  echo ">>> Running executor..."
  if ! claude \
    --print \
    --dangerously-skip-permissions \
    --allow-dangerously-skip-permissions \
    --model sonnet \
    "$(cat "$TASK_FILE")" \
    2>&1 | tee "$LOG_FILE"; then
    echo ""
    echo "ERROR: Executor failed for $TASK_NAME"
    echo "Log: $LOG_FILE"
    FAILED="$TASK_NAME (executor failed)"
    break
  fi

  echo ""
  echo ">>> Executor finished. Verifying build..."

  # Verify build
  if ! npm run build 2>&1 | tail -5; then
    echo ""
    echo "ERROR: Build failed after $TASK_NAME"
    echo "Log: $LOG_FILE"
    FAILED="$TASK_NAME (build failed)"
    break
  fi

  echo ">>> Build passed. Verifying lint..."

  # Verify lint
  if ! npm run lint 2>&1 | tail -5; then
    echo ""
    echo "ERROR: Lint failed after $TASK_NAME"
    echo "Log: $LOG_FILE"
    FAILED="$TASK_NAME (lint failed)"
    break
  fi

  echo ">>> Lint passed."
  echo ""

  # Show what changed
  echo ">>> Files changed:"
  git diff --stat
  git diff --stat --cached
  echo ""

  # Auto-commit
  echo ">>> Committing changes..."
  git add -A
  git commit -m "$(cat <<EOF
fix: $TASK_NAME

Automated fix from optimization-roadmap.md P0 tasks.
Executed by Claude Code executor, decisions by Claude Code commander.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" || echo "(nothing to commit)"

  echo ""
  COMPLETED=$((COMPLETED + 1))
  echo ">>> Task $TASK_NUM/$TOTAL complete!"
  echo ""
done

echo ""
echo "========================================"
echo "  FINISHED"
echo "  Completed: $COMPLETED/$TOTAL"
if [ -n "$FAILED" ]; then
  echo "  Failed at: $FAILED"
  echo "  Logs: $LOG_DIR"
  echo ""
  echo "  To resume after fixing:"
  echo "  Edit TASKS array in this script to skip completed tasks,"
  echo "  then re-run."
fi
echo "  Ended: $(date)"
echo "========================================"
