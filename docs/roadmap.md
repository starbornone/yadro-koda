---
title: Roadmap
status: current
updated: 2026-09-18
---

# Roadmap

One list, ranked. Each item names the need behind it — for now that is
[OVI](products/ovi.md), the first product — and says which side of the framework/product line
it sits on. When something ships it moves to _Done_ with its date.

## Next

1. **Value and dates** — `plan`, `annual_value`, `expected_close`, `renews_on`, and an outcome
   with a reason on `customers`; the overview shows forecast and renewals due. Document the
   stage-rename path (migration + `stages.ts`) so a product can replace `trial` with
   "proposal sent". _OVI gap #4, unlocks #10._
2. **Proposals** — a price book, `proposals` with line items and totals, an email-bound token
   link on the invitation pattern, `get_proposal()` for the signed-out preview and
   `accept_proposal()` from a session with that email. Acceptance creates the owner membership,
   moves the stage to won and records who, when and from where. _OVI gap #3._
3. **Onboarding playbooks** — per-stage task templates created by trigger on the stage change,
   due relative to it, assigned to the customer's owner. _OVI gap #5._
4. **Viewer role and access log** — a read-only `viewer` in `org_role`, invitable and
   time-boxed like any member; sign-ins to an organisation recorded so an auditor's visit is
   logged. _OVI gap #6._
5. **Invitation email delivery** — a database webhook on insert → Edge Function → provider, with
   custom SMTP on an Australian provider so nothing customer-facing leaves the country. Until
   then invitations stay hand-off links. _OVI gap #7._
6. **Expiry housekeeping** — a nightly `pg_cron` purge of invitations past their link expiry,
   memberships past their access end, and `enquiry_attempts` older than a day. Correctness is
   already fine; this keeps tables honest.
7. **Dashboard content** — `/app` is the product's slot; leave the placeholder until OVI's
   compliance dashboard replaces it.
8. **Sites under an organisation** — for multi-site enterprise providers. Deferred until a
   customer needs it. _OVI gap #8._

## Done

- 2026-09-18 — **Inbound lead capture**: the `/get-started` form and `submit_enquiry()`, the one
  RPC open to anonymous callers — a lead sourced from the website with its contact and an
  "Enquiry" entry; honeypot, one a day per email, twenty an hour per IP. _OVI gap #1._
- 2026-09-18 — **Customer details**: `customers.details jsonb` and a product-defined field
  schema (`src/config/customer-fields.ts`) rendered on the record page and the new-lead form;
  `create_lead()` takes the details. _OVI gap #2._
- 2026-09-18 — **Activity feed** on the staff overview: the newest entries across every
  timeline, each linking to its record.
- 2026-09-18 — **Playwright E2E suite**: the front door, an organisation from founding to
  deletion, the staff area, time-boxed access; admin-minted sessions, self-cleaning test data,
  optional CI job. Found and fixed the members page crashing on an expired member.
- 2026-09-18 — **Joins on the timeline**: every membership insert logged as the person who
  joined, with how they came in. Fixed transaction-local RPC hints leaking between calls.
- 2026-09-18 — **Auth redirect allow-list** managed from `supabase/config.toml`; **typed
  selects end to end** (`requireRow`, no `as unknown as`).
- 2026-09-17 — **Profiles backfill** for users older than the trigger; RPC execute grants
  hardened.
- 2026-09-17 — **Schema test suite** (`pnpm db:test`): policies, triggers and RPCs as each kind
  of user, rolled back; optional CI job.
- 2026-09-17 — **Time-boxed access**: `expires_at` on memberships and invitations.
- 2026-09-17 — **Organisation deletion**, type-the-slug confirmation, cascading.
- 2026-09-17 — **Leaving an organisation**; last owner protected.
- 2026-09-16 — **Staff invitations** to the platform team.
- 2026-09-16 — **Organisation invitations**: email-bound links, 7-day expiry, one open per
  address; contacts linked to members on join.
