# Јадро Кода

A React single-page app with a public marketing site and Supabase authentication: email/password
sign-up, login and password reset, a user `profiles` table with an editable profile page, and a
dashboard shell with a collapsible sidebar and calendar panel.

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

The schema lives in [`supabase/migrations`](supabase/migrations) — see
[`supabase/README.md`](supabase/README.md) for how to apply it. In short: a `public.profiles`
table, created and kept in sync with `auth.users` by triggers, with RLS and column grants so a
client can only read its own row and update `display_name` / `phone`.

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
    auth/               # Session store (one onAuthStateChange for the app) + route API
    theme/              # Theme store: light / dark / system, persisted, applied to <html>
    supabase/           # Supabase client and profile queries
  features/
    auth/               # Auth layout, login / sign-up / reset forms and hooks
    marketing/          # Placeholder copy for the public site (content.ts)
    profile/            # Profile, change-password and account sections + page hook
  pages/                # Route components
  components/
    ui/                 # shadcn primitives (generated; edit sparingly)
    layout/             # PublicLayout (marketing header/footer), AppShell (sidebars),
                        # PageHeader (breadcrumbs)
    theme/              # ThemeToggle dropdown
    router/             # Pending / error / not-found screens used by the router
    sidebar/            # Left and right sidebar composition
    navigation/         # Sidebar nav sections, team switcher, user menu
    calendar/           # Calendar panel widgets
  hooks/                # Shared hooks (useIsMobile)
  test/setup.ts         # Vitest setup: jest-dom matchers, jsdom stubs
```

Tests live next to the code they cover as `*.test.ts(x)`.

Path alias: `@/` → `src/`.

## Routes

| Path              | Who                 | What                                                   |
| ----------------- | ------------------- | ------------------------------------------------------ |
| `/`               | everyone            | Marketing home; signed-in visitors get a Dashboard CTA |
| `/login`          | signed out          | Sign in (`?redirect=` honoured); signed in → dashboard |
| `/signup`         | signed out          | Create account; signed in → dashboard                  |
| `/reset-password` | from the email link | Set a new password, or request a fresh link            |
| `/dashboard`      | signed in           | App shell                                              |
| `/profile`        | signed in           | Profile, password, account, sign-out                   |

Every route sets its `<title>` via TanStack's `head()`; the home page also sets a meta
description. Marketing copy is placeholder and lives in `src/features/marketing/content.ts`.

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

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, test and build on every push to
`main` and every pull request.

## Conventions

- Line endings are LF everywhere; `.gitattributes` enforces this on checkout so
  `pnpm format:check` behaves the same on Windows and Unix.
- shadcn components are added with `pnpm dlx shadcn@latest add <component>` and land in
  `src/components/ui/`. Config lives in `components.json`.
