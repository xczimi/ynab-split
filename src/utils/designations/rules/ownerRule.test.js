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
