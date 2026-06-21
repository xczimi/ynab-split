import { detect } from './householdRule.js';
import { defaultConfig } from '../config.js';

const tx = (over = {}) => ({
  category_id: null,
  category_name: 'Misc',
  category_group_name: 'Stuff',
  memo: '',
  ...over,
});

describe('householdRule respects config.householdCategoryIds', () => {
  it('matches when the transaction category_id is in config.householdCategoryIds', () => {
    const config = { ...defaultConfig, householdCategoryIds: ['cat-x'] };
    const r = detect(tx({ category_id: 'cat-x', category_name: 'Whatever' }), config);
    expect(r.matches).toBe(true);
  });

  it('does not match a category_id absent from the list (and no pattern match)', () => {
    const config = { ...defaultConfig, householdCategoryIds: ['cat-x'] };
    const r = detect(tx({ category_id: 'cat-y', category_name: 'Groceries', category_group_name: 'Food' }), config);
    expect(r.matches).toBe(false);
  });

  it('an explicit empty list disables id-matching but pattern matching still works', () => {
    const config = { ...defaultConfig, householdCategoryIds: [] };
    expect(detect(tx({ category_id: 'cat-x', category_name: 'Random' }), config).matches).toBe(false);
    expect(detect(tx({ category_name: 'Electric Bill' }), config).matches).toBe(true); // 'bill' pattern
  });
});
