# Supabase

Database schema for this app, as migrations under `migrations/`. The Supabase CLI is not a
project dependency; install it separately (`pnpm dlx supabase` also works).

## Applying

First time, from the repo root:

```bash
supabase init            # creates config.toml; keep the existing migrations/ directory
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste a migration into the dashboard's SQL editor.

## If `profiles` already exists

`20260911000000_create_profiles.sql` is written for a fresh project. If your project already
has a `profiles` table, pull the live schema first and reconcile:

```bash
supabase db pull
```

Then compare the generated migration against ours and apply only the differences (typically:
the RLS policies, the column-level `grant update`, and the three triggers).

## Later

- `supabase gen types typescript --linked > src/lib/supabase/database.types.ts` and pass the
  `Database` type to `createClient` so queries are typed end-to-end.
