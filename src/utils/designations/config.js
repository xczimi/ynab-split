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
