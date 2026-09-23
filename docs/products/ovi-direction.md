---
title: OVI direction — a compliance platform, not a compliance tool
status: draft
updated: 2026-09-22
---

# OVI direction — a compliance platform, not a compliance tool

A proposal for what the tenant side of the platform becomes, written up from a discussion on
2026-09-22. Nothing here is decided; the roadmap is re-ranked once it is. It extends
[OVI — the first product](ovi.md) rather than replacing it: the MVP scope there (dashboard,
clause ownership, evidence, incident log, auditor portal) is a special case of the shape below.

## The idea in one paragraph

Most providers run three or four systems — customer data in one, documents in another,
incidents and complaints in a spreadsheet, compliance in a consultant's binder — and enter the
same facts into each. OVI puts the records a provider keeps anyway (documents, incidents,
complaints, actions, people) in one place, and adds a **compliance layer** that reads them:
which requirement of which framework each record is evidence for, what is current, what is
overdue, whether the organisation is audit-ready. The layer is generic — NDIS Practice
Standards first, ISO 9001 / 14001 / 45001 / 27001 later — because those frameworks share a
spine. The compliance layer is not a module beside the others; it is the reason the data lives
in one place, and the thing a general CRM cannot offer.

Positioning: simpler than Monday, Zoho or Odoo, with compliance built in rather than bolted on.
Not competing with them on breadth — competing on being the one system a small provider needs.

## Two CRMs

The platform has a CRM already: the **staff area**, which is OVI's own sales system — leads,
proposals, pipeline, renewals (done 2026-09-16 → 22). That stays and is not what this note is
about.

The **tenant side** (`/app`) is where OVI the product lives, and it is still a placeholder.
"CRM" there means the provider's own people — participants, families, referrers, workers —
which is one module among several, not the centre. The centre is the compliance layer.

## The shape

### Modules: fixed record types with a purpose

Each module is a table with a known shape, a list page, a record page and a place on the
timeline. The platform defines the shape; a tenant adjusts it within limits (below).

| Module                 | What it keeps                                                                 | Compliance role                                                        |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Documents              | Policies and procedures: owner, version, review date, acknowledgements        | The control for most "you must have a policy on …" requirements        |
| Incidents              | What happened, to whom (de-identified), severity, the reportable flag         | Evidence for incident-management requirements; the 24 h / 5-day clocks |
| Complaints             | Who raised it, about what, response, outcome                                  | Evidence for complaints-handling requirements                          |
| Actions                | Corrective and preventive actions, from any record, with owners and due dates | Evidence of continual improvement; the thing auditors follow up        |
| Risks _(later)_        | Register with likelihood, impact, treatment, review                           | Planning requirements in every ISO standard                            |
| People _(later)_       | Workers, qualifications, screening clearances, expiry                         | Worker-screening and competence requirements                           |
| Participants _(later)_ | De-identified IDs, service agreements, contacts                               | The provider's actual CRM; the subject of most incidents               |

Every module gets the same three things for free from the platform: the timeline (who did what,
when), attachments (org-scoped storage), and ownership with due dates (the `tasks` pattern).

### The compliance layer: a registry

```
frameworks      NDIS Practice Standards (Core, Module 1, 2A, 5…), ISO 9001, 14001, 45001, 27001
  └ requirements  a clause or outcome: number, title, the quality indicators, an owner
       └ controls   how this organisation meets it: a document, a register, a process, an attestation
            └ evidence  the records that show the control is real and current: a document version,
                        an incident register with entries, a completed review, a training record
```

Plus one mapping table: **a control can satisfy requirements in several frameworks.** An
incident register is evidence for NDIS Core (incident management), ISO 45001 §10.2 and ISO
9001 §10.2 at once. Enter it once, count it three times. That table is the "three or four
systems into one" pitch made concrete.

Why one model fits all of them: the ISO management-system standards share the harmonised
structure (context → leadership → planning → support → operation → performance evaluation →
improvement), and the NDIS Practice Standards are outcome statements with quality indicators.
Both reduce to _a requirement, the control in place to meet it, and the evidence it is current_.

### The dashboard reads the registry

Per framework: requirements with a current control and fresh evidence, against the total — that
ratio is the readiness score. Then what is overdue for review, open incidents / complaints /
actions, reportable incidents against their clocks, and the next audit. Nothing on the dashboard
is entered; it is all derived.

### The auditor

Roadmap #2 already: a read-only `viewer` role, invitable and time-boxed like any member, with
sign-ins logged. Clause-scoped access (the OVI doc's ask) is a filter on the registry: the
auditor sees the requirements they are auditing and the evidence linked to them.

## Customisation, and why the limits are the point

Monday, Zoho and Odoo cannot do this — not because they lack a compliance module, but because a
compliance dashboard has to _know what a field means_. If a tenant can rename "incident" to
anything and build boards freely, nothing upstream can compute readiness. So the limits on
customisation are not a UX compromise; they are what makes the compliance layer possible, and
they are also what keeps the product simple to learn and to support.

Tenants may: relabel fields, set picklist values, hide optional fields, add a small number of
custom fields per module (the `details` jsonb pattern already on `customers`, capped), choose
which frameworks apply to them. Tenants may not: add modules, define workflows, build
dashboards, change what a record type means. The platform (OVI) configures the rest per
product, the way `src/config/customer-fields.ts` configures the CRM today.

This is the same stance the platform takes everywhere — opinionated defaults, configuration
over construction — applied to the product.

## MVP, NDIS first

NDIS stays the first market: it is where OVI's knowledge is, the SIL registration change from
1 July 2026 widens who needs a system, and the Practice Standards are published openly so they
can be seeded. The bones stay generalist so ISO frameworks are content, not code.

| Phase | Build                                                                                           | Why in this order                                                        |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 0     | Org-scoped storage; audit log (both already on the roadmap)                                     | Evidence is files; auditors want history                                 |
| 1     | Documents; the registry with NDIS Core seeded; requirement owners; dashboard                    | The differentiator — everything else feeds it                            |
| 2     | Incidents (with the reportable clocks), Complaints, Actions                                     | The three registers every provider is audited on; well-understood shapes |
| 3     | Viewer role and access log (roadmap #2)                                                         | The auditor portal                                                       |
| Later | Risks, People, Participants; ISO 9001 / 45001 / 14001 content; the AI policy builder; ISO 27001 | 27001's Annex A control set is its own product (Vanta / Drata territory) |

**Deferred deliberately:** the AI policy builder (a feature on top of Documents, and a data
sovereignty question — self-hosted models only); multi-framework mapping beyond seeding the
table; anything the OVI doc already puts out of scope (scheduling, participant portal, billing,
native mobile).

## Constraints to design around

- **ISO standard text is copyrighted.** The registry can carry clause numbers and titles and let
  an organisation attach its own copy; it cannot ship the requirements verbatim. The NDIS
  Practice Standards and quality indicators are published by the NDIS Commission and can be
  seeded.
- **Reportable incidents** have hard clocks — 24 hours, 5 days for unauthorised restrictive
  practices — so Incidents needs due-time logic and reminders from the first version.
- **Participants are de-identified** (OVI principle): IDs, never names, in incident and
  complaint records.
- **Data sovereignty** is unchanged: Sydney region, no third-party AI, storage in-region.
- **Module = plan line.** OVI already prices "additional modules $500 each"; the price book's
  items and the tenant's enabled modules should be the same list, so a proposal that is
  accepted turns modules on.

## How hard

Buildable in phases, and the platform's patterns make each module cheap once the first exists.
For scale: the staff CRM and the proposals feature were each about a day's build with tests.
The registry with Documents and the dashboard is the largest single piece — roughly three of
those — and each register after it about one. An MVP skeleton is therefore on the order of six
to ten focused build days before content. Content — the NDIS Core mapping, template policies,
the quality-indicator wording — is where OVI's domain knowledge is the asset, and it takes
longer than the code.

## Competitors, as of 2026-09-22

- **NDIS-specific.** Crowded but shallow: care-management suites with compliance bolted on
  ([ShiftCare](https://activlink.com.au/articles/ndis-compliance-software-australia),
  [GoodHuman](https://www.goodhuman.me/platform/compliance)), audit-preparation tools
  ([Audit Pilot](https://www.auditpilot.com.au/ndis-compliance-management-software/)), policy
  template libraries, and enterprise GRC far too heavy for a small provider
  ([Riskonnect](https://riskonnect.com/healthcare/software-simplifies-ndis-compliance-healthcare/)).
  Buyer's guides for 2026 stress incident clocks, worker screening and audit readiness
  ([Beyond Himalaya](https://www.beyondhimalayatech.com.au/blog/the-2026-ndis-compliance-software-buyers-guide-for-australian-providers),
  [Smart Compliance Systems](https://smartcompliancesystems.com.au/key-features-every-ndis-compliance-software-must-have/)).
  Affirm Audit (met April 2026, see [ovi.md](ovi.md)) is auditor-facing, manual, no AI.
- **ISO integrated management systems.** Largely document-and-template businesses:
  [Activ](https://www.myactiv.co.uk/products/ims-integrated-management-systems/) (UK,
  multi-standard), [ISO365](https://www.iso365.com.au/ims) (built inside Microsoft 365). The
  IMS pitch itself — one system, one audit, cheaper than separate certifications — is the same
  argument we make ([ISO Certification Group](https://isocertificationgroup.com.au/blog/integrated-management-system-ims-for-australian-businesses-benefits-implementation-guide)).
- **General CRM / work platforms.** Monday is the easiest to learn and trades depth for
  simplicity, with no compliance semantics; Odoo is the deepest and routinely needs an
  implementation partner at $5k–50k; Zoho sits between with a steep learning curve
  ([Pipedrive on Zoho vs Monday](https://www.pipedrive.com/en/blog/zoho-vs.-monday-comparison),
  [Instabizweb on Odoo vs Zoho](https://www.instabizweb.com/blogs/odoo-vs-zoho-crm-2026-comparison),
  [Bitrix24 on Odoo alternatives](https://www.bitrix24.com/articles/best-odoo-alternatives-top-erp-and-business-management-solutions.php)).
  None can answer "are we audit-ready?", which is the one question a provider has.

A deeper scan — pricing, feature matrices, who actually wins small-provider deals — is worth a
day before committing to positioning copy.

## Open questions

1. Is Participants in the MVP, or does OVI Codex ship without the provider's own CRM and add it
   in Frontline? (The doc puts the participant portal out of scope; a participant _register_ is
   a different thing.)
2. Which NDIS modules are seeded first — Core and Verification only, as the doc suggests?
3. Do tenants choose frameworks themselves, or does OVI enable them on the plan (module = plan
   line)?
4. How much of the AI policy builder is MVP versus roadmap, given self-hosted models only?
5. Naming: are "modules" the product's sellable units, the record types, or both? The OVI doc
   uses the word for both.

## What happens next

Decide the questions above; then re-rank [the roadmap](../roadmap.md) with phases 0–3 ahead of
onboarding playbooks, and open `docs/decisions/0001-compliance-layer.md` recording the
customisation stance, since that is the trade-off most likely to be revisited.
