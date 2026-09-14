# Јадро Кода

A React single-page app boilerplate for organisation-based (multi-tenant) products: a public
marketing site, Supabase authentication (email/password sign-up, login, password reset and
change), user profiles, organisations with role-based memberships, and an app shell with an
organisation switcher.

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
and column grants so clients can only write the fields they own.

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
                        # and `_authenticated` (guards + profile loader). Everything past the
                        # marketing home is a lazy chunk.
  App.tsx               # Root layout (renders <Outlet />)
  index.css             # Tailwind, shadcn light/dark tokens, font
  config/site.ts        # Site-wide constants (title)
  lib/
    utils.ts            # cn() helper
    auth/               # Session store, route APIs (_authenticated, _app, _staff), permissions
    format.ts           # Date formatting
    theme/              # Theme store: light / dark / system, persisted, applied to <html>
    supabase/           # Supabase client; profile, organisation and platform queries
  features/
    auth/               # Auth layout, login / sign-up / reset forms and hooks
    organisations/      # Create-organisation form, organisation settings hook
    staff/              # Staff team page hook
    marketing/          # Placeholder copy for the public site (content.ts)
    profile/            # Profile, change-password and account sections + page hook
  pages/                # Route components (staff/ for the staff area)
  components/
    ui/                 # shadcn primitives (generated; edit sparingly)
    layout/             # PublicLayout (marketing), AppShell + StaffShell (sidebars),
                        # PageHeader (breadcrumbs)
    theme/              # ThemeToggle dropdown
    router/             # Pending / error / not-found screens used by the router
    sidebar/            # App and staff sidebar composition
    navigation/         # Nav items, organisation switcher, user menu
  hooks/                # Shared hooks (useIsMobile)
  test/setup.ts         # Vitest setup: jest-dom matchers, jsdom stubs
```

Tests live next to the code they cover as `*.test.ts(x)`.

Path alias: `@/` → `src/`.

## Routes

| Path                     | Who                 | What                                                   |
| ------------------------ | ------------------- | ------------------------------------------------------ |
| `/`                      | everyone            | Marketing home; signed-in visitors get a Dashboard CTA |
| `/login`                 | signed out          | Sign in (`?redirect=` honoured); signed in → dashboard |
| `/signup`                | signed out          | Create account; signed in → dashboard                  |
| `/reset-password`        | from the email link | Set a new password, or request a fresh link            |
| `/onboarding`            | signed in, no org   | Create your first organisation                         |
| `/app`                   | signed in + member  | Dashboard, inside the active organisation              |
| `/app/settings`          | signed in + member  | Organisation settings (owners/admins can edit)         |
| `/app/organisations/new` | signed in + member  | Create another organisation                            |
| `/app/profile`           | signed in + member  | Profile, password, account, sign-out                   |
| `/staff`                 | staff               | Overview: counts across every organisation             |
| `/staff/organisations`   | staff               | All organisations, searchable (`?q=`); detail per org  |
| `/staff/team`            | staff               | Platform members; admins change roles and remove       |

Every route sets its `<title>` via TanStack's `head()`; the home page also sets a meta
description. Marketing copy is placeholder and lives in `src/features/marketing/content.ts`.

## Organisations and roles

There are two layers of users, each with its own roles, routes and shell:

- **Tenants.** Every product object belongs to an **organisation**; users join through
  `memberships` with an `org_role` (`owner` | `admin` | `member` — generic names a product
  renames). They live under `/app/*`.
- **Staff.** The company's own people have a `platform_members` row with a `platform_role`
  (`admin` | `support`) and live under `/staff/*`, looking across every tenant. Staff never
  self-sign-up. Tenant RLS reaches staff through one function, `platform_can_access_org()`, so
  staff reach can be narrowed in one place; in the boilerplate it is read-only over tenants, and
  only platform admins can change staff roles or remove staff (the database refuses to remove the
  last admin). Colleagues can see each other's profiles (`shares_org_with()`); staff can see
  everyone's.

Both layers hang off the `_authenticated` route, whose loader fetches `profile`, `memberships`
and `platformRole` once. A user with no organisation goes to `/onboarding` — or to `/staff` if
they are staff. Staff who also belong to an organisation land in `/app` and get a link across;
non-staff who open `/staff` are sent to `/app`.

- `create_organisation()` (RPC) is the only way to make an organisation: it inserts the row,
  makes the caller its owner and marks it active, atomically.
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
