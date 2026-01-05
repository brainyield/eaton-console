---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git push:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(gh pr:*)
description: Stage, commit, push changes and create a PR
---

## Context

Gather information about the current state:

- Current git status: !`git status`
- Current git diff (staged and unstaged): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits for style reference: !`git log --oneline -5`

## Your Task

Based on the changes shown above:

1. **Stage all relevant changes** using `git add`
   - Review what's being staged
   - Don't stage files that shouldn't be committed (.env, temp files, etc.)

2. **Create a descriptive commit message** that:
   - Starts with a type: feat, fix, refactor, docs, chore
   - Summarizes the "why" not just the "what"
   - Is concise (1-2 sentences max)

3. **Push to the current branch** with `git push -u origin <branch>`

4. **Create a PR** using `gh pr create` with:
   - A clear title matching the commit message
   - A body with:
     - Summary (2-3 bullet points)
     - Test plan if applicable

## Example Commit Message Format

```
feat: Add invoice PDF export functionality

Allows users to download invoices as PDFs for record keeping.
```

## Important

- If on `main` branch, create a new feature branch first
- Don't force push
- Don't commit sensitive files (.env, credentials, etc.)
