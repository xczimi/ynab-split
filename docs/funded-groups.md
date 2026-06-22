# Design Note — Funded Groups settlement view

**Status:** design, not yet implemented.
**Branch of origin:** `design/funded-groups`.
**Relates to:** [`product.md`](./product.md) §4 (who-owes-whom), the
`settlement.js` engine, and the existing Trip / Household / Transfer summaries.

This note records a design reached by interview. It replaces the way "who owes
whom" is *presented*, not the underlying split math. For *how* the codebase is
laid out see [`../CLAUDE.md`](../CLAUDE.md).

---

## 1. Problem

The settlement figure is shown as a single accumulating **"Owes $X" / "Owed $X"**
number on the budget card. That number is unfollowable: to decide whether you
trust it you have to mentally reconstruct every transaction since the dawn of
time. The arithmetic is not the issue (`shared ÷ 2` is obvious) — the issue is
that one undifferentiated total gives you no foothold to verify or settle it.

A second, related pain: it is hard to read `CombinedTransactions` and trace *why*
a given transaction is owned/designated the way it is, or how it rolls up into the
balance.

## 2. The reframe — bounded, auto-settled groups

Replace the single number with **funded groups**: bounded chunks of the balance
that map to real life, each one small enough to recognize and trust without
drilling to transaction level.

- **Groups = trips + non-trip calendar quarters.**
- Membership is **designation-first**: trip-tagged transactions belong to their
  trip group (windowed by the trip's dates); everything else falls into its
  calendar **quarter**. One transaction belongs to exactly one group. Windows may
  overlap in time (a trip sits inside a quarter) but membership stays clean.
  Household bills are neither trip-tagged nor special here, so they fold into
  their quarter.
- Each group reports its own net "who owes whom" and a **settled / partial /
  open** status.
- **No flat transaction list, no per-transaction drill-down.** Groups are the
  granularity of both understanding and settlement. (This supersedes an earlier
  "per-row legibility list" direction, which is dropped — see §7.)

## 3. Settlement is computed per-transaction; groups only aggregate

The key architectural decision: **settlement is a per-transaction computation on
one flat chronological timeline. Groups are a pure presentation layer** that asks
"are all *my* transactions settled?"

Why this beats reasoning about group-level windows:

1. **The overlap problem evaporates.** Group boundaries and overlapping windows
   never enter the settlement math. Trips and quarters become labels, not logic.
2. **It fits "rarely at $0."** This couple is persistently in the red one
   direction; the balance essentially never returns to zero. So settlement must
   be **relative**, not anchored to the balance hitting a baseline.

### The watermark rule

- Sort all transactions oldest → newest.
- Two streams: **accruals** (non-transfer expenses, push the balance) and
  **clearings** (transfers / settle-ups, pay it down).
- **Transfer-cleared, oldest-first:** cumulative clearings pay down the oldest
  outstanding accruals first. A transaction's computed **`settled`** flag is true
  once the running total of clearings has reached past it.
- There is **always an open tail** = the most recent unsettled accruals. That
  permanent tail is the standing balance — a feature, not a bug.

> **Phase-0 spike correction (see §9).** On the real fixture, bidirectional
> accruals mean the open tail does **not** telescope to the exact net. The exact
> net stays `computeSettlement().net`; the open-tail total is reconciled to it
> with an explicit **residual line**, not by assuming they are equal.

### Group aggregation

- A **group is settled iff every transaction in it is settled.** Literally "are
  all my transactions settled?"
- A partially-cleared group shows progress, e.g. **"3 of 8 settled."**
- Group definition (trip vs quarter) affects only *display*, never the settlement
  result.

## 4. Transfers already clear correctly (no fix needed)

An earlier version of this plan called for "fixing transfer→balance direction."
**That was a misread — there is no bug.** A transfer is a *two-legged* event:
`transferRule.findMatches` pairs matching absolute amounts across *both* budgets.
A settle-up of $100 appears as an outflow (`-100000`, `source: left`) **and** an
inflow (`+100000`, `source: right`). Both legs get `ownerSide: 'shared'`, and
through `transactionContribution`:

- left leg: `+1 × (+100000) × 0.5 = +50000`
- right leg: `−1 × (−100000) × 0.5 = +50000`
- **sum = +100000** — the full amount, in the clearing direction.

The `0.5` is correct *because* the transfer is double-represented across the two
budgets, so `0.5 + 0.5 = 1.0 ×` the amount. Forcing `'shared'` is what guarantees
that clean clearing (otherwise one leg could pick up a category-owner and break
it). `"transfer-exempt"` means *exempt from ownership/expense classification* —
do not assign it to a person, trip, or household — **not** exempt from the
balance. The clearing mechanism the whole funded-groups model depends on already
works.

## 5. Presentation

- The grouped view **replaces** the "Owes / Owed" presentation (likely in the
  Joint Spending tab). The budget-card headline can remain as the open-tail total,
  now *explained* by the groups beneath it.
- Each group row shows: name, time window, net (who owes whom for that group's
  accruals), and settled / partial / open status.
- Settled groups are shown **collapsed / greyed** (visible progress is
  motivating); open and partial groups are prominent.

## 6. Build order

1. **Settlement engine** — add a per-transaction `settled` flag via cumulative,
   oldest-first transfer clearing on the flat timeline. Unit-test the bidirectional
   / never-zero cases against the 161-transaction fixture (see §8).
2. **Grouping** — partition `settled`-flagged transactions into trips + non-trip
   quarters; aggregate to per-group net and settled status.
3. **Grouped view** — a component that replaces the Owes/Owed presentation.

## 7. Explicitly dropped / out of scope

These were considered earlier in the same design session and superseded by the
grouped model:

- Per-row legibility list (owner + why + contribution + running balance).
- An "undesignated only" triage filter.
- Inline assignment, local hashtag overrides, the JSON export/import block.
- Negation hashtags (`#nothousehold` etc.).
- A transfer-semantics fix (no bug exists — see §4).

## 8. Accepted risks & things to validate

- **Settle-ups clear by date, not by earmark.** A payment clears whatever debt
  stood when it happened, regardless of which trip it was "meant for." Accepted
  fuzziness, consistent with the "auto, don't overthink it" choice.
- **Bidirectional / oscillating balance.** The balance crosses zero and goes
  negative repeatedly; "cumulative accrued position" is not monotonic. ✅ **Resolved
  by the forward-ledger model in §9** (the original oldest-first pool rule was
  disproved by real data and replaced).
- **`#transfer` false-positive — ✅ fixed.** A recurring shared expense one partner
  pays whose amount matches the recurring reimbursement transfer within 3 days was
  mis-tagged `#transfer` (observed: a monthly $555.97 strata bill vs the monthly
  $555.97 reimbursement). A real settle-up moves money OUT of one budget and INTO the
  other (opposite-sign legs); the matcher now requires opposite signs, so a same-sign
  expense can no longer be mistaken for its reimbursement. Critically, the false tag
  had been **overriding the user's per-category owner** (Strata Fee = 100% one
  partner), silently dropping the expense from the split — now respected.
- **Follow-up (deferred):** a non-blocking **"mark your side of transfers"
  warning** — detect a likely one-sided transfer leg (single-sided amount with no
  cross-budget match, or a known settle-up payee) and nudge the user to tag it
  `#transfer`. Out of scope for this branch (it touches transfer detection, which
  §7 walls off); captured here so it is not lost.

## 9. Settlement model — forward ledger, strict zero-crossing

> **History.** The Phase-0 spike first tried an *oldest-first clearing-pool*
> watermark. Real two-budget data (200 txns) disproved its core premise: the
> balance is **not** persistently one-sided — it crosses zero and goes negative
> repeatedly. The pool rule mis-allocated recent settle-ups onto old debt and
> wrongly marked a year of groups "open." The model below replaces it. The
> separate "open tail + residual" reconciliation line is also dropped.

The settled flag is a **forward running ledger from day 0** (`markSettled`):

1. **Authoritative net.** `computeSettlement().net` — the exact net over *all*
   transactions (accruals + clearings) — is the single source of truth and the
   budget-card headline. The grouped view shows this and nothing that needs to
   "reconcile" to it; the open/partial groups simply *are* what is still owed.
2. **The rule (strict).** Walk every transaction oldest → newest, keeping the
   running net balance. The books close at the **last point where that balance
   reached zero or passed into the other person's favour**
   (`sign(net) * balance <= 0`): every transaction up to and including that *last
   square* point is `settled`; the run of transactions since is the open tail that
   makes up the current balance. A group is settled iff all its transactions are;
   the group straddling the last crossing shows partial ("7 of 9 settled").
3. **Strict, not partial-credit.** A group settles only once the standing debt was
   genuinely cleared (the balance reached/crossed zero), **not** merely paid down
   part-way. Returning to zero is required; a balance that only dips without
   crossing leaves its groups open. (Considered and rejected: a lenient
   "paid-back-below-its-level" variant — too forgiving.)
4. **Forward = backward (validation).** Walking *backward* from today's balance,
   peeling the newest transactions until the running total returns to ≤ 0, yields
   the identical open set. The forward ledger is the real computation; the backward
   walk is the cross-check. Both are asserted in the tests.
5. **Respects timing.** A settle-up only ever clears debt that actually stood when
   it happened — it cannot reach back and re-settle a much older balance. Correct
   whichever way the balance points and however many times it oscillates.
6. **Untagged transactions are just transactions.** A row not recognized as a
   transfer is a normal accrual regardless of inflow/outflow sign. No retag, no
   special-casing — honors §7. (A real **`#transfer` false-positive** exists in the
   wild — a recurring strata bill whose amount collides with a recurring settle-up
   gets mis-tagged; that is transfer-detection accuracy, the §8 deferred follow-up.)

On the 161-txn fixture this marks **3 groups settled** (the balance crossed zero
only once, in Dec 2024); on the real 200-txn data it marks **all of 2024–2025
settled** with only the recent 2026 quarters open — matching the owner's lived
recollection of being square late in the year.
