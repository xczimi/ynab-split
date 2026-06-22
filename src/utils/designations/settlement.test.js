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

describe('markSettled (strict forward zero-crossing)', () => {
  // contribution: source left, amount -200000, shared => +100000 (right owes left)
  const up = (date) => ({ date, source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false });
  // a settle-up bringing the balance down: source right, transfer-tagged
  const pay = (date, amount) => ({ date, source: 'right', amount, ownerSide: 'shared', hasTransferTag: true });

  it('settles up to the last point the balance returned to zero; the run since is open', () => {
    const txns = [
      up('2024-01-01'),                                                                                  // bal +100000
      pay('2024-01-15', -200000),                                                                        // -100000 -> bal 0 (square)
      { date: '2024-02-01', source: 'left', amount: -100000, ownerSide: 'shared', hasTransferTag: false }, // +50000 -> bal +50000
    ];
    const m = Object.fromEntries(markSettled(txns).map(t => [t.date, t.settled]));
    expect(m['2024-01-01']).toBe(true);   // the balance reached 0 after it
    expect(m['2024-01-15']).toBe(true);   // the settle-up that squared it
    expect(m['2024-02-01']).toBe(false);  // accrued after the last square -> open
  });

  it('nothing is settled when the balance never returns to zero', () => {
    const txns = [up('2024-01-01'), up('2024-02-01')]; // bal +100000, +200000 — never square
    expect(markSettled(txns).every(t => !t.settled)).toBe(true);
  });

  it('passing BELOW zero (over-paid) still settles everything before the crossing', () => {
    const txns = [
      up('2024-01-01'),                                                                                  // +100000
      pay('2024-01-15', -500000),                                                                        // -250000 -> bal -150000 (over-paid)
      { date: '2024-02-01', source: 'left', amount: -400000, ownerSide: 'shared', hasTransferTag: false }, // +200000 -> bal +50000
    ];
    const m = Object.fromEntries(markSettled(txns).map(t => [t.date, t.settled]));
    expect(m['2024-01-01']).toBe(true);
    expect(m['2024-01-15']).toBe(true);
    expect(m['2024-02-01']).toBe(false);
  });

  it('settles through the LAST zero-crossing when the balance oscillates', () => {
    const txns = [
      up('2024-01-01'),             // bal +100000
      pay('2024-01-10', -200000),   // bal 0   (cross #1)
      up('2024-02-01'),             // bal +100000
      pay('2024-02-10', -200000),   // bal 0   (cross #2 — the last square)
      up('2024-03-01'),             // bal +100000 (net)
    ];
    const m = Object.fromEntries(markSettled(txns).map(t => [t.date, t.settled]));
    expect(m['2024-01-01']).toBe(true);   // before the last square
    expect(m['2024-02-10']).toBe(true);   // the last square
    expect(m['2024-03-01']).toBe(false);  // open since
  });

  it('direction-aware: mirrors when the net is negative (left owes right)', () => {
    const down = (date) => ({ date, source: 'right', amount: -200000, ownerSide: 'shared', hasTransferTag: false }); // -100000
    const txns = [
      down('2024-01-01'),                                                                                // -100000
      { date: '2024-01-15', source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: true }, // +100000 -> bal 0
      down('2024-02-01'),                                                                                // -100000 (net -100000)
    ];
    const m = Object.fromEntries(markSettled(txns).map(t => [t.date, t.settled]));
    expect(m['2024-01-01']).toBe(true);
    expect(m['2024-02-01']).toBe(false);
  });

  it('empty -> empty; zero net -> all settled', () => {
    expect(markSettled([])).toEqual([]);
    const offsetting = [
      { date: '2024-01-01', source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false },  // +100000
      { date: '2024-02-01', source: 'right', amount: -200000, ownerSide: 'shared', hasTransferTag: false }, // -100000 -> bal 0
    ];
    expect(markSettled(offsetting).every(t => t.settled)).toBe(true);
  });

  it('preserves input order and adds contribution', () => {
    const txns = [up('2024-03-01'), up('2024-01-01')];
    const marked = markSettled(txns);
    expect(marked.map(t => t.date)).toEqual(['2024-03-01', '2024-01-01']);
    expect(marked[0].contribution).toBe(100000);
  });

  it('forward result equals the independent backward validation walk', () => {
    // The real engine works forward from day 0; walking BACKWARD from today's balance
    // (peeling newest transactions until the running total returns to <= 0) must land on
    // the identical open set.
    const txns = [up('2024-01-01'), pay('2024-01-15', -200000), up('2024-02-01'), up('2024-03-01')];
    const fwdOpen = new Set(markSettled(txns).map((m, i) => (m.settled ? null : txns[i])).filter(Boolean));

    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
    const c = sorted.map(transactionContribution);
    const B = [0];
    for (let i = 0; i < c.length; i++) B.push(B[i] + c[i]);
    const s = Math.sign(B[B.length - 1]) || 1;
    const bwdOpen = new Set();
    for (let p = sorted.length; p >= 1; p--) {
      if (s * B[p] <= 0) break;
      bwdOpen.add(sorted[p - 1]);
    }
    expect(fwdOpen.size).toBe(bwdOpen.size);
    expect([...fwdOpen].every(t => bwdOpen.has(t))).toBe(true);
  });
});

describe('settlementWatermark', () => {
  const up = (date) => ({ date, source: 'left', amount: -200000, ownerSide: 'shared', hasTransferTag: false });
  const pay = (date, amount) => ({ date, source: 'right', amount, ownerSide: 'shared', hasTransferTag: true });

  it('returns the marked transactions, the authoritative net, and the total settled', () => {
    const txns = [up('2024-01-01'), pay('2024-01-15', -200000), up('2024-02-01')];
    const w = settlementWatermark(txns);
    expect(w.net).toBe(computeSettlement(txns).net); // authoritative headline
    expect(w.net).toBe(100000);                      // +100000 - 100000 + 100000
    expect(w.clearingPool).toBe(100000);             // one 100000 settle-up
    expect(w.transactions).toHaveLength(3);
    expect(w.transactions.every(t => 'settled' in t)).toBe(true);
  });
});
