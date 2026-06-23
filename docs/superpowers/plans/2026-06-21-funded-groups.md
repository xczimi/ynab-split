# Funded Groups Settlement View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Owes/Owed" number with a grouped settlement view — bounded trip/quarter groups, each with a per-group net and settled/partial/open status, reconciling exactly to the existing headline net via an explicit residual line.

**Architecture:** Three sequential layers on one branch. (1) A pure settlement engine adds a per-transaction `settled` flag via cumulative, oldest-first clearing on the flat timeline. (2) A pure grouping module partitions settled-marked accruals into trips + non-trip calendar quarters and aggregates per-group net + status. (3) A thin Vue presentation component renders the groups and the reconciliation (open-tail total + residual = net), wired into the Joint Spending tab. All math lives in the coverage-gated `.js` modules; the component is presentation-only and verified manually.

**Tech Stack:** Vue 3 (Options API), Luxon (America/Vancouver), Ramda available, Jest 30 (`node` env, no DOM), milliunits (1000 = $1.00). ESM.

**Design source of intent:** `docs/funded-groups.md` — especially §3 (per-transaction settlement), §5 (presentation), §6 (build order), and **§9 (Phase-0 spike resolution — the locked decisions this plan implements).**

---

## Locked decisions (from `docs/funded-groups.md` §9)

1. **Authoritative net** = `computeSettlement().net` (exact, all transactions). Fixture value: **286155** milliunits (right owes left).
2. **Reconciliation via residual line, literal §3.** `settled` is per-transaction, oldest-first; a **group is settled iff every transaction in it is settled**. Open tail = unsettled accruals; it does **not** equal net, so an explicit **residual line** closes it.
3. **Exact rule "A1":** sort accruals oldest→newest by signed `transactionContribution`; running cumulative; settled once `sign(net) * cumulative ≤ sign(net) * clearingPool`, where `clearingPool = −Σ(clearing contributions)`. Clearings (`#transfer`) form the pool, belong to no group, are always settled.
4. **Untagged transactions are plain accruals** (no retag, no inflow/outflow special-casing).

### Fixture reference values (used as test oracles)

Computed by running the real pipeline over `test/fixtures/sample-transactions.json`:

| Quantity | Value (milliunits) |
|---|---|
| `net` (`computeSettlement().net`) | **286155** |
| `clearingPool` | **9067400** |
| accruals / clearings count | **145 / 16** |
| settled accruals / open-tail count | **114 / 31** |
| `openTailTotal` (Σ unsettled accrual contributions) | **503660** |
| `residual` (`net − openTailTotal`) | **−217505** |
| groups total / settled groups | **12 / 7** |
| `trip2025May9` group | count **22**, settled **15**, status **partial** |
| open groups | `trip2025May31-Jun2`, `quarter:2025-Q3`, `quarter:2025-Q4` |

---

## File Structure

| File | Responsibility | Layer |
|---|---|---|
| `src/utils/designations/settlement.js` (modify) | Add `isClearing`, `clearingPool`, `markSettled`, `settlementWatermark`. Pure math. | 1 |
| `src/utils/designations/settlement.test.js` (modify) | Unit tests for the new functions (synthetic + fixture). | 1 |
| `src/utils/designations/groups.js` (create) | `quarterKey`, `groupKeyFor`, `buildGroups`, `summarizeGroups`. Pure partition + aggregate. | 2 |
| `src/utils/designations/groups.test.js` (create) | Unit tests (synthetic + fixture). | 2 |
| `src/utils/designations/index.js` (modify) | Barrel re-exports of all new functions. | 1 & 2 |
| `test/integration.test.js` (modify) | Fixture-level reconciliation assertions for the whole pipeline. | 1 & 2 |
| `src/components/FundedGroups.vue` (create) | Presentation of groups + reconciliation. Thin; no math. | 3 |
| `src/App.vue` (modify) | Wire `FundedGroups` into the Joint Spending tab; expose summary via `window.ynabDebug`. | 3 |
| `src/utils/debug.js` (modify) | Add `fundedGroups()` debug accessor for manual verification. | 3 |

---

# LAYER 1 — Settlement engine

Build the per-transaction `settled` flag. Gate: `npm run check` green, coverage ≥ thresholds, code review.

### Task 1: `isClearing` + `clearingPool`

**Files:**
- Modify: `src/utils/designations/settlement.js`
- Test: `src/utils/designations/settlement.test.js`

- [ ] **Step 1: Write the failing tests** — append to `settlement.test.js`:

```javascript
import { isClearing, clearingPool } from './settlement.js';

describe('isClearing', () => {
  it('true only when transfer-tagged', () => {
    expect(isClearing({ hasTransferTag: true })).toBe(true);
    expect(isClearing({ hasTransferTag: false })).toBe(false);
    expect(isClearing({})).toBe(false);
  });
});

describe('clearingPool', () => {
  it('is the negated sum of clearing contributions (positive when net positive)', () => {
    // one clearing paying the balance down by 150000
    const clearing = { source: 'right', amount: -300000, ownerSide: 'shared', hasTransferTag: true };
    // contribution = (-1) * (300000) * 0.5 = -150000 ; pool = +150000
    expect(clearingPool([clearing])).toBe(150000);
  });
  it('ignores accruals', () => {
    const accrual = { source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false };
    expect(clearingPool([accrual])).toBe(0);
  });
  it('empty -> 0', () => expect(clearingPool([])).toBe(0));
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- settlement.test.js`
Expected: FAIL — `isClearing`/`clearingPool` are not exported.

- [ ] **Step 3: Implement** — add to `settlement.js` (after `transactionContribution`):

```javascript
/**
 * A transaction is a "clearing" (settle-up) iff it carries the transfer tag.
 * Clearings are transfer-exempt: they fund the clearing pool and belong to no group.
 * @param {Object} transaction
 * @returns {boolean}
 */
export function isClearing(transaction) {
  return Boolean(transaction.hasTransferTag);
}

/**
 * The clearing pool: total settle-up magnitude in the net's direction (milliunits).
 * = -Σ(contribution) over clearings. Clearings pay the balance down, so they sum
 * negative when the net is positive; negating yields a positive pool magnitude.
 * @param {Array} transactions
 * @returns {number}
 */
export function clearingPool(transactions = []) {
  return -transactions
    .filter(isClearing)
    .reduce((sum, t) => sum + transactionContribution(t), 0);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- settlement.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/designations/settlement.js src/utils/designations/settlement.test.js
git commit -m "feat(settlement): add isClearing and clearingPool helpers"
```

### Task 2: `markSettled` — synthetic cases

**Files:**
- Modify: `src/utils/designations/settlement.js`
- Test: `src/utils/designations/settlement.test.js`

- [ ] **Step 1: Write the failing tests** — append:

```javascript
import { markSettled } from './settlement.js';

describe('markSettled (oldest-first A1 rule)', () => {
  // Three +100000 accruals oldest->newest, one clearing paying down 150000.
  // pool = 150000, net = 300000 - 150000 = 150000.
  const accr = (date) => ({ date, source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false });
  const clearing = { date: '2024-01-15', source: 'right', amount: -300000, ownerSide: 'shared', hasTransferTag: true };

  it('settles oldest accruals up to the clearing pool, leaves the rest open', () => {
    const txns = [accr('2024-01-01'), accr('2024-02-01'), accr('2024-03-01'), clearing];
    const marked = markSettled(txns);
    const byDate = Object.fromEntries(marked.filter(t => !t.hasTransferTag).map(t => [t.date, t.settled]));
    expect(byDate['2024-01-01']).toBe(true);   // cumulative 100000 <= 150000
    expect(byDate['2024-02-01']).toBe(false);  // cumulative 200000 > 150000
    expect(byDate['2024-03-01']).toBe(false);  // cumulative 300000 > 150000
  });

  it('clearings are always settled', () => {
    const marked = markSettled([clearing]);
    expect(marked[0].settled).toBe(true);
  });

  it('preserves input order and adds contribution', () => {
    const txns = [accr('2024-03-01'), accr('2024-01-01')];
    const marked = markSettled(txns);
    expect(marked.map(t => t.date)).toEqual(['2024-03-01', '2024-01-01']);
    expect(marked[0].contribution).toBe(100000);
  });

  it('direction-aware: mirrors for a negative net', () => {
    // left owes right: accruals negative, a clearing paying up.
    const nAccr = (date) => ({ date, source: 'right', amount: -200000, ownerSide: 'shared', hasTransferTag: false }); // contribution -100000
    const up = { date: '2024-01-15', source: 'left', amount: -300000, ownerSide: 'shared', hasTransferTag: true }; // contribution +150000
    const txns = [nAccr('2024-01-01'), nAccr('2024-02-01'), nAccr('2024-03-01'), up];
    const byDate = Object.fromEntries(markSettled(txns).filter(t => !t.hasTransferTag).map(t => [t.date, t.settled]));
    expect(byDate['2024-01-01']).toBe(true);
    expect(byDate['2024-02-01']).toBe(false);
  });

  it('empty -> empty, zero net -> all settled', () => {
    expect(markSettled([])).toEqual([]);
    const offsetting = [
      { date: '2024-01-01', source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false },
      { date: '2024-02-01', source: 'right', amount: -200000, ownerSide: 'shared', hasTransferTag: false },
    ];
    expect(markSettled(offsetting).every(t => t.settled)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- settlement.test.js`
Expected: FAIL — `markSettled` not exported.

- [ ] **Step 3: Implement** — add to `settlement.js`:

```javascript
/**
 * Mark each transaction with a per-transaction `settled` flag via cumulative,
 * oldest-first clearing on the flat timeline (the §9 "A1" rule).
 *
 * - Accruals are walked oldest→newest by date; a running cumulative accrued total
 *   is kept. An accrual is `settled` once that running total, measured in the net's
 *   direction, has been covered by the clearing pool.
 * - Clearings are always `settled` (they ARE the payment) and belong to no group.
 * - Direction-aware (works whichever way the net points). Zero net → all settled.
 *
 * @param {Array} transactions  each requires .date, .source, .amount, .ownerSide, .hasTransferTag
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {Array} new array (input order) of {...t, contribution, settled}
 */
export function markSettled(transactions = [], options = {}) {
  const net = computeSettlement(transactions, options).net;
  const pool = clearingPool(transactions);
  const sign = Math.sign(net);

  const chronological = transactions
    .map((t, index) => ({ t, index }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date) || a.index - b.index);

  const settledByIndex = new Array(transactions.length);
  let running = 0;
  for (const { t, index } of chronological) {
    if (isClearing(t)) {
      settledByIndex[index] = true;
      continue;
    }
    running += transactionContribution(t);
    settledByIndex[index] = sign === 0 ? true : sign * running <= sign * pool;
  }

  return transactions.map((t, index) => ({
    ...t,
    contribution: transactionContribution(t),
    settled: settledByIndex[index],
  }));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- settlement.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/designations/settlement.js src/utils/designations/settlement.test.js
git commit -m "feat(settlement): add markSettled oldest-first watermark"
```

### Task 3: `settlementWatermark` + barrel export

**Files:**
- Modify: `src/utils/designations/settlement.js`, `src/utils/designations/index.js`
- Test: `src/utils/designations/settlement.test.js`

- [ ] **Step 1: Write the failing tests** — append:

```javascript
import { settlementWatermark } from './settlement.js';

describe('settlementWatermark', () => {
  const accr = (date) => ({ date, source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false });
  const clearing = { date: '2024-01-15', source: 'right', amount: -300000, ownerSide: 'shared', hasTransferTag: true };

  it('residual closes open tail to the exact net', () => {
    const txns = [accr('2024-01-01'), accr('2024-02-01'), accr('2024-03-01'), clearing];
    const w = settlementWatermark(txns);
    expect(w.net).toBe(150000);
    expect(w.clearingPool).toBe(150000);
    expect(w.openTailTotal).toBe(200000);            // two unsettled +100000 accruals
    expect(w.residual).toBe(w.net - w.openTailTotal); // -50000
    expect(w.openTailTotal + w.residual).toBe(w.net); // invariant
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- settlement.test.js`
Expected: FAIL — `settlementWatermark` not exported.

- [ ] **Step 3: Implement** — add to `settlement.js`:

```javascript
/**
 * Full settlement watermark summary for the grouped view.
 * @param {Array} transactions
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {{transactions:Array, net:number, clearingPool:number, openTailTotal:number, residual:number}}
 *   openTailTotal = Σ contribution over UNSETTLED accruals (the visible open tail).
 *   residual = net - openTailTotal (the explicit reconciliation line; see §9).
 */
export function settlementWatermark(transactions = [], options = {}) {
  const marked = markSettled(transactions, options);
  const net = computeSettlement(transactions, options).net;
  const openTailTotal = marked
    .filter(t => !isClearing(t) && !t.settled)
    .reduce((sum, t) => sum + t.contribution, 0);
  return {
    transactions: marked,
    net,
    clearingPool: clearingPool(transactions),
    openTailTotal,
    residual: net - openTailTotal,
  };
}
```

- [ ] **Step 4: Export from barrel** — in `src/utils/designations/index.js`, replace the settlement export line:

```javascript
// Settlement utilities
export {
  shareOfNonPayer,
  transactionContribution,
  computeSettlement,
  isClearing,
  clearingPool,
  markSettled,
  settlementWatermark,
} from './settlement.js';
```

- [ ] **Step 5: Run, verify pass + coverage**

Run: `npm test -- settlement.test.js`
Expected: PASS.
Run: `npm test -- --coverage`
Expected: thresholds still met (≥80% statements/functions/lines, ≥65% branches).

- [ ] **Step 6: Commit**

```bash
git add src/utils/designations/settlement.js src/utils/designations/settlement.test.js src/utils/designations/index.js
git commit -m "feat(settlement): add settlementWatermark and export from barrel"
```

### Task 4: Fixture oracle test for the engine

**Files:**
- Modify: `test/integration.test.js`

- [ ] **Step 1: Write the failing test** — add a `describe` block (the file already imports `readFileSync`, builds `sampleTransactions`, and mocks `localStorage`; reuse them). Add the import to the existing designations import block and append:

```javascript
import { markSettled, settlementWatermark, computeSettlement as computeSettlementNet } from '../src/utils/designations/index.js';

describe('settlement watermark over the real fixture', () => {
  const processed = processTransactions(sampleTransactions, {
    ownership: { personNames: { left: { name: 'Left' }, right: { name: 'Right' } }, categoryOwners: {} },
  });

  it('marks 114 of 145 accruals settled (31 open-tail)', () => {
    const marked = markSettled(processed);
    const accruals = marked.filter(t => !t.hasTransferTag);
    expect(accruals.length).toBe(145);
    expect(accruals.filter(t => t.settled).length).toBe(114);
    expect(accruals.filter(t => !t.settled).length).toBe(31);
  });

  it('reconciles open tail + residual to the exact net', () => {
    const w = settlementWatermark(processed);
    expect(w.net).toBe(286155);
    expect(w.clearingPool).toBe(9067400);
    expect(w.openTailTotal).toBe(503660);
    expect(w.residual).toBe(-217505);
    expect(w.openTailTotal + w.residual).toBe(w.net);
    expect(w.net).toBe(computeSettlementNet(processed).net);
  });
});
```

- [ ] **Step 2: Run, verify pass** (implementation already exists from Tasks 1–3)

Run: `npm test -- integration.test.js`
Expected: PASS. If any number differs, STOP and use superpowers:systematic-debugging — do not edit oracle values to match; investigate why the engine diverges.

- [ ] **Step 3: Commit**

```bash
git add test/integration.test.js
git commit -m "test(settlement): fixture oracle for watermark reconciliation"
```

### Layer 1 gate

- [ ] Run `npm run check` — Jest + build green.
- [ ] Run `npm test -- --coverage` — thresholds met.
- [ ] Use superpowers:requesting-code-review on the Layer-1 diff; address findings.
- [ ] Use superpowers:verification-before-completion before declaring Layer 1 done.

---

# LAYER 2 — Grouping

Partition settled-marked accruals into trips + non-trip quarters. Depends on Layer 1.

### Task 5: `quarterKey` + `groupKeyFor`

**Files:**
- Create: `src/utils/designations/groups.js`
- Create: `src/utils/designations/groups.test.js`

- [ ] **Step 1: Write the failing tests** — `groups.test.js`:

```javascript
import { quarterKey, groupKeyFor } from './groups.js';

describe('quarterKey (America/Vancouver)', () => {
  it('maps months to quarters', () => {
    expect(quarterKey('2025-01-15')).toBe('2025-Q1');
    expect(quarterKey('2025-04-07')).toBe('2025-Q2');
    expect(quarterKey('2025-07-03')).toBe('2025-Q3');
    expect(quarterKey('2025-12-01')).toBe('2025-Q4');
  });
});

describe('groupKeyFor', () => {
  it('trip-tagged -> trip group', () => {
    expect(groupKeyFor({ date: '2025-05-09', tripName: 'trip2025May9' })).toBe('trip:trip2025May9');
  });
  it('untagged -> calendar quarter', () => {
    expect(groupKeyFor({ date: '2025-07-03', tripName: null })).toBe('quarter:2025-Q3');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- groups.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/utils/designations/groups.js`:

```javascript
/**
 * Funded Groups: partition settled-marked accruals into trips + non-trip calendar
 * quarters and aggregate per-group net + status. Pure presentation-layer grouping;
 * settlement is computed per-transaction in settlement.js (see docs/funded-groups.md §3, §9).
 */
import { DateTime } from 'luxon';
import { transactionContribution, isClearing, settlementWatermark } from './settlement.js';

const ZONE = 'America/Vancouver';

/**
 * Calendar-quarter key for an ISO date, e.g. "2025-Q2".
 * @param {string} isoDate
 * @param {string} [zone]
 * @returns {string}
 */
export function quarterKey(isoDate, zone = ZONE) {
  const d = DateTime.fromISO(isoDate, { zone });
  return `${d.year}-Q${Math.floor((d.month - 1) / 3) + 1}`;
}

/**
 * Group key for a transaction: trip-tagged → its trip; else its calendar quarter.
 * One transaction belongs to exactly one group.
 * @param {Object} transaction  requires .date and optional .tripName
 * @returns {string}
 */
export function groupKeyFor(transaction) {
  return transaction.tripName
    ? `trip:${transaction.tripName}`
    : `quarter:${quarterKey(transaction.date)}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- groups.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/designations/groups.js src/utils/designations/groups.test.js
git commit -m "feat(groups): add quarterKey and groupKeyFor"
```

### Task 6: `buildGroups`

**Files:**
- Modify: `src/utils/designations/groups.js`, `src/utils/designations/groups.test.js`

- [ ] **Step 1: Write the failing tests** — append to `groups.test.js`:

```javascript
import { buildGroups } from './groups.js';

const a = (over) => ({ source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false, contribution: 100000, settled: true, tripName: null, ...over });

describe('buildGroups', () => {
  it('partitions into trips + quarters, excludes clearings', () => {
    const txns = [
      a({ date: '2025-05-09', tripName: 'trip2025May9' }),
      a({ date: '2025-05-10', tripName: 'trip2025May9' }),
      a({ date: '2025-07-03' }),                              // quarter 2025-Q3
      { date: '2025-07-04', hasTransferTag: true, contribution: -50000, settled: true }, // clearing -> excluded
    ];
    const groups = buildGroups(txns);
    expect(groups.map(g => g.key)).toEqual(['trip:trip2025May9', 'quarter:2025-Q3']);
    expect(groups[0].kind).toBe('trip');
    expect(groups[0].count).toBe(2);
    expect(groups[1].kind).toBe('quarter');
  });

  it('net sums contributions; status reflects settled counts', () => {
    const txns = [
      a({ date: '2025-07-01', contribution: 100000, settled: true }),
      a({ date: '2025-07-02', contribution: 50000, settled: false }),
    ];
    const [q] = buildGroups(txns);
    expect(q.net).toBe(150000);
    expect(q.settledCount).toBe(1);
    expect(q.status).toBe('partial');
  });

  it('all settled -> settled; none settled -> open', () => {
    expect(buildGroups([a({ date: '2025-07-01', settled: true })])[0].status).toBe('settled');
    expect(buildGroups([a({ date: '2025-07-01', settled: false })])[0].status).toBe('open');
  });

  it('sorts groups oldest-first by startDate', () => {
    const groups = buildGroups([a({ date: '2025-09-01' }), a({ date: '2025-01-01' })]);
    expect(groups[0].startDate <= groups[1].startDate).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- groups.test.js`
Expected: FAIL — `buildGroups` not exported.

- [ ] **Step 3: Implement** — append to `groups.js`:

```javascript
/**
 * Partition settled-marked accruals into groups (trips + non-trip quarters) and
 * aggregate each to net + settled/partial/open status. Clearings are excluded —
 * they belong to no group (see §9). Input must already be markSettled().
 * @param {Array} markedTransactions
 * @returns {Array<{key,kind,label,transactions,net,count,settledCount,status,startDate,endDate}>} oldest-first
 */
export function buildGroups(markedTransactions = []) {
  const accruals = markedTransactions.filter(t => !isClearing(t));

  const byKey = new Map();
  for (const t of accruals) {
    const key = groupKeyFor(t);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(t);
  }

  const groups = [...byKey.entries()].map(([key, txns]) => {
    const sorted = [...txns].sort((x, y) => x.date.localeCompare(y.date));
    const net = sorted.reduce((sum, t) => sum + (t.contribution ?? transactionContribution(t)), 0);
    const settledCount = sorted.filter(t => t.settled).length;
    const count = sorted.length;
    const status = settledCount === count ? 'settled' : settledCount === 0 ? 'open' : 'partial';
    const kind = key.startsWith('trip:') ? 'trip' : 'quarter';
    const label = kind === 'trip' ? key.slice('trip:'.length) : key.slice('quarter:'.length);
    return {
      key, kind, label, transactions: sorted,
      net, count, settledCount, status,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
    };
  });

  return groups.sort((x, y) => x.startDate.localeCompare(y.startDate));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- groups.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/designations/groups.js src/utils/designations/groups.test.js
git commit -m "feat(groups): add buildGroups partition + aggregation"
```

### Task 7: `summarizeGroups` + barrel export

**Files:**
- Modify: `src/utils/designations/groups.js`, `src/utils/designations/groups.test.js`, `src/utils/designations/index.js`

- [ ] **Step 1: Write the failing test** — append to `groups.test.js`:

```javascript
import { summarizeGroups } from './groups.js';

describe('summarizeGroups', () => {
  it('returns groups plus reconciliation numbers', () => {
    const accr = (date) => ({ date, source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false, tripName: null });
    const clearing = { date: '2024-01-15', source: 'right', amount: -300000, ownerSide: 'shared', hasTransferTag: true };
    const s = summarizeGroups([accr('2024-01-01'), accr('2024-02-01'), accr('2024-03-01'), clearing]);
    expect(s.net).toBe(150000);
    expect(s.openTailTotal + s.residual).toBe(s.net);
    expect(Array.isArray(s.groups)).toBe(true);
    expect(s.groups.every(g => g.kind === 'quarter')).toBe(true); // none trip-tagged
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- groups.test.js`
Expected: FAIL — `summarizeGroups` not exported.

- [ ] **Step 3: Implement** — append to `groups.js`:

```javascript
/**
 * Full grouped-view summary: marks settlement, partitions into groups, and returns
 * the reconciliation numbers. openTailTotal + residual === net (the residual line).
 * @param {Array} transactions  raw (un-marked) designated transactions
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {{groups:Array, net:number, clearingPool:number, openTailTotal:number, residual:number}}
 */
export function summarizeGroups(transactions = [], options = {}) {
  const w = settlementWatermark(transactions, options);
  return {
    groups: buildGroups(w.transactions),
    net: w.net,
    clearingPool: w.clearingPool,
    openTailTotal: w.openTailTotal,
    residual: w.residual,
  };
}
```

- [ ] **Step 4: Export from barrel** — append to `src/utils/designations/index.js`:

```javascript
// Funded Groups (grouping + reconciliation)
export { quarterKey, groupKeyFor, buildGroups, summarizeGroups } from './groups.js';
```

- [ ] **Step 5: Run, verify pass + coverage**

Run: `npm test -- groups.test.js`
Expected: PASS.
Run: `npm test -- --coverage`
Expected: thresholds met.

- [ ] **Step 6: Commit**

```bash
git add src/utils/designations/groups.js src/utils/designations/groups.test.js src/utils/designations/index.js
git commit -m "feat(groups): add summarizeGroups and export from barrel"
```

### Task 8: Fixture oracle test for grouping

**Files:**
- Modify: `test/integration.test.js`

- [ ] **Step 1: Write the failing test** — add `summarizeGroups` to the integration import block and append:

```javascript
import { summarizeGroups } from '../src/utils/designations/index.js';

describe('funded groups over the real fixture', () => {
  const processed = processTransactions(sampleTransactions, {
    ownership: { personNames: { left: { name: 'Left' }, right: { name: 'Right' } }, categoryOwners: {} },
  });
  const summary = summarizeGroups(processed);

  it('produces 12 groups, 7 fully settled', () => {
    expect(summary.groups.length).toBe(12);
    expect(summary.groups.filter(g => g.status === 'settled').length).toBe(7);
  });

  it('trip2025May9 is partial 15/22', () => {
    const g = summary.groups.find(x => x.key === 'trip:trip2025May9');
    expect(g.count).toBe(22);
    expect(g.settledCount).toBe(15);
    expect(g.status).toBe('partial');
  });

  it('the open groups are the recent trip + 2025 Q3/Q4', () => {
    const open = summary.groups.filter(g => g.status === 'open').map(g => g.key).sort();
    expect(open).toEqual(['quarter:2025-Q3', 'quarter:2025-Q4', 'trip:trip2025May31-Jun2'].sort());
  });

  it('group nets sum to total accrued; reconciles to the headline net', () => {
    // total accrued = net + clearingPool = 286155 + 9067400
    const totalAccrued = summary.groups.reduce((s, g) => s + g.net, 0);
    expect(totalAccrued).toBe(9353555);
    expect(summary.openTailTotal + summary.residual).toBe(summary.net);
    expect(summary.net).toBe(286155);
  });
});
```

- [ ] **Step 2: Run, verify pass**

Run: `npm test -- integration.test.js`
Expected: PASS. On any mismatch use superpowers:systematic-debugging; do not retrofit oracle numbers.

- [ ] **Step 3: Commit**

```bash
git add test/integration.test.js
git commit -m "test(groups): fixture oracle for grouped reconciliation"
```

### Layer 2 gate

- [ ] `npm run check` green; `npm test -- --coverage` thresholds met.
- [ ] superpowers:requesting-code-review on the Layer-2 diff; address findings.
- [ ] superpowers:verification-before-completion before declaring Layer 2 done.

---

# LAYER 3 — Grouped view

Replace the Owes/Owed presentation with the grouped view. Depends on Layer 2. Verified manually (`npm start` + `window.ynabDebug`), NOT by Jest/Playwright.

### Task 9: `FundedGroups.vue` component

**Files:**
- Create: `src/components/FundedGroups.vue`

- [ ] **Step 1: Create the component** (presentation only; all numbers come from `summarizeGroups`). Reuse `currencyUtils.formatCurrency` and `computeSettlement` for the headline direction.

```vue
<template>
  <div class="card shadow-sm">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h3 class="mb-0"><i class="fas fa-layer-group me-2"></i>Funded Groups</h3>
      <span class="badge" :class="net >= 0 ? 'bg-info' : 'bg-success'">
        {{ headline }}
      </span>
    </div>
    <div class="card-body">
      <!-- Open & partial groups: prominent -->
      <div v-for="g in openGroups" :key="g.key" class="d-flex justify-content-between align-items-center border-bottom py-2">
        <div>
          <strong>{{ g.label }}</strong>
          <span class="text-muted small ms-2">{{ g.startDate }} → {{ g.endDate }}</span>
        </div>
        <div class="text-end">
          <span class="me-3">{{ formatCurrency(Math.abs(g.net)) }}</span>
          <span class="badge" :class="g.status === 'open' ? 'bg-warning text-dark' : 'bg-primary'">
            {{ g.status === 'open' ? 'open' : `${g.settledCount} of ${g.count} settled` }}
          </span>
        </div>
      </div>

      <!-- Reconciliation: open tail + residual = net -->
      <div class="d-flex justify-content-between small text-muted mt-3">
        <span>Open &amp; partial total</span><span>{{ formatCurrency(openTailTotal) }}</span>
      </div>
      <div class="d-flex justify-content-between small text-muted">
        <span>Earlier settle-up residual</span><span>{{ formatCurrency(residual) }}</span>
      </div>
      <div class="d-flex justify-content-between fw-bold border-top pt-2 mt-1">
        <span>Net owed</span><span>{{ formatCurrency(net) }}</span>
      </div>

      <!-- Settled groups: collapsed / greyed -->
      <div v-if="settledGroups.length" class="mt-3">
        <button class="btn btn-sm btn-outline-secondary" @click="showSettled = !showSettled">
          {{ showSettled ? 'Hide' : 'Show' }} {{ settledGroups.length }} settled groups
        </button>
        <div v-if="showSettled" class="mt-2">
          <div v-for="g in settledGroups" :key="g.key" class="d-flex justify-content-between text-muted small py-1">
            <span>{{ g.label }} <span class="ms-2">{{ g.startDate }} → {{ g.endDate }}</span></span>
            <span>{{ formatCurrency(Math.abs(g.net)) }} · settled</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { currencyUtils } from '../utils/transactions';
import { summarizeGroups, computeSettlement } from '../utils/designations/index.js';

export default {
  name: 'FundedGroups',
  props: {
    transactions: { type: Array, default: () => [] },
    leftName: { type: String, default: 'Left' },
    rightName: { type: String, default: 'Right' },
  },
  data() {
    return { showSettled: false };
  },
  computed: {
    summary() {
      return summarizeGroups(this.transactions, { leftName: this.leftName, rightName: this.rightName });
    },
    net() { return this.summary.net; },
    openTailTotal() { return this.summary.openTailTotal; },
    residual() { return this.summary.residual; },
    openGroups() {
      return this.summary.groups.filter(g => g.status !== 'settled');
    },
    settledGroups() {
      return this.summary.groups.filter(g => g.status === 'settled');
    },
    headline() {
      const d = computeSettlement(this.transactions, { leftName: this.leftName, rightName: this.rightName }).direction;
      return `${d.from} owes ${d.to} ${this.formatCurrency(d.amount)}`;
    },
  },
  methods: {
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(milliunits);
    },
    Math: undefined, // template Math guard (Vue exposes globals; see below)
  },
};
</script>
```

> NOTE for implementer: Vue 3 templates do not expose `Math` by default. Either (a) add a `methods`/computed helper `abs(n) { return Math.abs(n); }` and use `abs(g.net)` in the template (remove the bogus `Math: undefined` line), or (b) precompute `displayNet` on each group inside a computed. Pick one, keep it clean. Verify `currencyUtils.formatCurrency`'s exact name/signature in `src/utils/transactions.js` before relying on it; adjust if the helper differs.

- [ ] **Step 2: Build sanity** — `npm run build`. Expected: compiles (no template/JS errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/FundedGroups.vue
git commit -m "feat(view): add FundedGroups presentation component"
```

### Task 10: Wire into App.vue + debug accessor

**Files:**
- Modify: `src/App.vue`, `src/utils/debug.js`

- [ ] **Step 1: Register + render** in `src/App.vue`. Import the component, add to `components`, and render it at the **top of the Joint Spending tab** (inside `v-if="activeTab === 'joint' && leftBudgetId && rightBudgetId"`, before the existing `CategorySettings` row):

```vue
<div class="row mb-4">
  <div class="col-12">
    <FundedGroups
      :transactions="transactionsWithDesignations"
      :leftName="personDisplayNames.left"
      :rightName="personDisplayNames.right"
    />
  </div>
</div>
```

Import near the other component imports:

```javascript
import FundedGroups from './components/FundedGroups.vue';
```

and add `FundedGroups` to the `components: { ... }` object.

- [ ] **Step 2: Debug accessor** — in `src/utils/debug.js`, expose the summary so it can be eyeballed in the console. Add a `fundedGroups` function that calls `summarizeGroups` on the currently designated transactions (follow the existing `window.ynabDebug` registration pattern in that file — match how other accessors receive the app/transactions). Example shape:

```javascript
import { summarizeGroups } from './designations/index.js';

// inside the debug object/registration, alongside existing helpers:
fundedGroups(transactions) {
  const s = summarizeGroups(transactions || []);
  console.table(s.groups.map(g => ({
    group: g.label, kind: g.kind, net: g.net / 1000,
    status: g.status, settled: `${g.settledCount}/${g.count}`,
  })));
  console.log('net', s.net / 1000, 'openTail', s.openTailTotal / 1000, 'residual', s.residual / 1000);
  return s;
}
```

> NOTE for implementer: read `src/utils/debug.js` first and match its existing registration style (it attaches to `window.ynabDebug`). Wire `App.vue` to pass `transactionsWithDesignations` into the debug registration the same way other debug data is provided, so `window.ynabDebug.fundedGroups()` works without arguments during manual verification.

- [ ] **Step 3: Build** — `npm run build`. Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add src/App.vue src/utils/debug.js
git commit -m "feat(view): wire FundedGroups into Joint Spending tab + ynabDebug accessor"
```

### Task 11: Manual verification (LEAN — no browser automation)

**Files:** none (verification only).

- [ ] **Step 1: Run the app** — `npm start` (serves localhost:8080). Authorize with YNAB, select both budgets, open the **Joint Spending** tab.

- [ ] **Step 2: Visual check** — confirm the Funded Groups card renders: open/partial groups prominent with windows + status badges; settled groups collapsed behind the toggle; the reconciliation footer shows open-tail total, residual, and net.

- [ ] **Step 3: Reconciliation check (the hard requirement)** — in the browser console run `window.ynabDebug.fundedGroups()`. Confirm:
  - `net` equals the **budget-card "Owes/Owed"** number (the existing `settlementNet`). They MUST agree. If they disagree, STOP and use superpowers:systematic-debugging.
  - `openTail + residual === net`.
  - settled/partial/open statuses match the §9 expectations on real data.

- [ ] **Step 4: Note results** — record what was observed (a short note is enough; no screenshots tooling required).

### Layer 3 gate

- [ ] `npm run check` green (tests unaffected by the component; build compiles).
- [ ] `npm test -- --coverage` thresholds still met (component is outside `collectCoverageFrom`).
- [ ] superpowers:requesting-code-review on the Layer-3 diff; address findings.
- [ ] superpowers:verification-before-completion — include the manual reconciliation result as evidence.

---

# PHASE 2 — Integrate & ready for review

- [ ] Re-run the WHOLE branch: `npm run check` + `npm test -- --coverage`.
- [ ] Manual pass through the grouped view in `npm start`; re-confirm the reconciliation (grouped open-tail/net agrees with the budget-card Owes/Owed). This is the named Phase-2 reconciliation requirement.
- [ ] Use superpowers:finishing-a-development-branch to tee up the hand-back. Do NOT push to main, do NOT merge — surface the branch + per-layer summary for final review.

---

## Self-review notes (author)

- **Spec coverage:** §3 watermark → Tasks 1–4; §3 group aggregation → Tasks 5–8; §5 presentation (collapsed settled, prominent open, residual) → Tasks 9–11; §6 build order honored (engine → grouping → view); §9 decisions 1–4 → encoded as oracle values and the residual-line UI. Deferred §8 warning is explicitly out of scope.
- **Type consistency:** `markSettled`/`settlementWatermark` field names (`contribution`, `settled`, `net`, `clearingPool`, `openTailTotal`, `residual`) are used identically in `groups.js` and the component. Group object keys (`key,kind,label,net,count,settledCount,status,startDate,endDate`) match between `buildGroups`, the oracle test, and `FundedGroups.vue`.
- **Known implementer caveats flagged inline:** the Task 8 placeholder `it(...)` must be replaced with a real assertion; the Task 9 `Math` template guard must be resolved; verify `currencyUtils.formatCurrency` and `debug.js` registration style against the actual source before relying on them.
