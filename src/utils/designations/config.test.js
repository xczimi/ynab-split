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
