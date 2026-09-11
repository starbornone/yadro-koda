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

## Auth settings (dashboard)

The password-reset flow needs one thing that lives outside migrations:

- **Authentication → URL Configuration → Redirect URLs** must include the reset page for every
  environment, e.g. `http://localhost:5173/reset-password` and
  `https://<your-domain>/reset-password`. The app passes this as `redirectTo` when requesting a
  reset; Supabase refuses redirect targets that are not on the list and falls back to the Site
  URL. (The app still recovers — a recovery session landing on `/` is redirected to
  `/reset-password` — but the allow-list is the correct fix.)
- The default **Reset Password** email template (`{{ .ConfirmationURL }}`) works as-is.

## Later

- `supabase gen types typescript --linked > src/lib/supabase/database.types.ts` and pass the
  `Database` type to `createClient` so queries are typed end-to-end.
