/**
 * Transaction designation utilities for hashtags, transfers, and household expenses
 */

import { DateTime } from 'luxon';
import {
  extractAllHashtags,
  processTransactionsWithTrips as pureProcessTransactionsWithTrips,
  getTripSummaries,
  shouldIncludeTransactionInTrip,
  DEFAULT_TRIP_SETTINGS
} from './trips.js';

/**
 * Create a DateTime object in America/Vancouver timezone
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {DateTime} - DateTime object in Vancouver timezone
 */
function createVancouverDateTime(dateInput) {
  if (!dateInput) return null;

  // If it's already a Date object, convert to ISO string first
  const dateString = dateInput instanceof Date ? dateInput.toISOString().split('T')[0] : dateInput;

  // Parse the date string and set timezone to America/Vancouver
  return DateTime.fromISO(dateString, { zone: 'America/Vancouver' });
}

/**
 * Calculate difference in days between two dates in Vancouver timezone
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {number} - Difference in days
 */
function getDaysDifference(date1, date2) {
  const vancouverDate1 = createVancouverDateTime(date1);
  const vancouverDate2 = createVancouverDateTime(date2);
  return Math.abs(vancouverDate1.diff(vancouverDate2, 'days').days);
}

// Default settings for designation
export const DEFAULT_SETTINGS = DEFAULT_TRIP_SETTINGS;

// Re-export the already imported functions
export { extractAllHashtags, getTripSummaries };

/**
 * Filter hashtags to only include trip hashtags or special tags
 * @param {Array} hashtags - Array of all hashtags
 * @returns {Array} - Filtered array of hashtags
 */
export function filterRelevantHashtags(hashtags) {
  return hashtags.filter(tag => {
    const lowerTag = tag.toLowerCase();
    return lowerTag.startsWith('trip') ||
           lowerTag === 'household' ||
           lowerTag === 'transfer';
  });
}

/**
 * Extract hashtags from transaction memo
 * Only extracts hashtags that:
 * 1. Start with 'trip' (e.g., #trip, #tripHawaii, #trip_2023)
 * 2. Are exactly #household or #transfer
 * @param {Object} transaction - Transaction object
 * @returns {Array} - Array of hashtags without the # symbol and their types
 */
export function extractHashtags(transaction) {
  const allHashtags = extractAllHashtags(transaction);
  return filterRelevantHashtags(allHashtags);
}

/**
 * Check if a transaction is a transfer transaction based on matching amounts between budgets
 * @param {Object} transaction - Transaction object with source budget information
 * @param {Array} allTransactions - All transactions from both budgets to compare against
 * @returns {boolean} - True if transaction appears to be a transfer
 */
export function isTransferTransaction(transaction, allTransactions = []) {
  // Only check for transfer matches if we have transactions from multiple budgets
  if (!allTransactions.length) {
    return false;
  }

  const transactionDate = createVancouverDateTime(transaction.date);
  const transactionAmount = Math.abs(transaction.amount);

  // Look for matching transactions in other budgets within 3 days
  const matchingTransactions = allTransactions.filter(otherTransaction => {
    // Skip if it's the same transaction
    if (otherTransaction.id === transaction.id) {
      return false;
    }

    // Skip if it's from the same budget
    if (otherTransaction.source === transaction.source) {
      return false;
    }

    // Check if amounts match (absolute values)
    if (Math.abs(otherTransaction.amount) !== transactionAmount) {
      return false;
    }

    // Check if dates are within 3 days using Vancouver timezone
    const daysDifference = getDaysDifference(transaction.date, otherTransaction.date);

    return daysDifference <= 3;
  });

  return matchingTransactions.length > 0;
}

/**
 * Check if a transaction contains "bill" in its category or category group
 * @param {Object} transaction - Transaction object
 * @returns {boolean} - True if transaction appears to be a bill
 */
export function isBillTransaction(transaction) {
  const category = (transaction.category_name || '').toLowerCase();
  const categoryGroup = (transaction.category_group_name || '').toLowerCase();

  return category.includes('bill') || categoryGroup.includes('bill');
}

/**
 * Add automatic tags to transactions based on their characteristics
 * @param {Object} transaction - Transaction object
 * @param {Array} allTransactions - All transactions to check for transfer matches
 * @returns {Object} - Transaction with automatic tags added
 */
export function addAutomaticTags(transaction, allTransactions = []) {
  const existingMemo = transaction.memo || '';
  let newMemo = existingMemo;

  // Check if transaction is a bill and doesn't already have #household tag
  if (isBillTransaction(transaction) && !existingMemo.includes('#household')) {
    newMemo = newMemo ? `${newMemo} #household` : '#household';
  }

  // Check if transaction is a transfer and doesn't already have #transfer tag
  if (isTransferTransaction(transaction, allTransactions) && !existingMemo.includes('#transfer')) {
    newMemo = newMemo ? `${newMemo} #transfer` : '#transfer';
  }

  // Return transaction with updated memo if tags were added
  return {
    ...transaction,
    memo: newMemo,
    // Add flags to indicate automatic tagging was applied
    autoTaggedAsBill: isBillTransaction(transaction) && !existingMemo.includes('#household'),
    autoTaggedAsTransfer: isTransferTransaction(transaction, allTransactions) && !existingMemo.includes('#transfer')
  };
}

/**
 * Add hashtag information to a list of transactions
 * @param {Array} transactions - Array of transaction objects
 * @returns {Array} - Array of transactions with hashtag information and automatic tags
 */
export function addHashtagsToTransactions(transactions) {
  return transactions.map(transaction => {
    // First apply automatic tags, passing all transactions for transfer detection
    const transactionWithAutoTags = addAutomaticTags(transaction, transactions);

    // Get all hashtags and relevant hashtags from the (possibly updated) memo
    const allHashtags = extractAllHashtags(transactionWithAutoTags);
    const relevantHashtags = filterRelevantHashtags(allHashtags);

    // Add to transaction object
    return {
      ...transactionWithAutoTags,
      hashtags: allHashtags,
      relevantHashtags: relevantHashtags,
      hasTripTag: relevantHashtags.some(tag => tag.toLowerCase().startsWith('trip')),
      hasHouseholdTag: relevantHashtags.some(tag => tag.toLowerCase() === 'household'),
      hasTransferTag: relevantHashtags.some(tag => tag.toLowerCase() === 'transfer')
    };
  });
}

/**
 * Check if a transaction should be included in trip processing
 * @param {Object} transaction - Transaction object
 * @param {Object} settings - Settings object
 * @returns {boolean} - True if transaction should be included
 */
export function shouldIncludeTransaction(transaction, settings = DEFAULT_SETTINGS) {
  // Use the trip utility but add bill checking and transfer checking
  const shouldIncludeForTrip = shouldIncludeTransactionInTrip(transaction, settings);

  // Exclude transactions that appear to be bills
  if (isBillTransaction(transaction)) {
    return false;
  }

  // Exclude transactions that have transfer tags (automatic or manual)
  if (transaction.hasTransferTag) {
    return false;
  }

  // Also check if the memo contains #transfer (in case it hasn't been processed yet)
  const memo = (transaction.memo || '').toLowerCase();
  if (memo.includes('#transfer')) {
    return false;
  }

  return shouldIncludeForTrip;
}

/**
 * Wrapper for processTransactionsWithTrips that uses designator's shouldIncludeTransaction
 * This ensures bill transactions are properly excluded from trip processing
 */
export function processTransactionsWithTripsWrapper(transactions, settings = DEFAULT_SETTINGS) {
  // Use the designator's shouldIncludeTransaction which includes bill checking
  return pureProcessTransactionsWithTrips(transactions, settings, shouldIncludeTransaction);
}

// Override the re-export to use our wrapper
export { processTransactionsWithTripsWrapper as processTransactionsWithTrips };
