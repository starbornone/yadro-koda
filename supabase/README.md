# Supabase

The database schema is **declared**, not migrated: `schemas/` describes the desired end state,
one file per concern, applied in filename order. There is no migration history because there is
no database yet — history starts when a product creates one.

| File                           | Declares                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemas/00_helpers.sql`       | `set_updated_at()` trigger function                                                                                                                                                                                                                                                                                                     |
| `schemas/10_profiles.sql`      | `profiles` mirrored from `auth.users` by triggers; RLS; column grants                                                                                                                                                                                                                                                                   |
| `schemas/20_organisations.sql` | `organisations`, `memberships` (`org_role`, `expires_at`; tier-managed via `can_manage_org_member()`, last owner protected), `platform_members` (`platform_role` superadmin/admin/support, tier-managed, last superadmin protected), RLS helpers incl. `platform_can_manage_org()` and `shares_org_with()`, `create_organisation()` RPC |
| `schemas/25_invitations.sql`   | `invitations` (email-bound, token in the link, 7-day expiry, one open per address per organisation); `get_invitation()` RPC for the accept screen (works signed out); `accept_invitation()` RPC that creates the membership                                                                                                             |
| `schemas/30_crm.sql`           | Staff-only CRM over organisations: `customers` (one per organisation by trigger; `customer_stage`, owner, source), `contacts` (linked to a member by trigger on join), `activities` (stage changes logged by trigger), `tasks`; `platform_can_manage_customers()`; `customer_stage_counts` view; `create_lead()` RPC                    |

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

## When a database exists

Create the Supabase project in the region your data must live in — it cannot be moved later.
Then either paste the files into the SQL editor in order, or turn them into the first migration
and let the CLI apply it:

```bash
supabase init
supabase link --project-ref <your-project-ref>
mkdir -p supabase/migrations
cat supabase/schemas/*.sql > supabase/migrations/$(date +%Y%m%d%H%M%S)_init.sql
supabase db push
```

From that point on, schema changes are migrations; `schemas/` becomes documentation of the
baseline (or delete it — the migration history is the truth). Then generate types so queries are
checked end-to-end:

```bash
supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

and pass the `Database` type to `createClient`.

## Auth settings (dashboard)

The password-reset flow needs one thing that lives outside the schema:

- **Authentication → URL Configuration → Redirect URLs** must include the reset page for every
  environment, e.g. `http://localhost:5173/reset-password` and
  `https://<your-domain>/reset-password`. The app passes this as `redirectTo` when requesting a
  reset; Supabase refuses redirect targets that are not on the list and falls back to the Site
  URL. (The app still recovers — a recovery session landing on `/` is redirected to
  `/reset-password` — but the allow-list is the correct fix.)
- The default **Reset Password** email template (`{{ .ConfirmationURL }}`) works as-is.
