/**
 * Transaction designation utilities
 *
 * This is a thin wrapper for backward compatibility.
 * All functionality has moved to ./designations/
 */

// Import everything we need
import {
  addHashtagsToTransactions as _addHashtagsToTransactions,
  processTransactionsWithTrips as _processTransactionsWithTrips,
  processTransactions,
  isTransferTransaction,
  extractAllHashtags,
  filterRelevantHashtags,
  getTripSummaries,
  defaultConfig,
  shouldIncludeInTripProcessing,
} from './designations/index.js';

// Re-export main functions
export {
  processTransactions,
  isTransferTransaction,
  extractAllHashtags,
  filterRelevantHashtags,
  getTripSummaries,
  defaultConfig,
};

// Export with original names
export const addHashtagsToTransactions = _addHashtagsToTransactions;
export const processTransactionsWithTrips = _processTransactionsWithTrips;

// Legacy alias
export const processTransactionsWithTripsWrapper = _processTransactionsWithTrips;

// Legacy export: DEFAULT_SETTINGS maps to trip config
export const DEFAULT_SETTINGS = {
  maxDaysBetween: defaultConfig.trip.maxDaysBetween,
  excludePositiveTransactions: defaultConfig.trip.excludePositive,
};

// Legacy export: extractHashtags is alias for filterRelevantHashtags(extractAllHashtags())
export function extractHashtags(transaction) {
  const allHashtags = extractAllHashtags(transaction);
  return filterRelevantHashtags(allHashtags);
}

// Legacy export: shouldIncludeTransaction
export function shouldIncludeTransaction(transaction, settings = DEFAULT_SETTINGS) {
  return shouldIncludeInTripProcessing(transaction, {
    ...defaultConfig,
    trip: {
      ...defaultConfig.trip,
      maxDaysBetween: settings.maxDaysBetween,
      excludePositive: settings.excludePositiveTransactions,
    },
  });
}

// Legacy export: addAutomaticTags (individual transaction processing)
export function addAutomaticTags(transaction, allTransactions = []) {
  // Process all transactions but return just this one
  const processed = _addHashtagsToTransactions([transaction, ...allTransactions.filter(t => t.id !== transaction.id)]);
  return processed.find(t => t.id === transaction.id) || transaction;
}
