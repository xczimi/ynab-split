/**
 * Trip grouping utilities
 * Groups transactions by consecutive dates for trip identification
 */

import { defaultConfig } from '../config.js';
import { createDateTime, getDaysDifference } from '../dateUtils.js';

/**
 * Check if a group of transactions has at least minUniqueDates different dates
 * @param {Array} transactions - Array of transactions
 * @param {number} minDates - Minimum unique dates required
 * @param {string} timezone - Timezone to use
 * @returns {boolean} True if group has enough unique dates
 */
export function hasMinimumUniqueDates(transactions, minDates = 2, timezone = defaultConfig.timezone) {
  const uniqueDates = new Set(
    transactions.map(t => createDateTime(t.date, timezone).toISODate())
  );
  return uniqueDates.size >= minDates;
}

/**
 * Group transactions by consecutive dates
 * @param {Array} transactions - Array of transactions to group
 * @param {Object} config - Configuration object
 * @returns {Array} Array of transaction groups (each group is an array)
 */
export function groupByConsecutiveDates(transactions, config = defaultConfig) {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const { maxDaysBetween, minUniqueDates } = config.trip;
  const timezone = config.timezone;

  // Add sort date to each transaction
  const transactionsWithDates = transactions.map(t => ({
    ...t,
    _sortDate: createDateTime(t.date, timezone),
  }));

  // Sort by date, then by ID for consistency
  const sortedTransactions = transactionsWithDates.sort((a, b) => {
    const dateComparison = a._sortDate.toMillis() - b._sortDate.toMillis();
    if (dateComparison === 0) {
      return (a.id || '').localeCompare(b.id || '');
    }
    return dateComparison;
  });

  // Group consecutive transactions
  const result = sortedTransactions.reduce(
    (acc, transaction, index) => {
      if (index === 0) {
        return { groups: [], currentGroup: [transaction] };
      }

      const previousTransaction = acc.currentGroup[acc.currentGroup.length - 1];
      const daysDiff = getDaysDifference(transaction.date, previousTransaction.date, timezone);

      if (daysDiff <= maxDaysBetween) {
        // Add to current group
        return {
          groups: acc.groups,
          currentGroup: [...acc.currentGroup, transaction],
        };
      } else {
        // Evaluate current group and start new one
        const groupQualifies = hasMinimumUniqueDates(acc.currentGroup, minUniqueDates, timezone);
        return {
          groups: groupQualifies ? [...acc.groups, acc.currentGroup] : acc.groups,
          currentGroup: [transaction],
        };
      }
    },
    { groups: [], currentGroup: [] }
  );

  // Don't forget the last group
  if (result.currentGroup.length > 0) {
    const groupQualifies = hasMinimumUniqueDates(result.currentGroup, minUniqueDates, timezone);
    if (groupQualifies) {
      result.groups.push(result.currentGroup);
    }
  }

  // Clean up _sortDate from returned transactions
  return result.groups.map(group =>
    group.map(t => {
      const { _sortDate, ...rest } = t;
      return rest;
    })
  );
}

/**
 * Get date range for a group of transactions
 * @param {Array} transactions - Array of transactions
 * @param {string} timezone - Timezone to use
 * @returns {Object} { startDate, endDate } as Luxon DateTimes
 */
export function getDateRange(transactions, timezone = defaultConfig.timezone) {
  if (!transactions || transactions.length === 0) {
    return { startDate: null, endDate: null };
  }

  const dates = transactions.map(t => createDateTime(t.date, timezone));
  const sortedDates = dates.sort((a, b) => a.toMillis() - b.toMillis());

  return {
    startDate: sortedDates[0],
    endDate: sortedDates[sortedDates.length - 1],
  };
}
