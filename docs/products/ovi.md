---
title: OVI — the first product
status: current
updated: 2026-09-22
---

# OVI — the first product

OVI is a compliance platform for NDIS and human-services providers, built by the Ophis Workers'
Cooperative. It is the first product on this platform, and the platform's CRM is meant to be
OVI's actual sales system — the founding document is explicit that the answer to Salesforce is
"no".

Source: [OVI MVP](https://docs.google.com/document/d/1mdWYiEzSvgfdHdo4QsvxP4rwjbdboHxB2IYq92LSXQ0/edit)
(Google Doc, April–May 2026). This file summarises what bears on the platform; the doc is the
truth for the product. Where the tenant side goes from here — modules and a generic compliance
layer — is a draft in [ovi-direction.md](ovi-direction.md).

## The product in brief

**Problem.** Providers must meet complex, context-dependent NDIS standards with poorly paid,
high-churn, often non-native-English workforces. Data quality is poor, audit preparation is
manual, and non-compliance is the number one issue. Providers need AI-guided gap analysis, not
templates.

**Market.** Over 20,000 registered NDIS providers, 70% with fewer than 100 participants.

| Segment    | Size                                | Pain                                                        |
| ---------- | ----------------------------------- | ----------------------------------------------------------- |
| Small      | 1–20 participants, ≤10 employees    | $3,500–$10,000+ on consultants and audits                   |
| Mid-sized  | 20–100+ participants                | A compliance manager costs ~$115k + super; audits $21k–$68k |
| Enterprise | 100–2,000+ participants, multi-site | Audits $15k–$30k+; need centralised compliance              |
| Secondary  | Certification bodies and auditors   | Structured, read-only access during audits                  |

**MVP: OVI Codex.** Scheme selection (NDIS modules by service type), a guided AI policy builder
with gap assessment of uploaded policies, a compliance dashboard (clause status, ownership,
evidence, readiness score), clause ownership with tasks and reminders, evidence collection with
tagging and version control, an incident and safeguarding log, and an **auditor portal** with
time-limited, clause-scoped, logged access. Tenant roles named in the doc: Admin, Compliance
Manager, Team Leader, Auditor.

**Roadmap modules.** OVI Frontline (shift-end prompts, incident reporting), OVI Safeguard
(worker screening, qualifications, scheduling), OVI Library (e-learning linked to clauses).

**Principles that constrain us.** Capture at source; guide, don't blank-form; flag, don't block;
and — non-negotiable — **data sovereignty**: all data on Australian infrastructure, no
third-party AI, self-hosted models, ISO 27001 planned.

**Out of MVP scope.** Full shift scheduling, participant portal, billing and claims,
multi-framework mapping, a native mobile app.

## Pricing

All annual subscriptions include Codex. Fees ex GST.

| Tier            | Setup   | Annual  | Frontline (roadmap)    |
| --------------- | ------- | ------- | ---------------------- |
| Verification    | $500    | $2,500  | $25 per user per month |
| Small provider  | $500    | $5,000  | $25 per user per month |
| Medium provider | $2,500  | $7,500  | $25 per user per month |
| Enterprise      | $10,000 | $35,000 | Included               |

Add-ons: additional modules $500 each (Module 1, 2A, 5, …); consultant onsite day $500 + travel;
OVI Safeguard (roadmap) ~$3,500 a year.

## How OVI sells

The doc's section "CRM-Integrated Rapid Proposal" describes the motion the CRM has to carry:

1. A **lead form on the website** collects everything needed for a quote: provider size,
   pathway (Verification or Certification), modules, number of users.
2. The **CRM generates the proposal**; sales follows up qualified leads.
3. The **proposal lives on the website** with online signature and authentication, compliant
   with Australian data sovereignty.
4. After acceptance, deployment runs to a clock: CRM setup in 2 days, platform access in 5,
   onboarding call at 10.

## What OVI needs from the platform

**As a tenant product**

- Organisations (providers) with members in roles; time-boxed, read-only, logged access for
  auditors; invitations that bind to an email address.
- Enterprise providers are multi-site; the flat organisation → members model may need sites
  under an organisation later.
- Everything hosted in Australia: database, storage, auth email, any model inference.

**As a CRM**

- Inbound leads from the website, carrying the quote inputs.
- A customer record that holds those inputs and the commercial facts: tier, annual value,
  expected close, renewal date, outcome.
- Proposals built from a price book, sent as a link, accepted online by an authenticated person
  — acceptance is what turns the lead into a tenant.
- A pipeline whose stages match the motion above, and an onboarding checklist that starts when
  a deal is won.
- Reporting that goes past counts: forecast, ARR, renewals due.

## Gap analysis

What the platform has today against each need, and where the fix belongs. _Framework_ means it
is generic enough for any B2B product on the platform; _product_ means OVI-specific, kept in
OVI's own configuration or migrations.

| #   | Need                             | Today                                                                                                                                                                                                                                                                                                                                                                                                                                       | Gap                                                                                                                                                                                                                                                                         | Where                               | Status                 |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------- |
| 1   | Inbound lead capture             | `/get-started` asks who they are, the product's fields and a message; `submit_enquiry()` (the one RPC open to `anon`) enters the organisation as a lead sourced from the website with the person as its contact and the enquiry on the timeline; honeypot, one a day per email, twenty an hour per IP                                                                                                                                       | Captcha only if the guards prove too little                                                                                                                                                                                                                                 | Framework                           | Done 2026-09-18        |
| 2   | Qualification data on the record | `customers.details jsonb` holds the product's fields, defined in `src/config/customer-fields.ts`, on the record page and the new-lead form                                                                                                                                                                                                                                                                                                  | OVI sets its own list (below)                                                                                                                                                                                                                                               | Framework + product schema          | Done 2026-09-18        |
| 3   | Proposals and acceptance         | `price_book_items`, `proposals` with `proposal_lines` and trigger-kept totals, an email-bound token link (`/proposal/:token`), `get_proposal()` / `accept_proposal()` / `decline_proposal()`; acceptance creates the owner membership, sets the customer to active with the plan, annual value and a renewal a year out, and records who, when and what the browser reported ("signature"); one proposal out per organisation; withdrawable | Email delivery of the link and a server-recorded address (roadmap #3); a courtesy PDF (roadmap #5)                                                                                                                                                                          | Framework; prices are product       | Done 2026-09-22        |
| 4   | Value and dates on the customer  | `plan`, `annual_value`, `expected_close`, `renews_on`, `outcome_reason` on `customers`; `stage_changed_at` / `won_at` by trigger; the pipeline form asks for what the stage needs                                                                                                                                                                                                                                                           | A "proposal sent" stage is a rename away — the README's recipe; OVI decides whether `trial` stays                                                                                                                                                                           | Framework                           | Done 2026-09-20        |
| 5   | Onboarding playbook              | Tasks with due dates and assignees                                                                                                                                                                                                                                                                                                                                                                                                          | Per-stage task templates created on the stage change, due relative to it, assigned to the owner ("CRM setup 2 days, access 5, onboarding 10")                                                                                                                               | Framework; the checklist is product | Open                   |
| 6   | Auditor access                   | Time-boxed memberships; roles `owner` / `admin` / `member`                                                                                                                                                                                                                                                                                                                                                                                  | A read-only `viewer` role, invitable and time-boxed; an access log (joins are on the timeline, sign-ins are not). Clause scoping is product                                                                                                                                 | Framework role + log; scope product | Open                   |
| 7   | Data sovereignty                 | Project in Sydney (`ap-southeast-2`)                                                                                                                                                                                                                                                                                                                                                                                                        | Auth emails go through Supabase's shared SMTP: use custom SMTP with an Australian provider before sending anything to customers. CI runs from GitHub's US runners: the E2E suite must only ever point at a test project. Model inference is OVI's concern, not this layer's | Ops                                 | Open                   |
| 8   | Multi-site enterprise providers  | Flat organisation → members                                                                                                                                                                                                                                                                                                                                                                                                                 | Sites under an organisation. Defer until a customer needs it                                                                                                                                                                                                                | Framework, later                    | Deferred               |
| 9   | Staff roles for a sales team     | `superadmin` / `admin` / `support`                                                                                                                                                                                                                                                                                                                                                                                                          | None: `admin` is the sales role, `support` logs and reads (consultants)                                                                                                                                                                                                     | —                                   | Fine                   |
| 10  | Reporting                        | Pipeline value, ARR and per-stage value on the overview; renewals due in 90 days                                                                                                                                                                                                                                                                                                                                                            | Won/lost over time and time-in-stage as reports, once there is data worth charting                                                                                                                                                                                          | Framework                           | Partly done 2026-09-20 |

The [roadmap](../roadmap.md) orders this work.

## OVI's customer fields

What `src/config/customer-fields.ts` becomes for OVI — the inputs the lead form asks for and a
quote is built from:

```ts
export const CUSTOMER_FIELDS: readonly CustomerField[] = [
  { key: 'participants', label: 'Participants', type: 'number', min: 0 },
  { key: 'employees', label: 'Employees', type: 'number', min: 0 },
  {
    key: 'pathway',
    label: 'Pathway',
    type: 'select',
    options: [
      { value: 'verification', label: 'Verification' },
      { value: 'certification', label: 'Certification' },
    ],
  },
  {
    key: 'modules',
    label: 'Modules',
    type: 'multiselect',
    options: [
      { value: 'core', label: 'Core' },
      { value: 'module-1', label: 'Module 1' },
      { value: 'module-2a', label: 'Module 2A' },
      { value: 'module-5', label: 'Module 5' },
    ],
  },
  { key: 'users', label: 'Users', type: 'number', min: 1, help: 'Seats for OVI Frontline.' },
  { key: 'multi_site', label: 'More than one site', type: 'boolean' },
]
```

The tier (Verification, Small, Medium, Enterprise) is not a field: it follows from participants
and pathway, and belongs with the price book (gap #3).
