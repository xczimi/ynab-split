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
