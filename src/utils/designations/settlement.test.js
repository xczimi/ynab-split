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
