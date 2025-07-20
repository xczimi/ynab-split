/**
 * Trip identification utilities for transaction data
 */

// Default settings for trip detection
export const DEFAULT_SETTINGS = {
  // Max days between transactions to be considered part of the same trip
  maxDaysBetween: 3,
  // Exclude positive transactions (these are likely transfers between budgets)
  excludePositiveTransactions: false
  // No longer using billKeywords - just check for "bill" in category names
};

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

  const transactionDate = new Date(transaction.date);
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

    // Check if dates are within 3 days
    const otherDate = new Date(otherTransaction.date);
    const daysDifference = Math.abs(transactionDate - otherDate) / (1000 * 60 * 60 * 24);

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
 * Process transactions and identify trips based on hashtags
 * @param {Array} transactions - Array of transaction objects
 * @param {Object} settings - Settings object
 * @returns {Array} - Array of transactions with trip information
 */
export function processTransactionsWithTrips(transactions, settings = DEFAULT_SETTINGS) {
  // First convert dates if they're strings
  const transactionsWithDates = transactions.map(t => ({
    ...t,
    date: t.date instanceof Date ? t.date : new Date(t.date)
  }));

  // Filter transactions that should be included
  const filteredTransactions = transactionsWithDates.filter(t =>
    shouldIncludeTransaction(t, settings)
  );

  // Process hashtags and add trip information
  return filteredTransactions.map(transaction => {
    const hashtags = extractHashtags(transaction);

    // Only use hashtags that start with 'trip' for the tripName
    const tripHashtags = hashtags.filter(tag => tag.toLowerCase().startsWith('trip'));
    const tripName = tripHashtags.length > 0 ? tripHashtags[0] : null;

    return {
      ...transaction,
      hashtags,
      tripName,
      date: transaction.date.toISOString().split('T')[0] // Convert back to string format
    };
  });
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
    // Get dates as actual Date objects for comparison
    const dates = tripTransactions.map(t => new Date(t.date));
    const startDate = new Date(Math.min(...dates));
    const endDate = new Date(Math.max(...dates));

    // Calculate total spending for this trip
    const totalSpending = tripTransactions.reduce(
      (sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0
    );

    return {
      name: tripName,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      transactionCount: tripTransactions.length,
      totalSpending
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
  // Exclude positive transactions if setting is enabled
  if (settings.excludePositiveTransactions && transaction.amount > 0) {
    return false;
  }

  // Exclude transactions that appear to be bills
  if (isBillTransaction(transaction)) {
    return false;
  }

  return true;
}
