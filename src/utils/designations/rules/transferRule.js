/**
 * Transfer detection rule
 * Detects matching amounts between budgets within a configurable time window
 */

import { defaultConfig } from '../config.js';
import { getDaysDifference } from '../dateUtils.js';

/**
 * Find matching transfer transactions
 * @param {Object} transaction - Transaction to check
 * @param {Array} allTransactions - All transactions from both budgets
 * @param {Object} config - Configuration object
 * @returns {Array} Matching transactions from other budget
 */
export function findMatches(transaction, allTransactions, config = defaultConfig) {
  if (!allTransactions || allTransactions.length === 0) {
    return [];
  }

  const transactionAmount = Math.abs(transaction.amount);
  const maxDays = config.transfer.maxDaysBetween;

  return allTransactions.filter(other => {
    // Skip same transaction
    if (other.id === transaction.id) {
      return false;
    }

    // Must be from different budget
    if (other.source === transaction.source) {
      return false;
    }

    // Amounts must match (absolute values)
    if (Math.abs(other.amount) !== transactionAmount) {
      return false;
    }

    // Must be within configured days
    const daysDiff = getDaysDifference(transaction.date, other.date, config.timezone);
    return daysDiff <= maxDays;
  });
}

/**
 * Check if a transaction is a transfer
 * @param {Object} transaction - Transaction to check
 * @param {Array} allTransactions - All transactions from both budgets
 * @param {Object} config - Configuration object
 * @returns {Object} Detection result { matches, reason, matchingTransactions }
 */
export function detect(transaction, allTransactions, config = defaultConfig) {
  const matches = findMatches(transaction, allTransactions, config);

  if (matches.length > 0) {
    const match = matches[0];
    const daysDiff = getDaysDifference(transaction.date, match.date, config.timezone);
    return {
      matches: true,
      reason: `Matches ${match.budgetName || match.source} transaction within ${daysDiff.toFixed(0)} days`,
      matchingTransactions: matches,
    };
  }

  return { matches: false, reason: null, matchingTransactions: [] };
}

/**
 * Check if transaction is a transfer (legacy compatibility)
 * @param {Object} transaction - Transaction to check
 * @param {Array} allTransactions - All transactions from both budgets
 * @param {Object} config - Configuration object
 * @returns {boolean} True if transaction is a transfer
 */
export function isTransferTransaction(transaction, allTransactions, config = defaultConfig) {
  return detect(transaction, allTransactions, config).matches;
}

/**
 * Check if auto-tagging should be applied
 * @param {Object} transaction - Transaction to check
 * @param {Array} allTransactions - All transactions
 * @param {Object} config - Configuration object
 * @returns {boolean} True if should add #transfer tag
 */
export function shouldAutoTag(transaction, allTransactions, config = defaultConfig) {
  // Don't tag if already has #transfer in memo
  const memo = (transaction.memo || '').toLowerCase();
  if (memo.includes('#transfer')) {
    return false;
  }

  return detect(transaction, allTransactions, config).matches;
}
