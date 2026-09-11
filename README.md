# Јадро Кода

A React single-page app with Supabase authentication: email/password sign-up and login, a user
`profiles` table with an editable profile page, and a dashboard shell with a collapsible sidebar
and calendar panel.

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

The app throws on startup if either `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is
missing — see [`src/lib/supabase/supabase.ts`](src/lib/supabase/supabase.ts).

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
  main.tsx              # React root; mounts the router
  router.tsx            # Route tree; `_authenticated` layout guards and loads the profile
                        # Dashboard and profile pages are lazy-loaded chunks
  App.tsx               # Root layout (renders <Outlet />)
  index.css             # Tailwind, shadcn theme tokens, font
  config/site.ts        # Site-wide constants (title)
  lib/
    utils.ts            # cn() helper
    auth/               # Session store (one onAuthStateChange for the app) + route API
    supabase/           # Supabase client and profile queries
  features/
    auth/               # Login / sign-up forms, auth page hook, sign-out hook
    profile/            # Profile form, account details, profile page hook
  pages/                # Route components
  components/
    ui/                 # shadcn primitives (generated; edit sparingly)
    layout/             # AppShell (sidebars + <Outlet />) and PageHeader (breadcrumbs)
    router/             # Pending / error / not-found screens used by the router
    sidebar/            # Left and right sidebar composition
    navigation/         # Sidebar nav sections, team switcher, user menu
    calendar/           # Calendar panel widgets
  hooks/                # Shared hooks (useIsMobile)
  test/setup.ts         # Vitest setup: jest-dom matchers, jsdom stubs
```

Tests live next to the code they cover as `*.test.ts(x)`.

Path alias: `@/` → `src/`.

## Auth flow

`authStore` (`src/lib/auth/auth-store.ts`) holds the Supabase session behind a single
`onAuthStateChange` subscription. Routes that need a session sit under the pathless
`_authenticated` layout route, whose `beforeLoad` redirects to `/` (with `?redirect=`) when
signed out and whose `loader` fetches the profile once for all children. The layout's own
component is `AppShell`, so the sidebars stay mounted as pages change underneath; pages render a
`PageHeader` plus their content. `main.tsx` calls
`router.invalidate()` whenever the signed-in user changes, so sign-in, sign-out and expiry all
resolve through the same guards — pages never navigate themselves.

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
