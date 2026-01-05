---
allowed-tools: Read, Edit
description: Add a new rule to CLAUDE.md to prevent repeated mistakes
argument-hint: <description of the mistake or pattern to avoid>
---

## Your Task

Add a new rule to CLAUDE.md based on the provided description: **$ARGUMENTS**

## Steps

1. Read the current CLAUDE.md file
2. Find the "Common Mistakes to Avoid" section
3. Add a new bullet point describing the mistake and the correct approach
4. Follow the existing format: `- **DON'T** [bad thing] - [consequence]. [Correct approach].`

## Format

The new rule should be formatted like the existing rules:

```markdown
- **DON'T** [describe what not to do] - [why it's bad]. Use [correct approach] instead.
```

## Example

If the argument is "use fetch instead of the supabase client", add:

```markdown
- **DON'T** use raw `fetch()` for database calls - bypasses type safety. Use the Supabase client from `src/lib/supabase.ts`.
```

## Important

- Keep rules concise and actionable
- Include both the mistake AND the correct approach
- Place new rules at the end of the "Common Mistakes to Avoid" section
