# Docs

What the code cannot say for itself: who the platform is for, what they need from it, what we
have decided and what comes next. The top-level [README](../README.md) and
[`supabase/README.md`](../supabase/README.md) describe what is built; this folder describes why
and what for.

| File                                                     | What it holds                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`products/ovi.md`](products/ovi.md)                     | The first product on the platform: what OVI is, what it needs, where the platform falls short                                    |
| [`products/ovi-direction.md`](products/ovi-direction.md) | Draft: the tenant side as a compliance platform — modules, a generic compliance layer, the limits on customisation, an MVP order |
| [`roadmap.md`](roadmap.md)                               | The work, ranked, with what is done and what each item is for                                                                    |

## Conventions

- Plain Markdown, one topic per file, formatted by Prettier like everything else. These files may
  be rendered by the app or fed to tooling later, so each starts with front matter:

  ```yaml
  ---
  title: Short name
  status: draft | current | superseded
  updated: 2026-09-18
  ---
  ```

- A product gets a file under `products/`: the brief in our own words, a link to the source
  document, and a gap analysis against the platform kept up to date as gaps close.
- The roadmap is the one list of what to do next. Items point back to the product need that
  justifies them; when one ships, it moves to _Done_ with the date rather than being deleted.
- A decision worth remembering (a trade-off we might revisit, a constraint from outside) goes in
  `decisions/` as a short numbered note — context, decision, consequences. None yet.
- Write for the person joining next month: full sentences, concrete numbers, dates as dates.
