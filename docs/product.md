# YNAB Split — Product Overview & Requirements

This is the top-level product definition for YNAB Split: who it is for, the
problem it solves, what it does today, and the assumptions and open questions
that shape where it goes next. It is the source of truth for *why* and *what*.
For *how* (architecture, build, conventions) see [`../CLAUDE.md`](../CLAUDE.md);
for the data-model and component wiring see
[`../component-hierarchy.md`](../component-hierarchy.md).

> This document reverse-engineers the current behavior of the app and states the
> product intent behind it. Where today's implementation differs from the
> intent, that gap is called out explicitly under **Known Limitations &
> Assumptions** and **Open Questions** rather than hidden.

---

## 1. Problem

A couple who each run their own separate YNAB budget have no single place to see
their *shared* money. Household bills, joint trips, and settle-up transfers are
scattered across two independent budgets. Answering simple questions —
"how much did this trip cost us together?", "what are our monthly household
expenses?", and ultimately "who owes whom right now?" — requires manual,
error-prone cross-referencing between two YNAB accounts.

## 2. Target User & Goals

**Primary user:** a couple (two partners, one household) who each maintain a
separate YNAB budget and want to reconcile the spending they share.

**Goals:**

- See shared **household** spending across both budgets, broken down over time.
- Group joint **trip** spending so a trip's total and composition are visible at
  a glance.
- Identify **transfers / settle-ups** that move money between the two budgets so
  they aren't double-counted as spending.
- Arrive at a net **"who owes whom"** settlement figure with minimal manual
  bookkeeping.
- Stay in control of which transactions are considered, via an explicit opt-in
  flag in YNAB.

## 3. Non-Goals

These are deliberately out of scope:

- **More than two parties.** Scope is exactly two budgets (one couple /
  household). Three-or-more-way group expense splitting is not a goal.
- **Multi-currency / FX.** Both budgets are assumed to share a single currency.
  No currency conversion is performed.
- **A backend or hosted datastore.** The app runs entirely in the browser. There
  is no application server that stores user data (see *Platform & Constraints*).
- **Replacing or editing YNAB.** This is an analysis / reconciliation companion,
  not a budgeting tool. It does not create budgets or categories, and it does
  not currently modify the user's YNAB data.

## 4. Core Concepts

- **Two budgets — "left" and "right."** The app always works with two budgets,
  referred to internally as left and right and shown in budget-specific colors.
- **Orange-flag opt-in.** Only transactions a user has flagged **Orange** in
  YNAB are pulled into the comparison. This gives the user direct control over
  what the app sees, right inside YNAB.
- **Designations (hashtags in the memo).** Every relevant transaction is
  categorized by hashtags embedded in its memo field. The recognized types are:

  | Designation | Format | Meaning |
  |-------------|--------|---------|
  | Transfer | `#transfer` | Money moved between the two budgets (a settle-up) |
  | Household | `#household` | A shared / household expense |
  | Trip | `#trip` or `#tripName` | Travel spending (e.g. `#tripHawaii`) |
  | Custom | user-defined | Matched by user-configured rules |

- **Milliunits.** Amounts follow YNAB's convention: 1000 milliunits = $1.00,
  with negative values representing expenses.
- **Timezone.** All date math uses the **America/Vancouver** timezone.

## 5. Capabilities (current)

### Onboarding & data loading

The user authenticates with YNAB via OAuth (implicit-grant token stored in
`sessionStorage`) and selects a left and a right budget. Each side loads its
Orange-flagged transactions independently. Processing waits behind a **loading
gate** until both budgets that are expected have finished loading, so partial
data is never analyzed. The two budgets are merged and sorted newest-first.

### Designation system

After loading, transactions are auto-tagged, then may be adjusted manually:

- **Automatic:** bills are tagged `#household`, and matching amounts across the
  two budgets are tagged `#transfer` (see below). User-defined custom rules can
  apply additional hashtags.
- **Manual:** in the Combined Transactions view, the user can click a
  transaction's designation badge, pick a type from a dropdown (and, for trips,
  choose an existing trip or create a new one), and save. Saving rewrites the
  `#hashtag` portion of the memo string.

> ⚠️ Manual edits are **session-only today** — see *Known Limitations*.

### Transfer detection

Money moving between the two budgets is identified by matching transactions with
equal absolute amounts (one positive, one negative), from **different** budgets,
occurring within **3 days** of each other. Example: a $500 withdrawal in the
left budget on Jan 15 matches a $500 deposit in the right budget on Jan 16.
Matched pairs are tagged `#transfer` so they are not mistaken for spending.

The **Transfer Summary** lists each pair: amount, dates, source/destination
budgets (color-coded), and the number of days between the matched transactions.

### Household expenses

Shared recurring costs are auto-tagged `#household` when a transaction's
category or category group matches a household pattern — `bill`, `utilities`,
`rent`, `insurance`, `strata`, `hydro`, `internet`, `phone`, `home`,
`housing` — or when its category is among the IDs the user has selected via
Household Category Settings. Any transaction can also be tagged `#household`
manually.

The **Household Summary** shows a monthly breakdown of household spending by
budget, transaction counts per budget per month, monthly totals, daily and
monthly averages, and aggregate totals across all months.

### Trip identification

Travel spending is grouped into trips by clustering consecutive transactions
within **2-day gaps**, requiring at least **2 distinct dates** to qualify as a
trip. Household and transfer transactions are excluded from trip grouping. A
trip is named either manually (`#tripHawaii`) or automatically from its start
date (e.g. `trip2024Jan15`).

The **Trip Summary** shows each trip's name, start/end dates, transaction count,
total spending, a per-category breakdown, and the most frequent words from payee
names and memos (a hint at where/what the trip was).

### Settlement ("who owes whom")

On the **Balance Timeline**, the app computes a running settlement balance
between the two partners: left-budget amounts add to the balance, right-budget
amounts subtract, and the running total is halved to express the net amount one
partner owes the other (see *Settlement Model*). The chart plots this trajectory
over time, overlays per-date transaction bars by budget, and highlights trip
periods; the current net figure is shown as a badge.

### The two tabs

- **Trip Analysis** (default) — works with **one budget** loaded. Surfaces trips
  and their summaries.
- **Joint Spending** — requires **both budgets** loaded. Surfaces the Transfer
  Summary, Household Summary, and Balance Timeline (settlement).

### Filtering

The Combined Transactions view offers toggles to show/hide transfers,
household expenses, trips, and undesignated transactions, plus a trip-filter
dropdown to focus on a single trip.

## 6. Settlement Model

Shared expenses are **split equally (50/50)** between the two partners. This is
a deliberate product decision matching the "one couple, equal sharing" user
model: the settlement figure is the net imbalance between the budgets divided by
two. Support for configurable / non-equal split ratios is an *Open Question*, not
a current requirement.

## 7. Platform & Constraints

- **Browser-only, no backend.** The app runs entirely in the user's browser.
  There is no application server or database storing user data; data flows
  directly between the browser and YNAB's API.
- **Privacy posture.** Only preferences live locally — budget colors, selected
  budget IDs, custom designation rules (`custom_designations`), and household
  category IDs (`household_category_ids`) in `localStorage`; the OAuth token in
  `sessionStorage`. No financial data is persisted by the app.
- **Single currency.** Both budgets are assumed to use the same currency;
  amounts are formatted without conversion.
- **Hosting.** Deployed as a static site to GitHub Pages (auto-deploy on pushes
  to `main` after tests pass).

## 8. Known Limitations & Assumptions

- **Manual designation edits do not persist.** Saving a designation updates only
  in-memory state — it is **not** written back to YNAB and **not** saved to
  `localStorage`, so edits are lost on reload. Durable persistence is
  intentionally deferred (see *Open Questions*).
- **Settlement is implicit 50/50.** The split ratio is hardcoded; the net figure
  is correct only under the equal-sharing assumption.
- **Settlement appears in only one place.** The net "who owes whom" figure lives
  inside the Balance Timeline; there is no standalone settle-up panel
  summarizing it alongside the other summaries.
- **Opt-in is manual.** Transactions must be Orange-flagged in YNAB by hand to
  be considered; there is no automatic inclusion rule.
- **Currency is effectively fixed.** Formatting assumes a single currency and a
  US-style locale rather than reading each budget's currency from YNAB.

## 9. Open Questions

- **Hashtag organization & structure (headline).** Before designations can be
  persisted, the taxonomy and structure of the hashtags themselves needs to be
  worked out — how types, trips, and custom tags are named, namespaced, and
  related. **Persistence is deliberately deferred until this is resolved.**
- **Where should persisted designations live** once the taxonomy is settled —
  written back to the YNAB transaction memo via the API, stored as local
  overrides, or both?
- **Should the split ratio be configurable** to support non-equal sharing?
- **Should the net settlement be surfaced** as a first-class summary, not only
  within the timeline chart?

## 10. Reference — thresholds & storage

| Item | Value |
|------|-------|
| Transfer match window | 3 days |
| Transfer match | equal absolute amount, opposite sign, different budgets |
| Trip max gap between transactions | 2 days |
| Trip minimum distinct dates | 2 |
| Timezone | America/Vancouver |
| Amount unit | YNAB milliunits (1000 = $1.00; negative = expense) |
| Opt-in flag | Orange flag in YNAB |
| `localStorage` | budget colors, budget IDs, `custom_designations`, `household_category_ids` |
| `sessionStorage` | OAuth token |

## 11. Related documentation

- [`../CLAUDE.md`](../CLAUDE.md) — architecture, build/test commands, and coding
  conventions.
- [`../component-hierarchy.md`](../component-hierarchy.md) — the centralized
  transaction data model and component data flow.
- [`prompts/balance-timeline-chart.md`](prompts/balance-timeline-chart.md) — the
  feature prompt that produced the Balance Timeline component.
