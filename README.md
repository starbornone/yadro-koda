# Јадро Кода

A React single-page app boilerplate for organisation-based (multi-tenant) products: a public
marketing site, Supabase authentication (email/password sign-up, login, password reset and
change), user profiles, organisations with role-based memberships and invitations, an app shell
with an organisation switcher, and a staff area that doubles as a CRM over every organisation.

## Stack

- [Vite 8](https://vite.dev) + [React 19](https://react.dev) + TypeScript 6
- [Tailwind CSS 4](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com) (`radix-luma` style, `radix-ui` primitives, `lucide-react` icons)
- [TanStack Router](https://tanstack.com/router) (code-based routes)
- [Supabase](https://supabase.com) (`@supabase/supabase-js`) for auth and data
- ESLint 9 (flat config) + Prettier

## Getting started

Requires Node 24 and [pnpm](https://pnpm.io) 12.

```bash
pnpm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
pnpm dev
```

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` the public site still runs (handy
when working on marketing pages): the app logs a warning, treats every visitor as signed out, and
any sign-in or data call reports "Supabase is not configured" in the UI. See
[`src/lib/supabase/supabase.ts`](src/lib/supabase/supabase.ts).

### Supabase

The schema is declared in [`supabase/schemas`](supabase/schemas) — see
[`supabase/README.md`](supabase/README.md) for how to apply it. In short: a `public.profiles`
table kept in sync with `auth.users` by triggers; `organisations`, `memberships` and
`platform_members` with RLS helpers (`is_org_member`, `has_org_role`, `platform_can_access_org`);
`invitations` and `platform_invitations` with the `get_invitation()` / `accept_invitation()` /
`accept_platform_invitation()` RPCs; the staff-only CRM tables
(`customers`, `contacts`, `activities`, `tasks`); and column grants so clients can only write the
fields they own.

## Scripts

| Script              | What it does                              |
| ------------------- | ----------------------------------------- |
| `pnpm dev`          | Start the Vite dev server with HMR        |
| `pnpm build`        | Typecheck (`tsc -b`) and build to `dist/` |
| `pnpm preview`      | Serve the production build locally        |
| `pnpm typecheck`    | Typecheck only                            |
| `pnpm lint`         | ESLint                                    |
| `pnpm lint:fix`     | ESLint with autofix                       |
| `pnpm format`       | Prettier, write                           |
| `pnpm format:check` | Prettier, check only                      |
| `pnpm test`         | Vitest, single run                        |
| `pnpm test:watch`   | Vitest in watch mode                      |
| `pnpm db:check`     | Parse the SQL schema (no database needed) |

## Project layout

```
src/
  main.tsx              # React root; starts the theme store, mounts the router
  router.tsx            # Route tree: `_public` (marketing), /login, /signup, /reset-password,
                        # /invite, and `_authenticated` (guards + profile loader). Everything
                        # past the marketing home is a lazy chunk.
  App.tsx               # Root layout (renders <Outlet />)
  index.css             # Tailwind, shadcn light/dark tokens, font
  config/site.ts        # Site-wide constants (title)
  lib/
    utils.ts            # cn() helper
    auth/               # Session store, route APIs (_authenticated, _app, _staff), permissions
    format.ts           # Date formatting
    theme/              # Theme store: light / dark / system, persisted, applied to <html>
    supabase/           # Supabase client; profile, organisation, invitation, platform, CRM queries
  features/
    auth/               # Auth layout, login / sign-up / reset forms and hooks
    organisations/      # Create-organisation form, members section, and the settings /
                        # members / invite page hooks
    staff/              # Staff team and organisation page hooks
    crm/                # Customer record sections (pipeline, contacts, activity, tasks), stages
    accounts/           # Account chooser hook
    marketing/          # Placeholder copy for the public site (content.ts)
    profile/            # Profile, change-password and account sections + page hook
  pages/                # Route components (staff/ for the staff area)
  components/
    ui/                 # shadcn primitives (generated; edit sparingly)
    confirm-button.tsx  # Button that asks before an irreversible action
    invitations-section.tsx # Invite-by-link form and open invitations (organisation or staff team)
    layout/             # PublicLayout (marketing), AppShell + StaffShell (sidebars),
                        # PageHeader (breadcrumbs)
    theme/              # ThemeToggle dropdown
    router/             # Pending / error / not-found screens used by the router
    sidebar/            # App and staff sidebar composition
    navigation/         # Nav items, organisation switcher, user menu
  hooks/                # Shared hooks (useIsMobile, useRouteAction)
  test/setup.ts         # Vitest setup: jest-dom matchers, jsdom stubs
```

Tests live next to the code they cover as `*.test.ts(x)`.

Path alias: `@/` → `src/`.

## Routes

| Path                     | Who                  | What                                                           |
| ------------------------ | -------------------- | -------------------------------------------------------------- |
| `/`                      | everyone             | Marketing home; signed-in visitors get a Dashboard CTA         |
| `/login`                 | signed out           | Sign in (`?redirect=` honoured); signed in → /accounts         |
| `/signup`                | signed out           | Create account; signed in → /accounts                          |
| `/reset-password`        | from the email link  | Set a new password, or request a fresh link                    |
| `/invite/$token`         | from the invite link | What the invitation is; sign in, sign up or accept             |
| `/accounts`              | signed in            | Choose where to go: staff area or an organisation              |
| `/onboarding`            | signed in, no org    | Create your first organisation                                 |
| `/app`                   | signed in + member   | Dashboard, inside the active organisation                      |
| `/app/settings`          | signed in + member   | Organisation settings (owners/admins can edit)                 |
| `/app/members`           | signed in + member   | Who belongs; owners/admins invite, change roles, remove; leave |
| `/app/organisations/new` | signed in + member   | Create another organisation                                    |
| `/app/profile`           | signed in + member   | Profile, password, account, sign-out                           |
| `/staff`                 | staff                | Overview: counts, pipeline by stage, your open tasks           |
| `/staff/organisations`   | staff                | Every organisation (`?q=`, `?stage=`); `new` for leads         |
| `/staff/organisations/…` | staff                | Customer record: pipeline, contacts, tasks, members            |
| `/staff/team`            | staff                | Platform members; admins and up invite, change, remove         |
| `/staff/profile`         | staff                | The profile page, inside the staff shell                       |

Every route sets its `<title>` via TanStack's `head()`; the home page also sets a meta
description. Marketing copy is placeholder and lives in `src/features/marketing/content.ts`.

## Organisations and roles

There are two layers of users, each with its own roles, routes and shell:

- **Tenants.** Every product object belongs to an **organisation**; users join through
  `memberships` with an `org_role` (`owner` | `admin` | `member` — generic names a product
  renames). They live under `/app/*`.
- **Staff.** The company's own people have a `platform_members` row with a `platform_role` and
  live under `/staff/*`, looking across every tenant. Staff never self-sign-up. Three tiers:
  - `superadmin` — full access: every tenant read **and write**, and the whole staff team.
  - `admin` — reads tenants; manages staff below superadmin.
  - `support` — reads tenants.

  Staff join by invitation from `/staff/team` (`platform_invitations`, same link and accept
  screen as organisation invitations): superadmins invite as any role, admins as anything below
  superadmin, support nobody — `platform_can_manage_member()` again.

  Tenant RLS reaches staff through two functions, so staff reach can be narrowed in one place:
  `platform_can_access_org()` (read, every tier) and `platform_can_manage_org()` (write,
  superadmin only). Staff-team writes go through `platform_can_manage_member()`, which never lets
  anyone act above their own tier, and the database refuses to remove the last superadmin.
  Colleagues can see each other's profiles (`shares_org_with()`); staff can see everyone's.

**One person, several accounts.** The same sign-in can be staff _and_ a member of organisations
— it is one `auth.users` row with a `platform_members` row and memberships, so nothing is
blocked by email. After sign-in, `/accounts` decides where to go: exactly one place → straight
there (`/app`, `/staff`, or `/onboarding` when there is nothing yet); several → a chooser listing
the staff area and each organisation with the user's role in it. "Switch account" in the user menu
returns to it, and each shell links across to the other.

Both layers hang off the `_authenticated` route, whose loader fetches `profile`, `memberships`
and `platformRole` once. Non-staff who open `/staff` are sent to `/app`.

- `create_organisation()` (RPC) is the only way to make an organisation: it inserts the row,
  makes the caller its owner and marks it active, atomically.
- **Everyone else joins by invitation.** An owner or admin (or a superadmin, on the tenant's
  behalf) creates an `invitations` row for an email and a role — never a role above their own —
  and the app turns it into a link (`/invite/<token>`) for them to pass on; nothing is emailed.
  The link shows what the invitation is before asking for a sign-in, and `accept_invitation()`
  (RPC) only lets a session whose profile email matches accept: it creates the membership,
  marks the invitation used and makes the organisation active, atomically. Links last 7 days;
  revoking deletes the row; one open invitation per address per organisation. Staff-team
  invitations (`platform_invitations`, `accept_platform_invitation()`) work the same way;
  `get_invitation()` tells the invite page which kind a link is, and the page sends the person
  to `/app` or `/staff` accordingly.
- **Managing members** (`/app/members`) follows the same tier rule in SQL
  (`can_manage_org_member()`): owners change or remove anyone, admins anyone below owner. The
  UI never offers it on your own row, and the database refuses to remove or demote the last
  owner. Roles are the only membership column clients may write. Anyone may **leave** (their
  own row is deletable), except the last owner — the page says so before they try. A trigger
  clears `profiles.active_org_id` for whoever leaves or is removed, so the app falls back to
  another of their organisations, or to onboarding.
- The `_authenticated` route loads `profile`, `memberships` and `platformRole` once. The `_app`
  layout beneath it reads them through `parentMatchPromise`, redirects when there are no
  memberships, and resolves the active organisation (`profiles.active_org_id`, else the first
  membership) into its loader data as `{ org, role, memberships }`; `_staff` does the same for
  `{ platformRole, hasOrganisations }`. Pages reach these via `appRoute` / `staffRoute`
  (`getRouteApi`).
- **Guards that need data live in loaders, and child loaders must wait for them.** Loaders run
  in parallel, so a page loader under `_staff` calls `guardedBy(parentMatchPromise)` before
  fetching — otherwise its request would go out even when the guard redirects.
- Switching organisations writes `active_org_id` and calls `router.invalidate()`. The router runs
  reloads in **blocking** mode (`defaultStaleReloadMode`) so child loaders always see fresh parent
  data after an invalidate.
- `canInOrg(role, action)` and `canOnPlatform(role, action)` in `src/lib/auth/permissions.ts`
  decide what the UI shows; RLS decides what the database allows. Both must agree; the database
  wins.
- `memberships.expires_at` supports time-boxed access (e.g. an external reviewer) — RLS ignores
  expired memberships.

## CRM

The staff area is a CRM over the organisations table. **An organisation is the customer record
for its whole life**: staff enter it as a lead (no users yet), and the same row becomes the
tenant when its first person joins — nothing is copied between a "lead" and a "customer". What
staff know about it lives in tables tenants cannot read (`supabase/schemas/30_crm.sql`):

- `customers` — one row per organisation, created by trigger: `stage` (`lead` → `qualified` →
  `trial` → `active`, or `churned` / `lost` — a generic funnel a product renames), `owner_id`
  (the responsible staff member) and `source`. A self-serve sign-up starts at `trial`;
  `create_lead()` starts at `lead`, owned by whoever entered it. Every stage change is logged to
  the timeline by trigger.
- `contacts` — people at the customer, whether or not they have a sign-in; one primary per
  organisation. `user_id` links a contact to their account: set by trigger when someone joins
  the organisation with the same email (typically by accepting an invitation), never by hand.
- `activities` — the timeline: notes, calls, emails, meetings, stage changes.
- `tasks` — follow-ups with a due date and a staff assignee; the overview lists yours.

Every staff tier reads all of it and logs activity; moving the pipeline (stage, owner, source,
new leads) needs `platform:manage-customers` — superadmin and admin — enforced in SQL by
`platform_can_manage_customers()`. Removing someone else's contact, entry or task also needs it.
Inviting a lead's first user, or changing who belongs to a tenant, is writing tenant data and so
needs `platform:manage-organisations` (superadmin; `platform_can_manage_org()` in SQL) — the
customer record shows the same members and invitations sections as the tenant's own page.
The organisations list is the pipeline view (`?stage=`), the overview shows counts per stage, and
each organisation's page is its customer record. Data access is in `src/lib/supabase/crm.ts`;
the page sections are in `src/features/crm/`. Each write goes through `useRouteAction`
(`src/hooks/`), which runs one action at a time and `router.invalidate()`s afterwards so the
page re-renders from the database rather than optimistic state.

## Auth flow

`authStore` (`src/lib/auth/auth-store.ts`) holds the Supabase session behind a single
`onAuthStateChange` subscription. Routes that need a session sit under the pathless
`_authenticated` layout route, whose `beforeLoad` redirects to `/login` (with `?redirect=`) when
signed out and whose `loader` fetches the profile once for all children. The layout's own
component is `AppShell`, so the sidebars stay mounted as pages change underneath; pages render a
`PageHeader` plus their content. `main.tsx` calls
`router.invalidate()` whenever the signed-in user changes, so sign-in, sign-out and expiry all
resolve through the same guards — pages never navigate themselves.

**Password reset.** "Forgot your password?" on `/login` calls `resetPasswordForEmail` with
`redirectTo` set to `/reset-password`. Clicking the emailed link lands there with a session that
supabase-js restores from the URL and flags with `PASSWORD_RECOVERY`; the store records
`passwordRecovery: true` and every guard redirects to `/reset-password` until `updateUser`
succeeds (`USER_UPDATED` clears the flag). A bad or expired link arrives with `error_code` in the
URL instead of a session; the page shows why and offers to send a fresh link. The Supabase project
must allow-list the reset URL — see [`supabase/README.md`](supabase/README.md). Signed-in users
can also change their password from `/profile`; both screens share `usePasswordUpdate`.

## Theme

Light, dark or system, chosen from the toggle in the page header (and on the auth screens).
`themeStore` (`src/lib/theme/theme-store.ts`) keeps the preference in `localStorage` under
`theme`, follows the OS while on system, syncs across tabs, and toggles `.dark` on `<html>` —
which is what the Tailwind `dark:` variant and the token overrides in `index.css` key off. An
inline script in `index.html` applies the same rule before first paint so there is no flash.

## Testing

Vitest + Testing Library on jsdom (`vitest.config.ts`). The Supabase client is always mocked —
`vi.mock('@/lib/supabase/supabase', …)` — so tests never need credentials or a network.
`router.test.tsx` exercises the real route tree on a memory history with the pages stubbed, which
is where guard and redirect behaviour is pinned down. Pages that live under the app shell are
tested with `renderAuthenticated()` from `src/test/render-authenticated.tsx`, which supplies the
`_authenticated` route context and loader data without the real guards.

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, schema check, test and build on
every push to `main` and every pull request.

## Conventions

- Line endings are LF everywhere; `.gitattributes` enforces this on checkout so
  `pnpm format:check` behaves the same on Windows and Unix.
- shadcn components are added with `pnpm dlx shadcn@latest add <component>` and land in
  `src/components/ui/`. Config lives in `components.json`.
