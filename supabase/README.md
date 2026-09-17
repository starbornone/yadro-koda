# Supabase

The database schema is **declared**, not migrated: `schemas/` describes the desired end state,
one file per concern, applied in filename order. There is no migration history because there is
no database yet — history starts when a product creates one.

| File                           | Declares                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemas/00_helpers.sql`       | `set_updated_at()` trigger function                                                                                                                                                                                                                                                                                                                                                                                                  |
| `schemas/10_profiles.sql`      | `profiles` mirrored from `auth.users` by triggers, with `backfill_profiles()` for users older than the trigger; RLS; column grants                                                                                                                                                                                                                                                                                                   |
| `schemas/20_organisations.sql` | `organisations` (owner- or superadmin-deletable, cascading), `memberships` (`org_role`, `expires_at`; tier-managed via `can_manage_org_member()`, self-removable, last owner protected, active org forgotten on leaving), `platform_members` (`platform_role` superadmin/admin/support, tier-managed, last superadmin protected), RLS helpers incl. `platform_can_manage_org()` and `shares_org_with()`, `create_organisation()` RPC |
| `schemas/25_invitations.sql`   | `invitations` (to an organisation) and `platform_invitations` (to the staff team): email-bound, token in the link, 7-day expiry, one open per address, optional access end copied onto the membership; `get_invitation()` RPC for the accept screen (works signed out, says which kind); `accept_invitation()` / `accept_platform_invitation()` RPCs that create the membership / staff row                                          |
| `schemas/30_crm.sql`           | Staff-only CRM over organisations: `customers` (one per organisation by trigger; `customer_stage`, owner, source), `contacts` (linked to a member by trigger on join), `activities` (stage changes logged by trigger), `tasks`; `platform_can_manage_customers()`; `customer_stage_counts` view; `create_lead()` RPC                                                                                                                 |

Two access layers are modelled: tenant membership (`is_org_member`, `org_role`, `has_org_role`)
and platform staff (`is_platform_member`, `platform_role`). Tenant policies reach staff through
`platform_can_access_org(org_id)` only — narrow that one function to change staff reach
everywhere.

## Changing the schema

Edit the file that owns the object. Keep each file self-contained and ordered so the set applies
cleanly to an empty database; forward references between files are resolved with a later
`alter table … add constraint`, as `20_organisations.sql` does for `profiles.active_org_id`.

Check syntax without a database:

```bash
pnpm db:check
```

Check behaviour with one — every policy, trigger and RPC, as each kind of user, rolled back
afterwards (`tests/`; needs `DATABASE_URL`):

```bash
pnpm db:test
```

## When a database exists

Create the Supabase project in the region your data must live in — it cannot be moved later.
A project that already has sign-ins is fine: `10_profiles.sql` ends by backfilling a profile for
every existing user. Then either paste the files into the SQL editor in order, or turn them into
the first migration and let the CLI apply it:

```bash
supabase init
supabase link --project-ref <your-project-ref>
mkdir -p supabase/migrations
cat supabase/schemas/*.sql > supabase/migrations/$(date +%Y%m%d%H%M%S)_init.sql
supabase db push
```

From that point on, schema changes are migrations; `schemas/` becomes documentation of the
baseline (or delete it — the migration history is the truth).

## Generated types

`src/lib/supabase/database.types.ts` is generated from the database and passed to
`createClient<Database>`, so every table, column, enum and RPC signature the app uses is
checked at compile time — embedded selects included, which is why the data layer's select
strings are literal types (`as const`) and its results are returned without casts. A misspelt
column in `profile:profiles(id, display_name)` is a `tsc` error. Regenerate after any schema
change:

```bash
pnpm db:types   # needs DATABASE_URL in .env.local (Connect → Session pooler); then pnpm format
```

This runs the same generator as `supabase gen types typescript`, minus the Docker or access
token that command needs. The generated file is committed so CI and editors see the types.

## Auth settings

The password-reset flow needs one thing that lives outside the schema: the auth redirect
allow-list. The app passes `<origin>/reset-password` as `redirectTo` when requesting a reset;
Supabase refuses targets that are not on the list and falls back to the Site URL. (The app still
recovers — a recovery session landing on `/` is redirected to `/reset-password` — but the
allow-list is the correct fix.)

It is declared in `config.toml` under `[auth]` — `site_url` and `additional_redirect_urls`,
with `http://localhost:5173/**` for the dev server — and applied to the hosted project with the
CLI (needs `supabase login` and a linked project):

```bash
supabase config push
```

Or set the same two values by hand under **Authentication → URL Configuration**, adding each
deployed origin as `https://<your-domain>/**`. The default **Reset Password** email template
(`{{ .ConfirmationURL }}`) works as-is.
