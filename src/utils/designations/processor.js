/**
 * Main designation processor
 * Orchestrates all designation rules in the correct order
 */

import { defaultConfig, mergeConfig, loadCustomDesignations } from './config.js';
import { extractAllHashtags, filterRelevantHashtags, addHashtag, hasHashtag } from './extractors/hashtags.js';
import { shouldAutoTag as shouldAutoTagTransfer, isTransferTransaction } from './rules/transferRule.js';
import { shouldAutoTag as shouldAutoTagHousehold } from './rules/householdRule.js';
import { processTrips } from './rules/tripRule.js';
import { detectCustomCategory } from './rules/categoryRule.js';
import { detectOwner } from './rules/ownerRule.js';
import { loadPersonNames, loadCategoryOwners } from './config.js';

/**
 * Add automatic tags to a single transaction
 * @param {Object} transaction - Transaction to process
 * @param {Array} allTransactions - All transactions (for transfer detection)
 * @param {Object} config - Configuration object
 * @param {Array} customRules - Custom designation rules from localStorage
 * @returns {Object} Transaction with updated memo and auto-tag flags
 */
export function addAutomaticTags(transaction, allTransactions, config = defaultConfig, customRules = []) {
  let newMemo = transaction.memo || '';

  // Check and add household tag (based on category ID or pattern matching)
  const autoTagHousehold = shouldAutoTagHousehold(transaction, config);
  if (autoTagHousehold) {
    newMemo = addHashtag(newMemo, 'household');
  }

  // Check and add transfer tag
  const autoTagTransfer = shouldAutoTagTransfer(transaction, allTransactions, config);
  if (autoTagTransfer) {
    newMemo = addHashtag(newMemo, 'transfer');
  }

  // Apply custom designation rules
  const appliedCustomTags = [];
  for (const rule of customRules) {
    const match = detectCustomCategory(transaction, rule);
    if (match && !hasHashtag(newMemo, match.hashtag)) {
      newMemo = addHashtag(newMemo, match.hashtag);
      appliedCustomTags.push(match.hashtag);
    }
  }

  return {
    ...transaction,
    memo: newMemo,
    autoTaggedAsHousehold: autoTagHousehold,
    autoTaggedAsTransfer: autoTagTransfer,
    autoTaggedCustom: appliedCustomTags,
  };
}

/**
 * Add hashtag information to a single transaction
 * @param {Object} transaction - Transaction with auto-tags applied
 * @param {Object} ownership - Ownership config with personNames and categoryOwners
 * @returns {Object} Transaction with hashtag arrays, boolean flags, and ownerSide
 */
export function enrichWithHashtagInfo(transaction, ownership = { personNames: { left: { name: '' }, right: { name: '' } }, categoryOwners: {} }) {
  const allHashtags = extractAllHashtags(transaction);
  const relevantHashtags = filterRelevantHashtags(allHashtags);
  const hasTransferTag = relevantHashtags.some(tag => tag.toLowerCase() === 'transfer');

  // Transfers are settle-ups, not ownable expenses.
  const owner = hasTransferTag
    ? { ownerSide: 'shared', reason: 'transfer-exempt' }
    : detectOwner(transaction, ownership);

  return {
    ...transaction,
    hashtags: allHashtags,
    relevantHashtags,
    hasTripTag: relevantHashtags.some(tag => tag.toLowerCase().startsWith('trip')),
    hasHouseholdTag: relevantHashtags.some(tag => tag.toLowerCase() === 'household'),
    hasTransferTag,
    ownerSide: owner.ownerSide,
    ownerReason: owner.reason,
  };
}

/**
 * Process all transactions with automatic tagging and hashtag extraction
 * This is the main entry point matching the old addHashtagsToTransactions signature
 * @param {Array} transactions - Array of transactions to process
 * @param {Object} userConfig - Optional configuration overrides (may include userConfig.ownership)
 * @returns {Array} Transactions with hashtag info, auto-tags, and ownerSide
 */
export function addHashtagsToTransactions(transactions, userConfig = {}) {
  const config = mergeConfig(userConfig);

  // Load custom designation rules from localStorage
  const customRules = loadCustomDesignations();

  // Ownership config: explicit override (tests/App) or load from localStorage.
  const ownership = userConfig.ownership || {
    personNames: loadPersonNames(),
    categoryOwners: loadCategoryOwners(),
  };

  return transactions.map(transaction => {
    // First apply automatic tags (including custom rules)
    const withAutoTags = addAutomaticTags(transaction, transactions, config, customRules);

    // Then extract and add hashtag + ownership info
    return enrichWithHashtagInfo(withAutoTags, ownership);
  });
}

/**
 * Process transactions with trip grouping
 * This matches the old processTransactionsWithTrips signature
 * @param {Array} transactions - Transactions with hashtag info
 * @param {Object} userConfig - Optional configuration overrides
 * @returns {Array} Transactions with trip info added
 */
export function processTransactionsWithTrips(transactions, userConfig = {}) {
  const config = mergeConfig(userConfig);
  return processTrips(transactions, config);
}

/**
 * Full processing pipeline - applies all designation logic
 * @param {Array} transactions - Raw transactions
 * @param {Object} userConfig - Optional configuration overrides
 * @returns {Array} Fully processed transactions with all designation info
 */
export function processTransactions(transactions, userConfig = {}) {
  const config = mergeConfig(userConfig);

  // Step 1: Add automatic tags (household, transfer)
  const withAutoTags = addHashtagsToTransactions(transactions, config);

  // Step 2: Process trips
  const withTrips = processTransactionsWithTrips(withAutoTags, config);

  return withTrips;
}

// Re-export utility functions for backward compatibility
export { isTransferTransaction };
