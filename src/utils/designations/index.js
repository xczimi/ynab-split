/**
 * Designation system - main exports
 *
 * This module provides transaction designation functionality:
 * - Transfer detection between budgets
 * - Trip grouping and naming
 */

// Configuration
export { defaultConfig, mergeConfig, loadCustomDesignations, saveCustomDesignations } from './config.js';

// Main processor functions (primary API)
export {
  addHashtagsToTransactions,
  processTransactionsWithTrips,
  processTransactions,
  isTransferTransaction,
} from './processor.js';

// Hashtag utilities
export {
  extractAllHashtags,
  filterRelevantHashtags,
  extractTripHashtags,
  hasHashtag,
  addHashtag,
  removeDesignationHashtags,
} from './extractors/hashtags.js';

// Trip utilities
export {
  getTripSummaries,
  getTripNameForGroup,
  generateTripName,
  shouldIncludeInTripProcessing,
} from './rules/tripRule.js';

// Date utilities
export { createDateTime, getDaysDifference } from './dateUtils.js';

// Trip grouping utilities
export {
  groupByConsecutiveDates,
  hasMinimumUniqueDates,
  getDateRange,
} from './extractors/tripGrouper.js';

// Custom category rule utilities
export { detectCustomCategory, detectAllCustomCategories } from './rules/categoryRule.js';

// Individual rule modules (for advanced usage)
export * as transferRule from './rules/transferRule.js';
export * as tripRule from './rules/tripRule.js';
export * as categoryRule from './rules/categoryRule.js';
