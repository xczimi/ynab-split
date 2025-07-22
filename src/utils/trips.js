/**
 * Trip identification and processing utilities for transaction data
 */

import { DateTime } from 'luxon';

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

// Default settings for trip detection
export const DEFAULT_TRIP_SETTINGS = {
  // Max days between transactions to be considered part of the same trip
  maxDaysBetween: 2,
  // Exclude positive transactions (these are likely transfers between budgets)
  excludePositiveTransactions: false
};

/**
 * Check if a group of transactions has transactions from at least 2 different dates
 * @param {Array} transactions - Array of transaction objects
 * @returns {boolean} - True if transactions span at least 2 different dates
 */
function hasMultipleDates(transactions) {
  if (transactions.length < 2) return false;

  const uniqueDates = new Set(
    transactions.map(t => createVancouverDateTime(t.date).toISODate())
  );

  return uniqueDates.size >= 2;
}

/**
 * Extract all hashtags from transaction memo
 * @param {Object} transaction - Transaction object
 * @returns {Array} - Array of all hashtags without the # symbol
 */
export function extractAllHashtags(transaction) {
  if (!transaction.memo) return [];

  const memo = transaction.memo || '';
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = [...memo.matchAll(hashtagRegex)];

  // Return all hashtags
  return matches.map(match => match[1]);
}

/**
 * Filter hashtags to only include trip hashtags
 * @param {Array} hashtags - Array of all hashtags
 * @returns {Array} - Filtered array of trip hashtags
 */
export function filterTripHashtags(hashtags) {
  return hashtags.filter(tag => {
    const lowerTag = tag.toLowerCase();
    return lowerTag.startsWith('trip');
  });
}

/**
 * Extract trip hashtags from transaction memo
 * @param {Object} transaction - Transaction object
 * @returns {Array} - Array of trip hashtags without the # symbol
 */
export function extractTripHashtags(transaction) {
  const allHashtags = extractAllHashtags(transaction);
  return filterTripHashtags(allHashtags);
}

/**
 * Group transactions by consecutive dates to identify potential trips
 * @param {Array} transactions - Array of transaction objects
 * @param {number} maxDaysBetween - Maximum days between transactions to be considered part of the same trip
 * @returns {Array} - Array of trip groups
 */
export function groupTransactionsByConsecutiveDates(transactions, maxDaysBetween = 0) {
  if (!transactions.length) {
    return [];
  }

  // Pre-convert dates to avoid repeated DateTime creation during sorting
  const transactionsWithDates = transactions.map(transaction => ({
    ...transaction,
    _sortDate: createVancouverDateTime(transaction.date)
  }));

  // Sort transactions by date using Vancouver timezone with secondary sort by transaction ID for consistency
  const sortedTransactions = transactionsWithDates.sort((a, b) => {
    const dateComparison = a._sortDate.toMillis() - b._sortDate.toMillis();

    // If dates are the same, sort by transaction ID for consistent ordering
    if (dateComparison === 0) {
      return (a.id || '').localeCompare(b.id || '');
    }

    return dateComparison;
  });

  // Use reduce to group transactions by consecutive dates
  const { tripGroups, currentGroup } = sortedTransactions.reduce((acc, currentTransaction, index) => {
    const { tripGroups, currentGroup } = acc;

    if (index === 0) {
      // First transaction starts the first group
      return {
        tripGroups,
        currentGroup: [currentTransaction]
      };
    }

    const previousTransaction = sortedTransactions[index - 1];
    const daysDifference = getDaysDifference(currentTransaction.date, previousTransaction.date);

    if (daysDifference <= maxDaysBetween) {
      // Add to current group if within the date range
      return {
        tripGroups,
        currentGroup: [...currentGroup, currentTransaction]
      };
    } else {
      // Evaluate current group for trip qualification (at least 2 different dates)
      const groupQualifies = hasMultipleDates(currentGroup);

      let newTripGroups = tripGroups;
      if (groupQualifies) {
        newTripGroups = [...tripGroups, currentGroup];
      }

      // Start new group with current transaction
      return {
        tripGroups: newTripGroups,
        currentGroup: [currentTransaction]
      };
    }
  }, { tripGroups: [], currentGroup: [] });

  // Handle the final group after reduce completes (check for multiple dates)
  const finalGroupQualifies = hasMultipleDates(currentGroup);

  let finalTripGroups = tripGroups;
  if (finalGroupQualifies) {
    finalTripGroups = [...tripGroups, currentGroup];
  }

  return finalTripGroups;
}

/**
 * Generate trip names based on date ranges and locations
 * @param {Array} tripTransactions - Array of transactions in a trip
 * @param {number} tripIndex - Index of the trip for unique naming
 * @returns {string} - Generated trip name
 */
export function generateTripName(tripTransactions, tripIndex) {
  const startDate = createVancouverDateTime(tripTransactions[0].date);
  const endDate = createVancouverDateTime(tripTransactions[tripTransactions.length - 1].date);

  // Check if any transaction has a manual trip hashtag
  const manualTripTag = tripTransactions.find(t => {
    const hashtags = extractAllHashtags(t);
    return hashtags.find(tag => tag.toLowerCase().startsWith('trip'));
  });

  if (manualTripTag) {
    const hashtags = extractAllHashtags(manualTripTag);
    const tripTag = hashtags.find(tag => tag.toLowerCase().startsWith('trip'));
    return tripTag;
  }

  // Generate automatic trip name based on date with year first for natural sorting
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const startYear = startDate.year;
  const endYear = endDate.year;

  if (startDate.toMillis() === endDate.toMillis()) {
    // Single day trip: trip2024Jan15
    return `trip${startYear}${monthNames[startDate.month - 1]}${startDate.day}`;
  } else {
    // Multi-day trip: trip2024Jan15 (no end date)
    return `trip${startYear}${monthNames[startDate.month - 1]}${startDate.day}`;
  }
}

/**
 * Check if a transaction should be included in trip processing
 * @param {Object} transaction - Transaction object
 * @param {Object} settings - Settings object
 * @returns {boolean} - True if transaction should be included
 */
export function shouldIncludeTransactionInTrip(transaction, settings = DEFAULT_TRIP_SETTINGS) {
  // Exclude positive transactions if setting is enabled
  if (settings.excludePositiveTransactions && transaction.amount > 0) {
    return false;
  }

  // Note: Bill checking is handled in designator.js since it's not purely trip-related
  return true;
}

/**
 * Process transactions and identify trips based on consecutive dates and hashtags
 * @param {Array} transactions - Array of transaction objects
 * @param {Object} settings - Settings object
 * @param {Function} shouldIncludeTransactionFn - Function to determine if transaction should be included
 * @returns {Array} - Array of transactions with trip information
 */
export function processTransactionsWithTrips(transactions, settings = DEFAULT_TRIP_SETTINGS, shouldIncludeTransactionFn = shouldIncludeTransactionInTrip) {
  // First convert dates to Vancouver timezone DateTime objects
  const transactionsWithDates = transactions.map(t => ({
    ...t,
    date: createVancouverDateTime(t.date)
  }));

  // Separate transactions for trip processing vs keeping all transactions
  const transactionsForTripProcessing = transactionsWithDates.filter(t =>
    shouldIncludeTransactionFn(t, settings)
  );

  // Group transactions by consecutive dates (only for non-household/non-bill transactions)
  const dateGroups = groupTransactionsByConsecutiveDates(transactionsForTripProcessing, settings.maxDaysBetween);

  // Create a map to store trip assignments
  const tripAssignments = new Map();

  // Assign trip names to grouped transactions
  dateGroups.forEach((group, index) => {
    const tripName = generateTripName(group, index + 1);

    group.forEach(transaction => {
      tripAssignments.set(transaction.id, tripName);
    });
  });

  // Process ALL transactions and add trip information
  const processedTransactions = transactionsWithDates.map(transaction => {
    const tripHashtags = extractTripHashtags(transaction);

    // Check for manual trip hashtag first
    const manualTripTag = tripHashtags.find(tag => tag.toLowerCase().startsWith('trip'));

    // Use manual trip tag if exists, otherwise use date-based assignment
    const tripName = manualTripTag || tripAssignments.get(transaction.id) || null;

    return {
      ...transaction,
      tripHashtags,
      tripName,
      isAutoGeneratedTrip: !manualTripTag && tripAssignments.has(transaction.id),
      date: transaction.date.toISODate() // Convert DateTime back to ISO date string
    };
  });

  return processedTransactions;
}

/**
 * Extract the most frequent words from payee and memo fields
 * @param {Array} transactions - Array of transactions
 * @param {number} topCount - Number of top words to return (default: 3)
 * @returns {Array} - Array of most frequent words
 */
function getMostFrequentWords(transactions, topCount = 3) {
  const wordCounts = {};

  // Common words to exclude
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'among', 'a', 'an', 'as', 'are', 'was', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'is', 'am', 'it', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her',
    'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'inc', 'llc', 'ltd',
    'corp', 'co', 'company', 'store', 'shop', 'market', 'center', 'centre'
  ]);

  transactions.forEach(transaction => {
    const text = `${transaction.payee_name || ''} ${transaction.memo || ''}`.toLowerCase();

    // Extract words (letters only, minimum 4 characters, no numbers)
    const words = text.match(/\b[a-z]{4,}\b/g) || [];

    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
  });

  // Sort by frequency and return top words
  return Object.entries(wordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, topCount)
    .map(([word]) => word);
}

/**
 * Get summary information about trips
 * @param {Array} transactions - Processed transactions with trip information
 * @returns {Array} - Array of trip summary objects
 */
export function getTripSummaries(transactions) {
  const tripGroups = {};

  // Group transactions by trip
  transactions.forEach(transaction => {
    if (transaction.tripName) {
      if (!tripGroups[transaction.tripName]) {
        tripGroups[transaction.tripName] = [];
      }

      tripGroups[transaction.tripName].push(transaction);
    }
  });

  // Create summary for each trip
  return Object.entries(tripGroups).map(([tripName, tripTransactions]) => {
    // Get dates as Vancouver timezone DateTime objects for comparison
    const dates = tripTransactions.map(t => createVancouverDateTime(t.date));
    const startDate = DateTime.min(...dates);
    const endDate = DateTime.max(...dates);

    // Calculate total spending for this trip
    const totalSpending = tripTransactions.reduce(
      (sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0
    );

    // Get the three most frequent words from payee and memo fields
    const frequentWords = getMostFrequentWords(tripTransactions, 3);

    return {
      name: tripName,
      startDate: startDate.toISODate(),
      endDate: endDate.toISODate(),
      transactionCount: tripTransactions.length,
      totalSpending,
      frequentWords
    };
  });
}
