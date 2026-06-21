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

- **Oldest-first assumes generic settle-ups.** If a payment is made out of order
  or earmarked for one specific trip, it still clears the oldest open balance.
  Accepted fuzziness, consistent with the "auto, don't overthink it" choice.
- **Bidirectional netting needs care.** Accruals push the balance both ways, so
  "cumulative accrued position" is not strictly monotonic. ✅ **Resolved by the
  Phase-0 spike — see §9.**
- **Follow-up (deferred):** a non-blocking **"mark your side of transfers"
  warning** — detect a likely one-sided transfer leg (single-sided amount with no
  cross-budget match, or a known settle-up payee) and nudge the user to tag it
  `#transfer`. Out of scope for this branch (it touches transfer detection, which
  §7 walls off); captured here so it is not lost.

## 9. Phase-0 spike resolution (settlement watermark)

The build's first act was a spike computing the oldest-first watermark over the
161-transaction fixture. It surfaced a genuine fork (the §8 bidirectional risk),
resolved by interview. Decisions, now locked:

1. **Authoritative net.** `computeSettlement().net` (the exact net over *all*
   transactions, accruals + clearings) is the single source of truth and what the
   budget card shows. On the fixture this is **+$286.15** (right owes left).
2. **Reconciliation by residual line, literal §3.** `settled` stays a
   **per-transaction, oldest-first** flag; a **group is settled iff every
   transaction in it is settled**. The open tail is the set of unsettled
   transactions; on the fixture its total (~$503) does **not** equal the net, so
   the grouped view shows an explicit **residual line** (~−$217) that closes the
   open-tail total to the exact `computeSettlement().net`. The gap is made
   visible, not hidden.
3. **Exact rule (A1).** Sort accruals oldest → newest by their **signed
   contribution** (`transactionContribution`); maintain a running cumulative
   accrued total; a transaction is `settled` once cumulative-accrued (including
   itself) ≤ the **clearing pool** = −Σ(clearing contributions). Direction-aware
   (works whichever way the net points). Because accruals are bidirectional the
   flag can be non-contiguous (a late negative accrual can dip the running total
   back under the pool — 2 such cases in the fixture); **accepted**, consistent
   with §8 "accepted fuzziness." Clearings (`#transfer`, transfer-exempt) form the
   pool, belong to **no group**, and are treated as always-settled.
4. **Untagged transactions are just transactions.** A row not recognized as a
   transfer is a normal accrual regardless of inflow/outflow sign (e.g. an
   empty-memo `"Carey"` inflow is income/refund-like, contributing negatively). No
   retag, no special-casing — honors §7. Any cleanup is the deferred warning above.
