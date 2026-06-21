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
