/**
 * Configuration for designation detection rules
 */

export const defaultConfig = {
  transfer: {
    // Maximum days between matching transactions to be considered a transfer
    maxDaysBetween: 3,
  },

  household: {
    // Category name patterns that indicate household expenses (case-insensitive)
    categoryPatterns: ['bill', 'utilities', 'rent', 'insurance', 'strata', 'hydro', 'internet', 'phone'],
    // Category group name patterns (case-insensitive)
    categoryGroupPatterns: ['bill', 'home', 'housing', 'utilities'],
  },

  trip: {
    // Maximum days between transactions to group into same trip
    maxDaysBetween: 2,
    // Minimum unique dates required for auto-generated trip
    minUniqueDates: 2,
    // Exclude household-tagged transactions from trip processing
    excludeHousehold: true,
    // Exclude transfer-tagged transactions from trip processing
    excludeTransfers: true,
    // Exclude positive (income) transactions from trip processing
    excludePositive: false,
  },

  // Timezone for date calculations
  timezone: 'America/Vancouver',
};

/**
 * Merge user config with defaults
 * @param {Object} userConfig - User-provided configuration overrides
 * @returns {Object} Merged configuration
 */
export function mergeConfig(userConfig = {}) {
  return {
    transfer: { ...defaultConfig.transfer, ...userConfig.transfer },
    household: { ...defaultConfig.household, ...userConfig.household },
    trip: { ...defaultConfig.trip, ...userConfig.trip },
    timezone: userConfig.timezone || defaultConfig.timezone,
  };
}

/**
 * Load custom designation rules from localStorage
 *
 * Rules format:
 * [
 *   {
 *     hashtag: "dining",
 *     patterns: ["restaurant", "food", "eating out"],
 *     matchOn: "category" | "categoryGroup" | "payee"
 *   }
 * ]
 *
 * @returns {Array} Array of custom designation rules
 */
export function loadCustomDesignations() {
  try {
    const saved = localStorage.getItem('custom_designations');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.warn('Failed to load custom designations:', e);
    return [];
  }
}

/**
 * Save custom designation rules to localStorage
 * @param {Array} rules - Array of custom designation rules
 */
export function saveCustomDesignations(rules) {
  try {
    localStorage.setItem('custom_designations', JSON.stringify(rules));
  } catch (e) {
    console.warn('Failed to save custom designations:', e);
  }
}

const HOUSEHOLD_CATEGORIES_KEY = 'household_category_ids';

/**
 * Load household category IDs from localStorage
 * @returns {Array<string>} Array of category IDs selected as household
 */
export function loadHouseholdCategoryIds() {
  try {
    const saved = localStorage.getItem(HOUSEHOLD_CATEGORIES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.warn('Failed to load household categories:', e);
    return [];
  }
}

/**
 * Save household category IDs to localStorage
 * @param {Array<string>} categoryIds - Array of category IDs
 */
export function saveHouseholdCategoryIds(categoryIds) {
  try {
    localStorage.setItem(HOUSEHOLD_CATEGORIES_KEY, JSON.stringify(categoryIds));
  } catch (e) {
    console.warn('Failed to save household categories:', e);
  }
}

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
