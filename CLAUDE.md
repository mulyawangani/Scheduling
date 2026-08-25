# Playtics Scheduling

Next.js 15 (App Router) + Supabase (Postgres, Auth, RLS) + Vercel. MNRI reflex-integration therapy scheduling app: parents, teachers, and an owner coordinate weekly session plans.

- Live: https://scheduling-peach.vercel.app
- Repo: https://github.com/mulyawangani/Scheduling, branch `main`
- **Pushing to `main` auto-deploys to Vercel production.** No manual `vercel --prod` needed.

## Database migrations

This project has no migration files — schema changes are applied by hand against the live Supabase instance, then reflected back into `supabase/schema.sql` as the source of truth.

Workflow:
1. Write the SQL, explain what it does, show it to the user.
2. User runs it in the Supabase SQL editor and confirms (e.g. "I ran the SQL, go ahead").
3. Verify it landed — write a small throwaway `.mjs` script using the service-role key, run with `node`, delete it after.
4. Update `supabase/schema.sql` and `src/lib/supabase/types.ts` to match.
5. Commit and push.

Never assume a schema change applied just because the SQL was written — always wait for explicit confirmation before building on it.

## Postgres partial unique indexes

Where a table needs "at most one default row" + "at most one row per (X, Y)" simultaneously, use two partial unique indexes (`where y_id is null` / `where y_id is not null`) rather than one plain unique constraint. Supabase's `.upsert(..., {onConflict})` cannot target a partial index — write the upsert by hand instead (select existing row scoped by the right `.is()`/`.eq()`, then `.update()` or `.insert()`).

## Verification before shipping

Before considering a change done: `tsc --noEmit`, `eslint`, `npm run build` must all pass, and any UI change should be exercised in the browser as the actual role that will use it (owner and/or teacher), not just type-checked.

- Browser automation quirk: if `computer.left_click` on a button reports success but the page state never changes (seen once on a `CollapsibleSection` toggle), fall back to dispatching `.click()` on the DOM node directly via the JS execution tool — this reliably works when the coordinate-based click silently no-ops.
- Native `window.confirm()` dialogs are auto-dismissed by the browser tool's `left_click` — override with `window.confirm = () => true` via the JS tool before triggering a confirm-guarded action.

## Domain model

- **Protocols / Sub-Protocols** are the core taxonomy (not "subjects" — that was placeholder data, fully replaced). 6 protocols; only Reflex Repatterning has sub-protocols (24 of them). A `teacher_protocols` row is either protocol-level or sub-protocol-level and carries its own 1–5 rating.
- **Billing rates** (`billing_rates` table): per-child, with an optional per-teacher override. A specific teacher's own rate for a child wins; otherwise the child's default (`teacher_id is null`) rate applies. This is what both the owner's `/admin/suggestions/billing` page and the teacher's `/teacher/commissions` page read from — kept in sync via the shared `src/lib/billing.ts` helper (`lookupBillingRate`). There is no flat per-teacher commission field — that was tried and deliberately retired in favor of this per-child model, matching how the business actually bills and pays.
- Weeks are Monday-start, computed in the business timezone (`src/lib/week.ts`, `src/lib/timezone.ts`). Prefer week-based views (Prev/Next week nav) over calendar-month views for anything about actual delivered sessions — commissions and billing are both scoped this way.
