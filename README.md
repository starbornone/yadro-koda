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

The app expects a `public.profiles` table with row-level security scoped to `auth.uid()`. The
columns it reads and writes are defined by the `Profile` type in
[`src/lib/supabase/profiles.ts`](src/lib/supabase/profiles.ts). The schema is not yet versioned in
this repo.

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
  router.tsx            # Route tree and auth guards
  App.tsx               # Root layout (renders <Outlet />)
  index.css             # Tailwind, shadcn theme tokens, font
  config/site.ts        # Site-wide constants (title)
  lib/
    utils.ts            # cn() helper
    supabase/           # Supabase client, auth snapshot, profile queries
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

## Conventions

- Line endings are LF everywhere; `.gitattributes` enforces this on checkout so
  `pnpm format:check` behaves the same on Windows and Unix.
- shadcn components are added with `pnpm dlx shadcn@latest add <component>` and land in
  `src/components/ui/`. Config lives in `components.json`.
