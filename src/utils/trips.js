/**
 * Trip identification and processing utilities
 *
 * This is a thin wrapper for backward compatibility.
 * All functionality has moved to ./designations/
 */

import {
  extractAllHashtags,
  extractTripHashtags as _extractTripHashtags,
  getTripSummaries,
  processTransactionsWithTrips,
  groupByConsecutiveDates,
  generateTripName as _generateTripName,
  shouldIncludeInTripProcessing,
  getDateRange,
  defaultConfig,
} from './designations/index.js';

// Re-export unchanged functions
export {
  extractAllHashtags,
  getTripSummaries,
  processTransactionsWithTrips,
  shouldIncludeInTripProcessing as shouldIncludeTransactionInTrip,
};

// Re-export with alias
export { _extractTripHashtags as extractTripHashtags };

// Legacy export: filterTripHashtags
export function filterTripHashtags(hashtags) {
  return hashtags.filter(tag => tag.toLowerCase().startsWith('trip'));
}

// Legacy export: DEFAULT_TRIP_SETTINGS
export const DEFAULT_TRIP_SETTINGS = {
  maxDaysBetween: defaultConfig.trip.maxDaysBetween,
  excludePositiveTransactions: defaultConfig.trip.excludePositive,
};

/**
 * Legacy wrapper for groupByConsecutiveDates
 * Old API: groupTransactionsByConsecutiveDates(transactions, maxDaysBetween)
 * New API: groupByConsecutiveDates(transactions, config)
 */
export function groupTransactionsByConsecutiveDates(transactions, maxDaysBetween = 2) {
  return groupByConsecutiveDates(transactions, {
    ...defaultConfig,
    trip: {
      ...defaultConfig.trip,
      maxDaysBetween,
    },
  });
}

/**
 * Legacy wrapper for generateTripName
 * Old API: generateTripName(transactions, groupIndex) -> string
 * New API: generateTripName(startDate, endDate) -> string
 *
 * The old function extracted dates from transactions and generated a name
 */
export function generateTripName(transactions, groupIndex = 0) {
  // Check for manual trip hashtag first
  for (const transaction of transactions) {
    const tripHashtags = _extractTripHashtags(transaction);
    if (tripHashtags.length > 0) {
      return tripHashtags[0];
    }
  }

  // Generate name from date range
  const { startDate, endDate } = getDateRange(transactions);
  if (!startDate || !endDate) {
    return `trip${groupIndex}`;
  }

  return _generateTripName(startDate, endDate);
}
