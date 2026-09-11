# Јадро Кода

A React single-page app with Supabase authentication: email/password sign-up and login, a user
`profiles` table, and a dashboard shell with a collapsible sidebar and calendar panel.

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
  App.tsx               # Root layout (renders <Outlet />)
  index.css             # Tailwind, shadcn theme tokens, font
  config/site.ts        # Site-wide constants (title)
  lib/
    utils.ts            # cn() helper
    auth/               # Session store (one onAuthStateChange for the app) + route API
    supabase/           # Supabase client and profile queries
  features/
    auth/               # Login / sign-up forms and page hook
    dashboard/          # Dashboard page hook
    profile/            # Profile page hook
  pages/                # Route components
  components/
    ui/                 # shadcn primitives (generated; edit sparingly)
    sidebar/            # Left and right sidebar composition
    navigation/         # Sidebar nav sections, team switcher, user menu
    calendar/           # Calendar panel widgets
  hooks/                # Shared hooks (useIsMobile)
```

Path alias: `@/` → `src/`.

## Auth flow

`authStore` (`src/lib/auth/auth-store.ts`) holds the Supabase session behind a single
`onAuthStateChange` subscription. Routes that need a session sit under the pathless
`_authenticated` layout route, whose `beforeLoad` redirects to `/` (with `?redirect=`) when
signed out and whose `loader` fetches the profile once for all children. `main.tsx` calls
`router.invalidate()` whenever the signed-in user changes, so sign-in, sign-out and expiry all
resolve through the same guards — pages never navigate themselves.

## Conventions

- Line endings are LF everywhere; `.gitattributes` enforces this on checkout so
  `pnpm format:check` behaves the same on Windows and Unix.
- shadcn components are added with `pnpm dlx shadcn@latest add <component>` and land in
  `src/components/ui/`. Config lives in `components.json`.
