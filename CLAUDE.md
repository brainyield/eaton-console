# Eaton Console - Project Instructions

## Build Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite build
npm run lint       # ESLint check
npm run db:types   # Regenerate Supabase types from database
```

## Verification Requirements

After making ANY code changes, ALWAYS run:

1. `npm run build` - Must pass with no TypeScript errors
2. `npm run lint` - Must pass with no ESLint errors
3. **Check if CLAUDE.md needs updating** - If you discovered a non-obvious gotcha, bug pattern, or lesson learned during this task, add it to "Common Mistakes to Avoid"

If build/lint fails, fix the issues before considering the task complete.

---

## Project Structure

```
src/
├── App.tsx              # Main router (React Router)
├── main.tsx             # Entry point with providers
├── index.css            # Tailwind + dark theme CSS
├── types/
│   ├── supabase.ts      # Auto-generated (npm run db:types) - DO NOT EDIT
│   ├── database.ts      # Custom TypeScript interfaces
│   └── gmail.ts         # Gmail API types
├── lib/                 # Shared utilities & hooks
│   ├── supabase.ts      # Supabase client
│   ├── hooks.ts         # All React Query hooks + type definitions
│   ├── queryClient.ts   # React Query config + query key factory
│   ├── dateUtils.ts     # Timezone-safe date utilities
│   ├── moneyUtils.ts    # Floating-point safe money operations
│   ├── validation.ts    # Input validation
│   ├── toast.tsx        # Toast context provider
│   └── utils.ts         # Name formatting, age calculation
├── components/
│   ├── Layout.tsx       # Main layout wrapper
│   ├── Sidebar.tsx      # Navigation
│   ├── CommandPalette.tsx
│   ├── *DetailPanel.tsx # Right-side read-only panels
│   ├── *Modal.tsx       # CRUD modal dialogs
│   └── ui/              # Reusable UI components
```

---

## Critical Patterns

### Dates - ALWAYS Use Timezone-Safe Utilities

```typescript
// WRONG - causes timezone bugs
const dateStr = date.toISOString().split('T')[0]

// CORRECT - use dateUtils.ts
import { formatDateLocal, parseLocalDate, getTodayString } from '@/lib/dateUtils'
const dateStr = formatDateLocal(date)
const today = getTodayString()
```

### Money - ALWAYS Use Safe Math Operations

```typescript
// WRONG - floating point errors
const total = rate * hours

// CORRECT - use moneyUtils.ts
import { multiplyMoney, addMoney, formatCurrency } from '@/lib/moneyUtils'
const total = multiplyMoney(rate, hours)
```

### React Query Hooks

All data fetching hooks are in `src/lib/hooks.ts`. Use the existing patterns:

```typescript
// Fetching
const { data: families } = useFamilies({ status: 'active' })

// Mutations
const { createFamily, updateFamily } = useFamilyMutations()
```

Query keys use the factory pattern in `queryClient.ts`:
```typescript
queryKeys.families.list(filters)
queryKeys.families.detail(id)
```

### Supabase Types

- `src/types/supabase.ts` is auto-generated - never edit manually
- Regenerate with: `npm run db:types`
- Custom types go in `src/types/database.ts` or `src/lib/hooks.ts`

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `FamilyDetailPanel.tsx` |
| Hooks | use* prefix | `useFamilies()` |
| Utilities | camelCase | `formatDateLocal()` |
| Types/Interfaces | PascalCase | `Family`, `Invoice` |
| Modal files | *Modal.tsx | `AddEnrollmentModal.tsx` |
| Detail panels | *DetailPanel.tsx | `InvoiceDetailPanel.tsx` |

---

## Common Mistakes to Avoid

- **DON'T** use `toISOString().split('T')[0]` for dates - causes timezone bugs. Use `formatDateLocal()`.
- **DON'T** do direct multiplication/division with money - floating point errors. Use `multiplyMoney()`, `addMoney()`, etc.
- **DON'T** edit `src/types/supabase.ts` - it's auto-generated. Run `npm run db:types` to update.
- **DON'T** create new hook files - add hooks to `src/lib/hooks.ts` following existing patterns.
- **DON'T** use `console.log` in committed code - remove before committing.
- **DON'T** forget `verify_jwt = false` for external webhooks - Supabase Edge Functions require JWT auth by default. External services (Stripe, Calendly, etc.) don't send Authorization headers. Create a `config.toml` in the function directory with `verify_jwt = false`.

---

## Tech Stack Reference

- **React 19** + TypeScript 5.9
- **Vite** for dev server and building
- **TailwindCSS** for styling (dark theme)
- **Supabase** for database and auth
- **TanStack React Query v5** for server state
- **React Router v7** for routing
- **Lucide React** for icons
