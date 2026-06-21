import { shareOfNonPayer, transactionContribution, computeSettlement, isClearing, clearingPool, markSettled, settlementWatermark } from './settlement.js';

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
