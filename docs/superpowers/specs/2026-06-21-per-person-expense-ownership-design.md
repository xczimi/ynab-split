# Per-Person Expense Ownership — Design

**Date:** 2026-06-21
**Status:** Approved design (pre-implementation)
**Related:** [`docs/product.md`](../../product.md) Open Questions — "hashtag organization/structure" and "configurable / non-equal split ratio"

## 1. Problem

YNAB Split's settlement ("who owes whom") treats **every** flagged transaction as
a shared 50/50 cost: `BalanceTimeline.vue` runs `runningBalance / 2` over all
transactions with no per-expense ownership. Real couples have expenses that
belong to **one** person — e.g. Peter agreed to pay the strata fee in full, or a
personal purchase that shouldn't be split. Today such an expense is still split
50/50, producing a wrong settlement figure (the partner appears to owe half of
something they don't owe at all).

We need a way to mark an expense as **Peter-only / Carey-only** (vs. shared) and
have the settlement reflect 100% responsibility.

## 2. Goals & Non-Goals

**Goals**
- Assign ownership to expenses: `shared` (default), or one specific person.
- Bulk assignment by **category** (the primary path), plus a per-transaction
  **hashtag override** read from the YNAB memo.
- Correct settlement math for all owner/payer combinations, including the
  cross-paid case (one partner pays the other's personal expense).
- Keep the feature **generic** — no hardcoded names; works for any couple.
- No behavior change until owners are actually assigned (legacy-equivalent).

**Non-Goals**
- No in-app per-transaction owner **editor** this round (would require the
  deferred write-back to YNAB; see §8). Per-transaction ownership is read-only
  recognition of memo hashtags.
- No configurable, arbitrary split ratios (only `shared` = 50/50 vs. 100% owner).
  Arbitrary ratios remain a future open question.
- No write-back to YNAB; no change to the read-only posture.
- No dedicated standalone settlement panel (that is Approach 3 / a follow-up).

## 3. Ownership Model

Each transaction resolves to an `ownerSide ∈ {left, right, shared}`.

**Resolution precedence** (first match wins):
1. **Explicit memo hashtag** — `#<leftSlug>` / `#<rightSlug>` (from the person
   slugs), or `#shared` to force-share a category-owned transaction.
2. **Category→owner map** — e.g. the "Strata" category mapped to the left side.
3. **Default** — `shared`.

**Transfers are exempt.** Ownership is not applied to `#transfer` transactions;
they remain `shared` and, because both legs are present, continue to net to their
full amount exactly as today. (Marking a settle-up as "Peter-only" is
meaningless.)

## 4. Settlement Math

Convention: **net balance is positive when the right-person owes the
left-person.** Each transaction contributes:

```
contribution = (source === 'left' ? +1 : -1) × (−amount) × shareOfNonPayer

shareOfNonPayer =
  owner === 'shared'        → 0.5
  owner === payer (source)  → 0      (paid your own expense → no debt)
  owner === the other side  → 1.0    (they paid your expense → you owe all of it)
```

Worked matrix for a $400 expense (amounts in dollars for readability; code uses
milliunits):

| owner \ paid by | Left (Peter) | Right (Carey) |
|---|---|---|
| **shared** | Carey owes $200 | Peter owes $200 |
| **Peter (left)** | $0 | Peter owes $400 |
| **Carey (right)** | Carey owes $400 | $0 |

Properties:
- **Legacy-equivalent (up to sign convention):** if every transaction is
  `shared`, this reduces to the current `sum(source==left ? amount : -amount) / 2`
  in magnitude and series shape. This design fixes an explicit direction
  (positive = right owes left); the current code leaves direction implicit, so
  the displayed sign becomes well-defined here. No magnitude change until owners
  are assigned.
- **Income/refunds:** the signed `(−amount)` term handles positive amounts
  (a shared refund splits correctly).
- **Transfers:** unchanged (see §3).

## 5. Architecture

### 5.1 New / changed modules (`src/utils/designations/`)

- **`rules/ownerRule.js`** *(new)* — `detectOwner(transaction, config) →
  { ownerSide, reason }`. Implements §3 precedence. Recognizes `#<slug>` /
  `#shared` via existing `extractors/hashtags.js` helpers; reads person slugs
  from config (never hardcoded).
- **`settlement.js`** *(new)* — pure `computeSettlement(transactions) →
  { net, direction, series }`:
  - `net`: final balance (milliunits, sign per §4 convention).
  - `direction`: `{ from, to, amount }` resolved to person names for display
    (amount ≥ 0; `from` owes `to`).
  - `series`: `[{ date, balance }]` running points (replaces the inline
    `chartData` loop in `BalanceTimeline.vue`).
  - Contribution logic from §4 lives here, in one tested function.
- **`processor.js`** — during enrichment, call `ownerRule.detectOwner` and
  attach `ownerSide` (+ `ownerReason`) immutably, alongside the existing
  designation flags. Follows the existing immutable-enrichment pattern.
- **`config.js`** — add accessors (see §6) and person-slug derivation.
- **`index.js`** — barrel exports for the new rule + settlement module.

### 5.2 Data flow (additions in **bold**)

```
Raw YNAB (Orange-flagged)
→ Merge & Sort
→ Loading gate
→ processor.addHashtagsToTransactions:
    householdRule → #household
    transferRule  → #transfer
    categoryRule  → custom
    **ownerRule   → ownerSide (hashtag > category map > shared)**
→ processor.processTransactionsWithTrips (unchanged)
→ Display:
    **settlement.computeSettlement(transactions) → BalanceTimeline**
    CombinedTransactions (**owner badge + owner filter**)
```

## 6. Config & Persistence

All in `localStorage`; no write-back to YNAB.

| Config | Shape | Storage key | Default |
|---|---|---|---|
| Person names | `{ left: { name }, right: { name } }` | `person_names` | budget name per side |
| Category owners | `{ [categoryId]: 'left' \| 'right' }` (shared = absent) | `category_owners` | `{}` |

**Slug derivation:** `name.toLowerCase()` with non-alphanumerics stripped
(`"Peter" → peter`, `"Anna Lee" → annalee`). Recognized as `#peter` etc.
The category-owners map stores **side** (`left`/`right`), not the name, so
renaming a person does not orphan category assignments.

## 7. UI

- **`Budget.vue`** — add a **Person name** field per budget card (defaults to the
  budget name), persisted to `person_names`. Natural home: each card already
  represents one side.
- **`HouseholdCategorySettings.vue` → `CategorySettings.vue`** (rename +
  generalize) — keep the existing household checkbox (shared bill → `#household`,
  trip exclusion) and add an **independent Owner selector per category:
  Shared / `<leftName>` / `<rightName>`** (default Shared). The two axes are
  independent — e.g. Strata = household ✓ **and** owner = Peter. Writes to
  `category_owners`.
- **`BalanceTimeline.vue`** — consume `computeSettlement`; render the net with
  names + direction (e.g. *"Carey owes Peter $X"*). Trip-region overlays
  unchanged.
- **`CombinedTransactions.vue`** — show an **owner badge** per transaction and an
  **owner filter** (Shared / `<leftName>` / `<rightName>`), using the resolved
  `ownerSide`.
- **`debug.js`** — include an `ownerSide` breakdown in `getSummary()`.

## 8. Edge Cases & Decisions

- **Conflicting explicit tags** (both `#peter` and `#carey` in one memo):
  contradictory → resolve to `shared` and emit a `console.debug` note. (Explicit
  single tag or `#shared` always wins over the category map.)
- **`#shared` override:** lets a transaction in an owned category be forced back
  to shared without removing the category mapping.
- **Person name empty / collides** (both sides resolve to the same slug):
  hashtag recognition for the colliding slug is disabled (ambiguous); category
  map still works. Surface a small warning in `CategorySettings`.
- **Per-transaction editing:** out of scope — the app reads `#peter`/`#carey`
  from the YNAB memo (user-maintained, like `#household`/`#trip`). An in-app
  owner editor waits on write-back (deferred, per `docs/product.md`).
- **Transfers:** ownership never applied (see §3).
- **Income/positive amounts:** handled by the signed formula (§4).

## 9. Testing

- **`ownerRule` unit tests** — precedence (hashtag > category map > default),
  `#shared` override, slug derivation, conflicting-tags fallback, transfer
  exemption.
- **`settlement.js` unit tests** — the full owner×payer matrix (§4) incl. the
  cross-paid case; income/refund sign; transfers netting to full amount;
  **all-shared equals the legacy `/2` in magnitude** with the §4 direction
  convention asserted explicitly (regression guard).
- **Integration** — extend `test/integration.test.js` with ownership scenarios
  against the fixture (add `#peter`/category-owner cases), asserting the net
  settlement figure.
- Maintain existing coverage thresholds (80% stmts/fns/lines, 65% branches).

## 10. Rollout / Sequencing

1. `config.js` accessors + slug derivation (+ tests).
2. `ownerRule.js` (+ tests).
3. `settlement.js` extraction from `BalanceTimeline` (+ tests; assert
   legacy-equivalence before adding owner logic).
4. `processor.js` wiring (`ownerSide` enrichment).
5. UI: `Budget.vue` person name → `CategorySettings.vue` owner selector →
   `BalanceTimeline.vue` named settlement → `CombinedTransactions.vue`
   badge/filter.
6. `debug.js` summary; integration tests; coverage check.
