# Per-Person Expense Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark expenses as Peter-only / Carey-only (vs. shared) so the settlement ("who owes whom") charges 100% to the owner instead of always splitting 50/50.

**Architecture:** Add an `ownerRule` to the designation pipeline that resolves each transaction's `ownerSide ∈ {left,right,shared}` by precedence (memo hashtag → category→owner map → default shared). Extract the settlement math out of `BalanceTimeline.vue` into a pure, tested `settlement.js` whose per-transaction contribution depends on (owner, payer). Assignment is by category (a generalized settings panel) plus read-only `#person` memo hashtags; person names are per-budget and configurable.

**Tech Stack:** Vue 3 (Options API), Jest 30 (ESM, `node --experimental-vm-modules`), webpack 5, Luxon, Chart.js. Tests are utility-level only (no component tests); Vue components are verified via `npm run build` + manual check.

**Spec:** `docs/superpowers/specs/2026-06-21-per-person-expense-ownership-design.md`

**Conventions used throughout:**
- Settlement net sign: **positive = right-person owes left-person**.
- `ownerSide` values: `'left'`, `'right'`, `'shared'`.
- Run a single test file: `npm test -- <path>` (the `npm test` script already includes `--experimental-vm-modules`).
- Immutability: never mutate inputs; always spread into new objects (repo rule).

---

## Task 1: Config — person-name slug + ownership persistence

**Files:**
- Modify: `src/utils/designations/config.js` (append after line 111)
- Test: `src/utils/designations/config.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `src/utils/designations/config.test.js`:

```javascript
import {
  slugifyPersonName,
  loadPersonNames,
  savePersonNames,
  loadCategoryOwners,
  saveCategoryOwners,
} from './config.js';

// Minimal localStorage mock for the node test env
beforeEach(() => {
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

describe('slugifyPersonName', () => {
  it('lowercases and strips non-alphanumerics', () => {
    expect(slugifyPersonName('Peter')).toBe('peter');
    expect(slugifyPersonName('Anna Lee')).toBe('annalee');
    expect(slugifyPersonName("O'Brien-7")).toBe('obrien7');
    expect(slugifyPersonName('')).toBe('');
    expect(slugifyPersonName(undefined)).toBe('');
  });
});

describe('person names persistence', () => {
  it('returns empty names by default', () => {
    expect(loadPersonNames()).toEqual({ left: { name: '' }, right: { name: '' } });
  });
  it('round-trips saved names', () => {
    savePersonNames({ left: { name: 'Peter' }, right: { name: 'Carey' } });
    expect(loadPersonNames()).toEqual({ left: { name: 'Peter' }, right: { name: 'Carey' } });
  });
});

describe('category owners persistence', () => {
  it('returns empty map by default', () => {
    expect(loadCategoryOwners()).toEqual({});
  });
  it('round-trips saved map', () => {
    saveCategoryOwners({ 'cat-1': 'left', 'cat-2': 'right' });
    expect(loadCategoryOwners()).toEqual({ 'cat-1': 'left', 'cat-2': 'right' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/designations/config.test.js`
Expected: FAIL — `slugifyPersonName is not a function` (exports don't exist yet).

- [ ] **Step 3: Write minimal implementation**

Append to `src/utils/designations/config.js`:

```javascript

const PERSON_NAMES_KEY = 'person_names';
const CATEGORY_OWNERS_KEY = 'category_owners';

/**
 * Derive a hashtag slug from a person name: lowercase, alphanumerics only.
 * @param {string} name
 * @returns {string} e.g. "Anna Lee" -> "annalee"
 */
export function slugifyPersonName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Load per-side person names from localStorage.
 * @returns {{left:{name:string}, right:{name:string}}}
 */
export function loadPersonNames() {
  try {
    const saved = localStorage.getItem(PERSON_NAMES_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      left: { name: parsed?.left?.name || '' },
      right: { name: parsed?.right?.name || '' },
    };
  } catch (e) {
    console.warn('Failed to load person names:', e);
    return { left: { name: '' }, right: { name: '' } };
  }
}

/**
 * Save per-side person names to localStorage.
 * @param {{left:{name:string}, right:{name:string}}} personNames
 */
export function savePersonNames(personNames) {
  try {
    localStorage.setItem(PERSON_NAMES_KEY, JSON.stringify({
      left: { name: personNames?.left?.name || '' },
      right: { name: personNames?.right?.name || '' },
    }));
  } catch (e) {
    console.warn('Failed to save person names:', e);
  }
}

/**
 * Load category->owner map ({ [categoryId]: 'left' | 'right' }) from localStorage.
 * Shared categories are absent from the map.
 * @returns {Object<string,string>}
 */
export function loadCategoryOwners() {
  try {
    const saved = localStorage.getItem(CATEGORY_OWNERS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.warn('Failed to load category owners:', e);
    return {};
  }
}

/**
 * Save category->owner map to localStorage.
 * @param {Object<string,string>} map
 */
export function saveCategoryOwners(map) {
  try {
    localStorage.setItem(CATEGORY_OWNERS_KEY, JSON.stringify(map || {}));
  } catch (e) {
    console.warn('Failed to save category owners:', e);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/designations/config.test.js`
Expected: PASS (8 assertions across 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/designations/config.js src/utils/designations/config.test.js
git commit -m "feat: add person-name slug + ownership persistence to config"
```

---

## Task 2: ownerRule — resolve ownerSide

**Files:**
- Create: `src/utils/designations/rules/ownerRule.js`
- Test: `src/utils/designations/rules/ownerRule.test.js`

Resolution precedence: explicit `#shared` → explicit `#<leftSlug>`/`#<rightSlug>` → `categoryOwners[category_id]` → `'shared'`. Conflicting person tags resolve to `shared`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/designations/rules/ownerRule.test.js`:

```javascript
import { detectOwner } from './ownerRule.js';

const ownership = {
  personNames: { left: { name: 'Peter' }, right: { name: 'Carey' } },
  categoryOwners: { 'strata-cat': 'left' },
};

const tx = (over = {}) => ({ memo: '', category_id: null, source: 'left', amount: -1000, ...over });

describe('detectOwner precedence', () => {
  it('defaults to shared', () => {
    expect(detectOwner(tx(), ownership).ownerSide).toBe('shared');
  });

  it('uses category->owner map', () => {
    expect(detectOwner(tx({ category_id: 'strata-cat' }), ownership).ownerSide).toBe('left');
  });

  it('explicit person hashtag beats category map', () => {
    const t = tx({ category_id: 'strata-cat', memo: 'rent #carey' });
    expect(detectOwner(t, ownership).ownerSide).toBe('right');
  });

  it('#shared forces shared over category map', () => {
    const t = tx({ category_id: 'strata-cat', memo: 'rent #shared' });
    expect(detectOwner(t, ownership).ownerSide).toBe('shared');
  });

  it('conflicting person tags fall back to shared', () => {
    const t = tx({ memo: 'split #peter #carey' });
    expect(detectOwner(t, ownership).ownerSide).toBe('shared');
  });

  it('is case-insensitive on hashtags', () => {
    expect(detectOwner(tx({ memo: 'x #Peter' }), ownership).ownerSide).toBe('left');
  });

  it('ignores person hashtags when names are unset', () => {
    const noNames = { personNames: { left: { name: '' }, right: { name: '' } }, categoryOwners: {} };
    expect(detectOwner(tx({ memo: 'x #peter' }), noNames).ownerSide).toBe('shared');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/designations/rules/ownerRule.test.js`
Expected: FAIL — `Cannot find module './ownerRule.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/designations/rules/ownerRule.js`:

```javascript
/**
 * Ownership rule: resolves who is responsible for a transaction.
 * Precedence: explicit #shared > explicit #<person> > category->owner map > shared.
 */

import { extractAllHashtags } from '../extractors/hashtags.js';
import { slugifyPersonName } from '../config.js';

/**
 * @param {Object} transaction
 * @param {Object} ownership
 * @param {{left:{name:string}, right:{name:string}}} ownership.personNames
 * @param {Object<string,string>} ownership.categoryOwners  categoryId -> 'left'|'right'
 * @returns {{ownerSide:'left'|'right'|'shared', reason:string}}
 */
export function detectOwner(transaction, ownership = {}) {
  const personNames = ownership.personNames || { left: { name: '' }, right: { name: '' } };
  const categoryOwners = ownership.categoryOwners || {};

  const leftSlug = slugifyPersonName(personNames.left?.name);
  const rightSlug = slugifyPersonName(personNames.right?.name);

  const tags = extractAllHashtags(transaction).map(t => t.toLowerCase());

  // 1. Explicit #shared wins outright.
  if (tags.includes('shared')) {
    return { ownerSide: 'shared', reason: 'explicit #shared' };
  }

  // 2. Explicit person hashtags (only when a non-empty, unambiguous slug exists).
  const hasLeft = !!leftSlug && tags.includes(leftSlug);
  const hasRight = !!rightSlug && rightSlug !== leftSlug && tags.includes(rightSlug);
  if (hasLeft && hasRight) {
    console.debug('ownerRule: conflicting owner tags, defaulting to shared', transaction.id);
    return { ownerSide: 'shared', reason: 'conflicting owner tags' };
  }
  if (hasLeft) return { ownerSide: 'left', reason: `#${leftSlug}` };
  if (hasRight) return { ownerSide: 'right', reason: `#${rightSlug}` };

  // 3. Category -> owner map.
  const catOwner = categoryOwners[transaction.category_id];
  if (catOwner === 'left' || catOwner === 'right') {
    return { ownerSide: catOwner, reason: 'category owner' };
  }

  // 4. Default.
  return { ownerSide: 'shared', reason: 'default' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/designations/rules/ownerRule.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/designations/rules/ownerRule.js src/utils/designations/rules/ownerRule.test.js
git commit -m "feat: add ownerRule to resolve per-transaction ownership"
```

---

## Task 3: settlement — pure who-owes-whom math

**Files:**
- Create: `src/utils/designations/settlement.js`
- Test: `src/utils/designations/settlement.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/designations/settlement.test.js`:

```javascript
import { shareOfNonPayer, transactionContribution, computeSettlement } from './settlement.js';

const tx = (over = {}) => ({ date: '2024-01-01', source: 'left', amount: -400000, ownerSide: 'shared', ...over });

describe('shareOfNonPayer', () => {
  it('shared -> 0.5', () => expect(shareOfNonPayer('shared', 'left')).toBe(0.5));
  it('owner is payer -> 0', () => expect(shareOfNonPayer('left', 'left')).toBe(0));
  it('owner is other side -> 1', () => expect(shareOfNonPayer('left', 'right')).toBe(1));
});

describe('owner x payer matrix ($400 = 400000 milliunits)', () => {
  // positive net = right owes left
  it('shared, paid by left -> right owes 200', () => {
    expect(transactionContribution(tx({ ownerSide: 'shared', source: 'left' }))).toBe(200000);
  });
  it('shared, paid by right -> left owes 200 (negative)', () => {
    expect(transactionContribution(tx({ ownerSide: 'shared', source: 'right' }))).toBe(-200000);
  });
  it('owner left, paid by left -> 0', () => {
    expect(transactionContribution(tx({ ownerSide: 'left', source: 'left' }))).toBe(0);
  });
  it('owner left, paid by right -> left owes 400 (negative)', () => {
    expect(transactionContribution(tx({ ownerSide: 'left', source: 'right' }))).toBe(-400000);
  });
  it('owner right, paid by left -> right owes 400', () => {
    expect(transactionContribution(tx({ ownerSide: 'right', source: 'left' }))).toBe(400000);
  });
  it('owner right, paid by right -> 0', () => {
    expect(transactionContribution(tx({ ownerSide: 'right', source: 'right' }))).toBe(0);
  });
});

describe('computeSettlement', () => {
  it('legacy-equivalent in magnitude when all shared', () => {
    const txns = [
      tx({ source: 'left', amount: -100000, ownerSide: 'shared' }),
      tx({ source: 'right', amount: -40000, ownerSide: 'shared' }),
      tx({ source: 'left', amount: 25000, ownerSide: 'shared' }), // a refund/income
    ];
    const legacy = txns.reduce((r, t) => r + (t.source === 'left' ? t.amount : -t.amount), 0) / 2;
    const { net } = computeSettlement(txns);
    expect(Math.abs(net)).toBe(Math.abs(legacy));
  });

  it('reports direction with names (positive net = right owes left)', () => {
    const { net, direction } = computeSettlement(
      [tx({ source: 'left', amount: -400000, ownerSide: 'shared' })],
      { leftName: 'Peter', rightName: 'Carey' }
    );
    expect(net).toBe(200000);
    expect(direction).toEqual({ from: 'Carey', to: 'Peter', amount: 200000 });
  });

  it('sorts series oldest-first and returns running balance', () => {
    const { series } = computeSettlement([
      tx({ date: '2024-02-01', source: 'left', amount: -100000 }),
      tx({ date: '2024-01-01', source: 'left', amount: -100000 }),
    ]);
    expect(series.map(p => p.date)).toEqual(['2024-01-01', '2024-02-01']);
    expect(series[1].balance).toBe(100000); // 50000 + 50000
  });

  it('empty input -> zero net', () => {
    expect(computeSettlement([]).net).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/designations/settlement.test.js`
Expected: FAIL — `Cannot find module './settlement.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/designations/settlement.js`:

```javascript
/**
 * Pure settlement ("who owes whom") math.
 * Convention: a positive balance means the RIGHT person owes the LEFT person.
 */

/**
 * Fraction of a cost the non-payer owes the payer.
 * @param {'left'|'right'|'shared'} ownerSide
 * @param {'left'|'right'} source  who paid (whose budget the txn is in)
 * @returns {number} 0.5 | 0 | 1
 */
export function shareOfNonPayer(ownerSide, source) {
  if (ownerSide === 'shared') return 0.5;
  if (ownerSide === source) return 0;
  return 1;
}

/**
 * Signed milliunits a single transaction adds to the net (right-owes-left) balance.
 * @param {Object} transaction  requires .source, .amount, .ownerSide
 * @returns {number}
 */
export function transactionContribution(transaction) {
  const source = transaction.source;
  const amount = transaction.amount || 0;
  const ownerSide = transaction.ownerSide || 'shared';
  const sign = source === 'left' ? 1 : -1;
  return sign * (-amount) * shareOfNonPayer(ownerSide, source);
}

/**
 * Compute the settlement net, direction, and running series.
 * @param {Array} transactions  each requires .date, .source, .amount, .ownerSide
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {{net:number, direction:{from:string,to:string,amount:number}, series:Array<{date:string,balance:number}>}}
 */
export function computeSettlement(transactions = [], options = {}) {
  const leftName = options.leftName || 'Left';
  const rightName = options.rightName || 'Right';

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const series = sorted.map(t => {
    running += transactionContribution(t);
    return { date: t.date, balance: running };
  });

  const net = series.length ? series[series.length - 1].balance : 0;
  const direction = net >= 0
    ? { from: rightName, to: leftName, amount: net }
    : { from: leftName, to: rightName, amount: -net };

  return { net, direction, series };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/designations/settlement.test.js`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/utils/designations/settlement.js src/utils/designations/settlement.test.js
git commit -m "feat: add pure settlement math module (owner x payer)"
```

---

## Task 4: processor — attach ownerSide during enrichment

**Files:**
- Modify: `src/utils/designations/processor.js:60-94`
- Test: `src/utils/designations/processor.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `src/utils/designations/processor.test.js`:

```javascript
import { addHashtagsToTransactions } from './processor.js';

const ownership = {
  personNames: { left: { name: 'Peter' }, right: { name: 'Carey' } },
  categoryOwners: { 'strata-cat': 'left' },
};

const base = { date: '2024-01-01', source: 'left', amount: -1000, category_name: 'Misc' };

it('attaches ownerSide from category map', () => {
  const [t] = addHashtagsToTransactions(
    [{ ...base, id: '1', category_id: 'strata-cat', memo: '' }],
    { ownership }
  );
  expect(t.ownerSide).toBe('left');
});

it('attaches ownerSide from memo hashtag', () => {
  const [t] = addHashtagsToTransactions(
    [{ ...base, id: '2', category_id: null, memo: 'dinner #carey' }],
    { ownership }
  );
  expect(t.ownerSide).toBe('right');
});

it('transfers are exempt (ownerSide stays shared even if a person tag present)', () => {
  const [t] = addHashtagsToTransactions(
    [{ ...base, id: '3', category_id: null, memo: 'settle #transfer #peter' }],
    { ownership }
  );
  expect(t.hasTransferTag).toBe(true);
  expect(t.ownerSide).toBe('shared');
});

it('defaults to shared with no ownership config', () => {
  const [t] = addHashtagsToTransactions([{ ...base, id: '4', category_id: null, memo: '' }]);
  expect(t.ownerSide).toBe('shared');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/designations/processor.test.js`
Expected: FAIL — `expect(received).toBe('left')` but `received` is `undefined` (ownerSide not attached yet).

- [ ] **Step 3: Write minimal implementation**

In `src/utils/designations/processor.js`, add imports near the top (after line 11):

```javascript
import { detectOwner } from './rules/ownerRule.js';
import { loadPersonNames, loadCategoryOwners } from './config.js';
```

Replace `enrichWithHashtagInfo` (lines 60-72) with:

```javascript
export function enrichWithHashtagInfo(transaction, ownership = { personNames: { left: { name: '' }, right: { name: '' } }, categoryOwners: {} }) {
  const allHashtags = extractAllHashtags(transaction);
  const relevantHashtags = filterRelevantHashtags(allHashtags);
  const hasTransferTag = relevantHashtags.some(tag => tag.toLowerCase() === 'transfer');

  // Transfers are settle-ups, not ownable expenses.
  const owner = hasTransferTag
    ? { ownerSide: 'shared', reason: 'transfer-exempt' }
    : detectOwner(transaction, ownership);

  return {
    ...transaction,
    hashtags: allHashtags,
    relevantHashtags,
    hasTripTag: relevantHashtags.some(tag => tag.toLowerCase().startsWith('trip')),
    hasHouseholdTag: relevantHashtags.some(tag => tag.toLowerCase() === 'household'),
    hasTransferTag,
    ownerSide: owner.ownerSide,
    ownerReason: owner.reason,
  };
}
```

Replace `addHashtagsToTransactions` body (lines 81-94) with:

```javascript
export function addHashtagsToTransactions(transactions, userConfig = {}) {
  const config = mergeConfig(userConfig);

  // Load custom designation rules from localStorage
  const customRules = loadCustomDesignations();

  // Ownership config: explicit override (tests/App) or load from localStorage.
  const ownership = userConfig.ownership || {
    personNames: loadPersonNames(),
    categoryOwners: loadCategoryOwners(),
  };

  return transactions.map(transaction => {
    // First apply automatic tags (including custom rules)
    const withAutoTags = addAutomaticTags(transaction, transactions, config, customRules);

    // Then extract and add hashtag + ownership info
    return enrichWithHashtagInfo(withAutoTags, ownership);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/designations/processor.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS — existing 56 tests + the new tests all green. (Existing integration tests call `addHashtagsToTransactions` without ownership, so `ownerSide` is `'shared'` everywhere — no behavior change.)

- [ ] **Step 6: Commit**

```bash
git add src/utils/designations/processor.js src/utils/designations/processor.test.js
git commit -m "feat: attach ownerSide in designation pipeline (transfers exempt)"
```

---

## Task 5: Barrel exports

**Files:**
- Modify: `src/utils/designations/index.js`

- [ ] **Step 1: Add exports**

Add these lines to `src/utils/designations/index.js` (grouped with the other rule/util exports; match the existing export style in that file):

```javascript
export { detectOwner } from './rules/ownerRule.js';
export { shareOfNonPayer, transactionContribution, computeSettlement } from './settlement.js';
export {
  slugifyPersonName,
  loadPersonNames,
  savePersonNames,
  loadCategoryOwners,
  saveCategoryOwners,
} from './config.js';
```

- [ ] **Step 2: Verify build + tests**

Run: `npm run check`
Expected: tests PASS and build succeeds (`dist/build.js` written).

- [ ] **Step 3: Commit**

```bash
git add src/utils/designations/index.js
git commit -m "feat: export ownership + settlement from designations barrel"
```

---

## Task 6: BalanceTimeline — use settlement module + named direction

**Files:**
- Modify: `src/components/BalanceTimeline.vue`

- [ ] **Step 1: Import the settlement module**

After line 31 (`import annotationPlugin ...`) add:

```javascript
import { computeSettlement } from '../utils/designations/settlement.js';
```

- [ ] **Step 2: Replace `chartData` + `currentBalance` computeds with settlement-based ones**

Replace lines 83-100 (the `chartData()` and `currentBalance()` computed properties) with:

```javascript
    settlement() {
      return computeSettlement(this.transactions, {
        leftName: this.leftBudgetName,
        rightName: this.rightBudgetName,
      });
    },
    currentBalance() {
      return this.settlement.net;
    },
    settlementLabel() {
      const d = this.settlement.direction;
      if (!d.amount) return 'Settled up';
      return `${d.from} owes ${d.to} ${this.formatCurrency(d.amount)}`;
    },
```

- [ ] **Step 3: Use the settlement series in the chart**

In `renderChart`, replace line 161 (`const data = this.chartData;`) with:

```javascript
      const data = this.settlement.series;
```

(`series` items are `{ date, balance }` in milliunits — same shape `renderChart` already expects.)

- [ ] **Step 4: Show the named settlement in the header badge**

Replace the badge (lines 6-8) with:

```html
        <span class="badge bg-info me-3" title="Current settlement">
          {{ settlementLabel }}
        </span>
```

- [ ] **Step 5: Build and manually verify**

Run: `npm run build`
Expected: build succeeds.

Manual check (dev server, both budgets loaded, Joint Spending tab): the Balance Timeline header reads e.g. *"Carey owes Peter $X.XX"* (or "Settled up" at zero), and the line chart still renders. Assign an owner to a category (Task 8) and confirm the figure changes.

- [ ] **Step 6: Commit**

```bash
git add src/components/BalanceTimeline.vue
git commit -m "feat: BalanceTimeline uses pure settlement module with named direction"
```

---

## Task 7: Budget.vue — per-side person name field

**Files:**
- Modify: `src/components/Budget.vue`

- [ ] **Step 1: Import config helpers**

In the `<script>` block, after the existing import from `'../utils/transactions'` (line 87), add:

```javascript
import { loadPersonNames, savePersonNames } from '../utils/designations/config.js';
```

- [ ] **Step 2: Add reactive state**

In `data()` return (after `error: null,` at line 122) add:

```javascript
      personName: '',
```

- [ ] **Step 3: Load the saved name on mount**

Replace `mounted()` (lines 134-137) with:

```javascript
  mounted() {
    // Load saved color on component mount
    this.loadSavedColor();
    this.personName = loadPersonNames()[this.budgetType]?.name || '';
  },
```

- [ ] **Step 4: Add the input to the selected-budget view**

In the `v-else` (budget selected) block, insert after the closing `</div>` of the Balance row (after line 60, before the "Change Budget" row at line 62):

```html
        <div class="mb-3">
          <label class="form-label small text-light-emphasis mb-1">Person name</label>
          <input
            type="text"
            class="form-control form-control-sm"
            v-model="personName"
            @change="onPersonNameChanged"
            :placeholder="selectedBudget(budgetId, budgets)?.name"
          />
        </div>
```

- [ ] **Step 5: Add the change handler method**

In `methods`, after `loadSavedColor()` (after line 273) add:

```javascript
,
    onPersonNameChanged() {
      const all = loadPersonNames();
      const updated = { ...all, [this.budgetType]: { name: this.personName } };
      savePersonNames(updated);
      this.$emit('person-name-changed', { budgetType: this.budgetType, name: this.personName });
    }
```

- [ ] **Step 6: Build and manually verify**

Run: `npm run build`
Expected: build succeeds. Manual: each selected budget card shows a "Person name" field defaulting (placeholder) to the budget name; typing a name and blurring persists it (survives reload).

- [ ] **Step 7: Commit**

```bash
git add src/components/Budget.vue
git commit -m "feat: add per-budget person name field"
```

---

## Task 8: CategorySettings — rename + per-category owner selector

**Files:**
- Rename: `src/components/HouseholdCategorySettings.vue` → `src/components/CategorySettings.vue`
- Modify: the renamed file
- Modify: `src/App.vue` (import + tag name — done fully in Task 10)

- [ ] **Step 1: Rename the file (preserve history)**

```bash
git mv src/components/HouseholdCategorySettings.vue src/components/CategorySettings.vue
```

- [ ] **Step 2: Update the component name + add props/imports**

In `src/components/CategorySettings.vue`:

Change `name: 'HouseholdCategorySettings'` to:

```javascript
  name: 'CategorySettings',
```

Add to the imports (replace the existing import block from `'../utils/designations/config.js'`):

```javascript
import {
  loadHouseholdCategoryIds,
  saveHouseholdCategoryIds,
  loadCategoryOwners,
  saveCategoryOwners,
  defaultConfig
} from '../utils/designations/config.js';
```

Add two props after `rightColor` (in `props`):

```javascript
,
    leftName: { type: String, default: 'Left' },
    rightName: { type: String, default: 'Right' }
```

Add to `data()` return (after `selectedCategoryIds: []`):

```javascript
,
      categoryOwners: {}
```

In `created()`, after `this.selectedCategoryIds = loadHouseholdCategoryIds();` add:

```javascript
    this.categoryOwners = loadCategoryOwners();
```

- [ ] **Step 3: Add the owner selector to each category row**

In the template, replace the category-row `<label>` (lines 38-45) with a row that keeps the household checkbox label and adds an owner dropdown:

```html
          <label class="form-check-label d-flex align-items-center flex-grow-1" :for="'cat-' + category.id">
            <span
              class="budget-indicator me-2"
              :style="{ backgroundColor: category.source === 'left' ? leftColor : rightColor }"
              :title="category.source === 'left' ? 'Left budget' : 'Right budget'"
            ></span>
            {{ category.displayName }}
          </label>
          <select
            class="form-select form-select-sm ms-2"
            style="width: auto;"
            :value="ownerOf(category.id)"
            @change="setOwner(category.id, $event.target.value)"
            title="Who is responsible for this category"
          >
            <option value="shared">Shared</option>
            <option value="left">{{ leftName }}</option>
            <option value="right">{{ rightName }}</option>
          </select>
```

(Change the wrapping `div.form-check` at line 30 to also lay out horizontally — add the class `d-flex align-items-center`:)

```html
        <div v-for="category in usedCategories" :key="category.id" class="form-check d-flex align-items-center">
```

- [ ] **Step 4: Add owner methods**

In `methods`, after `toggleCategory` add:

```javascript
,
    ownerOf(categoryId) {
      return this.categoryOwners[categoryId] || 'shared';
    },
    setOwner(categoryId, value) {
      const next = { ...this.categoryOwners };
      if (value === 'shared') {
        delete next[categoryId];
      } else {
        next[categoryId] = value;
      }
      this.categoryOwners = next;
      saveCategoryOwners(next);
      this.$emit('owners-changed', next);
    }
```

- [ ] **Step 5: Build (full wiring verified in Task 10)**

Run: `npm run build`
Expected: build succeeds. (The component won't render until `App.vue` references the new name — Task 10.)

- [ ] **Step 6: Commit**

```bash
git add src/components/CategorySettings.vue
git commit -m "feat: generalize household settings into CategorySettings with owner selector"
```

---

## Task 9: CombinedTransactions — owner badge + filter

**Files:**
- Modify: `src/components/CombinedTransactions.vue`

The component already maps over `transactions` (each now carries `ownerSide`) and has filter toggles. Add an owner badge column value and an owner filter dropdown.

- [ ] **Step 1: Add owner props + filter state**

In `props`, add (matching the existing prop style):

```javascript
,
    leftName: { type: String, default: 'Left' },
    rightName: { type: String, default: 'Right' }
```

In `data()` return, add:

```javascript
,
      ownerFilter: 'all'
```

- [ ] **Step 2: Add an owner label helper**

In `methods`, add:

```javascript
,
    ownerLabel(ownerSide) {
      if (ownerSide === 'left') return this.leftName;
      if (ownerSide === 'right') return this.rightName;
      return 'Shared';
    }
```

- [ ] **Step 3: Apply the owner filter where the displayed list is computed**

Find the computed property that returns the filtered transaction list (the one the table `v-for`s over — it already applies the transfer/household/trip/undesignated toggles). Add this clause to its filter chain:

```javascript
        .filter(t => this.ownerFilter === 'all' || (t.ownerSide || 'shared') === this.ownerFilter)
```

- [ ] **Step 4: Add the owner filter control to the filter toolbar**

Next to the existing filter toggles in the template, add:

```html
        <select class="form-select form-select-sm w-auto ms-2" v-model="ownerFilter" title="Filter by owner">
          <option value="all">All owners</option>
          <option value="shared">Shared</option>
          <option value="left">{{ leftName }}</option>
          <option value="right">{{ rightName }}</option>
        </select>
```

- [ ] **Step 5: Show an owner badge in each transaction row**

In the transaction row, near the existing designation/memo cells, add a badge:

```html
            <span
              class="badge ms-1"
              :class="{
                'bg-secondary': (transaction.ownerSide || 'shared') === 'shared',
                'bg-primary': transaction.ownerSide === 'left',
                'bg-success': transaction.ownerSide === 'right'
              }"
              :title="'Owner: ' + ownerLabel(transaction.ownerSide || 'shared')"
            >{{ ownerLabel(transaction.ownerSide || 'shared') }}</span>
```

- [ ] **Step 6: Build and manually verify**

Run: `npm run build`
Expected: build succeeds. Manual: each transaction shows an owner badge (Shared/<name>); the owner filter narrows the list.

- [ ] **Step 7: Commit**

```bash
git add src/components/CombinedTransactions.vue
git commit -m "feat: owner badge + owner filter in CombinedTransactions"
```

---

## Task 10: App.vue — wire person names, owners, and re-processing

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Import config helpers**

In the `<script>` imports, add:

```javascript
import { loadPersonNames, loadCategoryOwners } from './utils/designations/config.js';
```

- [ ] **Step 2: Replace the CategorySettings import + registration**

Change the old import `import HouseholdCategorySettings from './components/HouseholdCategorySettings.vue';` to:

```javascript
import CategorySettings from './components/CategorySettings.vue';
```

In the `components: { ... }` registration, replace `HouseholdCategorySettings,` with:

```javascript
    CategorySettings,
```

- [ ] **Step 3: Add reactive ownership state**

In `data()` return, add:

```javascript
      personNames: { left: { name: '' }, right: { name: '' } },
      categoryOwners: {},
```

In `created()` (or `mounted()`, wherever other localStorage prefs are loaded), add:

```javascript
    this.personNames = loadPersonNames();
    this.categoryOwners = loadCategoryOwners();
```

- [ ] **Step 4: Pass ownership into the pipeline (reactive re-processing)**

In the `transactionsWithDesignations` computed, change the processing call (line 361) from:

```javascript
      const transactionsWithHashtags = addHashtagsToTransactions(this.allTransactions);
```

to:

```javascript
      const transactionsWithHashtags = addHashtagsToTransactions(this.allTransactions, {
        ownership: { personNames: this.personNames, categoryOwners: this.categoryOwners },
      });
```

(Because `personNames`/`categoryOwners` are reactive, editing them re-runs this computed automatically — no `$forceUpdate` needed.)

- [ ] **Step 5: Add a computed for display names**

In `computed`, add:

```javascript
    personDisplayNames() {
      return {
        left: this.personNames.left?.name || this.selectedBudget(this.leftBudgetId, this.budgets)?.name || 'Left',
        right: this.personNames.right?.name || this.selectedBudget(this.rightBudgetId, this.budgets)?.name || 'Right',
      };
    },
```

- [ ] **Step 6: Add change handlers**

In `methods`, add:

```javascript
    handlePersonNameChanged({ budgetType, name }) {
      this.personNames = { ...this.personNames, [budgetType]: { name } };
    },
    handleCategoryOwnersChanged(map) {
      this.categoryOwners = { ...map };
    },
```

- [ ] **Step 7: Wire the template props/events**

On each `<Budget ... />` add:

```html
                  @person-name-changed="handlePersonNameChanged"
```

Replace the `<HouseholdCategorySettings ... />` element with:

```html
                <CategorySettings
                  :transactions="transactionsWithDesignations"
                  :leftColor="budgetColorHex.left"
                  :rightColor="budgetColorHex.right"
                  :leftName="personDisplayNames.left"
                  :rightName="personDisplayNames.right"
                  @categories-changed="handleHouseholdCategoriesChanged"
                  @owners-changed="handleCategoryOwnersChanged"
                />
```

On `<BalanceTimeline ... />` change the name props to person names:

```html
                  :leftBudgetName="personDisplayNames.left"
                  :rightBudgetName="personDisplayNames.right"
```

On `<CombinedTransactions ... />` add:

```html
                  :leftName="personDisplayNames.left"
                  :rightName="personDisplayNames.right"
```

- [ ] **Step 8: Build and manually verify end-to-end**

Run: `npm run build`
Expected: build succeeds.

Manual (dev server, both budgets, Joint Spending tab):
1. Set person names on both budget cards.
2. In Category Settings, set a category's owner to one person → Balance Timeline figure updates and that category's transactions show the owner badge.
3. Add `#<name>`/`#shared` to a YNAB memo (or fixture) → overrides the category default.

- [ ] **Step 9: Commit**

```bash
git add src/App.vue
git commit -m "feat: wire person names + category owners through App pipeline"
```

---

## Task 11: debug.js — owner breakdown in getSummary

**Files:**
- Modify: `src/utils/debug.js:142-159`

- [ ] **Step 1: Add owner counts to `getSummary`**

In `getSummary`, before the `return {`, add:

```javascript
  const ownedLeft = transactions.filter(t => t.ownerSide === 'left').length;
  const ownedRight = transactions.filter(t => t.ownerSide === 'right').length;
  const ownedShared = transactions.filter(t => (t.ownerSide || 'shared') === 'shared').length;
```

And add to the returned object:

```javascript
    ownership: { left: ownedLeft, right: ownedRight, shared: ownedShared },
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds. Manual: `ynabDebug.getSummary()` includes an `ownership` breakdown.

- [ ] **Step 3: Commit**

```bash
git add src/utils/debug.js
git commit -m "feat: include ownership breakdown in ynabDebug.getSummary"
```

---

## Task 12: Integration tests + coverage gate

**Files:**
- Modify: `test/integration.test.js`

- [ ] **Step 1: Add the settlement import**

`test/integration.test.js` already imports `addHashtagsToTransactions` from the barrel and already defines the fixture as `const sampleTransactions = ...` (line 47). Only `computeSettlement` is missing. Add it to the **existing** import block from `'../src/utils/designations/index.js'` (do NOT re-import `addHashtagsToTransactions` — that would be a duplicate declaration):

```javascript
import {
  addHashtagsToTransactions,
  processTransactionsWithTrips,
  processTransactions,
  isTransferTransaction,
  computeSettlement,
} from '../src/utils/designations/index.js';
```

- [ ] **Step 2: Add ownership integration tests**

Append to `test/integration.test.js` (drives the real pipeline + settlement against the existing `sampleTransactions` fixture):

```javascript
describe('ownership end-to-end', () => {
  const ownership = {
    personNames: { left: { name: 'Peter' }, right: { name: 'Carey' } },
    categoryOwners: {},
  };

  it('a #peter memo makes a left-paid expense owned by left (no debt)', () => {
    const txns = [
      { id: 'a', date: '2024-03-01', source: 'left', amount: -50000, memo: 'thing #peter', category_id: null },
      { id: 'b', date: '2024-03-02', source: 'left', amount: -50000, memo: 'shared thing', category_id: null },
    ];
    const processed = addHashtagsToTransactions(txns, { ownership });
    expect(processed.find(t => t.id === 'a').ownerSide).toBe('left');

    const { net } = computeSettlement(processed, { leftName: 'Peter', rightName: 'Carey' });
    // Only the shared $50 counts: Carey owes Peter $25 (positive = right owes left).
    expect(net).toBe(25000);
  });

  it('all-shared net is unchanged vs the legacy /2 formula on the fixture', () => {
    const processed = addHashtagsToTransactions(sampleTransactions, { ownership });
    const legacy = processed.reduce((r, t) => r + (t.source === 'left' ? t.amount : -t.amount), 0) / 2;
    const { net } = computeSettlement(processed);
    // No category owners set and (almost) no #person memos in the fixture, so this
    // should match in magnitude. If the fixture contains person hashtags, scope this
    // assertion to transactions whose ownerSide === 'shared'.
    expect(Math.abs(net)).toBe(Math.abs(legacy));
  });
});
```

> If the second test fails because the fixture happens to contain `#peter`/`#carey`
> memos, narrow it: filter `processed` to `t.ownerSide === 'shared'` before computing
> both `legacy` and `net`. Document the chosen scope in a comment.

- [ ] **Step 3: Run the integration tests**

Run: `npm test -- test/integration.test.js`
Expected: PASS.

- [ ] **Step 4: Run the full check with coverage**

Run: `npm test -- --coverage`
Expected: PASS and coverage thresholds met (80% statements/functions/lines, 65% branches). If `config.js` load/save functions drag function-coverage below threshold, confirm Task 1's `config.test.js` exercises them (it does, via the localStorage mock).

- [ ] **Step 5: Final verification**

Run: `npm run check`
Expected: tests PASS and production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add test/integration.test.js
git commit -m "test: ownership end-to-end + legacy-equivalence on fixture"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** §3 resolution → Task 2; §4 math → Task 3; §5 modules → Tasks 2–5; §6 config → Task 1; §7 UI → Tasks 6–10; §8 edge cases → Task 2 tests (conflict, #shared, empty names) + Task 4 (transfer exemption); §9 testing → Tasks 1–4, 12.
- **Naming consistency:** `ownerSide` (not `owner`), `detectOwner`, `computeSettlement`, `shareOfNonPayer`, `transactionContribution`, `loadPersonNames`/`savePersonNames`, `loadCategoryOwners`/`saveCategoryOwners`, `slugifyPersonName`, events `person-name-changed` / `owners-changed` — used identically across tasks.
- **No write-back:** per-transaction ownership is read-only recognition of memo hashtags; there is intentionally no in-app owner editor (spec §2/§8).
- **Backward compatibility:** existing callers/tests of `addHashtagsToTransactions` omit `ownership`, so `ownerSide` defaults to `'shared'` and settlement stays magnitude-identical to today.
```
