import { quarterKey, groupKeyFor, buildGroups } from './groups.js';

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
