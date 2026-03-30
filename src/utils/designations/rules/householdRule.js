/**
 * Household/Bill detection rule
 */

import { defaultConfig, loadHouseholdCategoryIds } from '../config.js';

/**
 * Check if a transaction matches household criteria
 * Checks user-selected category IDs first, then falls back to pattern matching
 * @param {Object} transaction - Transaction to check
 * @param {Object} config - Configuration object
 * @returns {Object} Detection result { matches, reason }
 */
export function detect(transaction, config = defaultConfig) {
  // First check: Category ID-based matching (user selections)
  const householdCategoryIds = loadHouseholdCategoryIds();
  if (transaction.category_id && householdCategoryIds.includes(transaction.category_id)) {
    return {
      matches: true,
      reason: `Category "${transaction.category_name}" is marked as household in settings`,
    };
  }

  // Second check: Pattern-based matching (fallback)
  const category = (transaction.category_name || '').toLowerCase();
  const categoryGroup = (transaction.category_group_name || '').toLowerCase();

  const { categoryPatterns, categoryGroupPatterns } = config.household;

  // Check category name patterns
  for (const pattern of categoryPatterns) {
    if (category.includes(pattern.toLowerCase())) {
      return {
        matches: true,
        reason: `Category "${transaction.category_name}" matches pattern "${pattern}"`,
      };
    }
  }

  // Check category group patterns
  for (const pattern of categoryGroupPatterns) {
    if (categoryGroup.includes(pattern.toLowerCase())) {
      return {
        matches: true,
        reason: `Category group "${transaction.category_group_name}" matches pattern "${pattern}"`,
      };
    }
  }

  return { matches: false, reason: null };
}

/**
 * Check if transaction is a bill/household transaction (legacy compatibility)
 * @param {Object} transaction - Transaction to check
 * @param {Object} config - Configuration object
 * @returns {boolean} True if transaction is a household expense
 */
export function isBillTransaction(transaction, config = defaultConfig) {
  return detect(transaction, config).matches;
}

/**
 * Check if auto-tagging should be applied
 * @param {Object} transaction - Transaction to check
 * @param {Object} config - Configuration object
 * @returns {boolean} True if should add #household tag
 */
export function shouldAutoTag(transaction, config = defaultConfig) {
  // Don't tag if already has #household in memo
  const memo = (transaction.memo || '').toLowerCase();
  if (memo.includes('#household')) {
    return false;
  }

  return detect(transaction, config).matches;
}
