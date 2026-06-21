/**
 * Generic category-based designation rule
 *
 * Matches transactions against user-defined patterns on category, categoryGroup, or payee fields.
 */

/**
 * Detect if a transaction matches a custom category rule
 * @param {Object} transaction - Transaction to check
 * @param {Object} rule - Custom designation rule
 * @param {string} rule.hashtag - Hashtag to apply (without #)
 * @param {Array<string>} rule.patterns - Patterns to match (case-insensitive)
 * @param {string} rule.matchOn - Field to match: 'category', 'categoryGroup', or 'payee'
 * @returns {Object|null} Match result with hashtag and reason, or null if no match
 */
export function detectCustomCategory(transaction, rule) {
  const { hashtag, patterns, matchOn } = rule;

  if (!hashtag || !patterns || !Array.isArray(patterns) || patterns.length === 0) {
    return null;
  }

  // Get the field value to match against
  let fieldValue;
  switch (matchOn) {
    case 'category':
      fieldValue = transaction.category_name;
      break;
    case 'categoryGroup':
      fieldValue = transaction.category_group_name;
      break;
    case 'payee':
      fieldValue = transaction.payee_name;
      break;
    default:
      fieldValue = transaction.category_name;
  }

  if (!fieldValue) {
    return null;
  }

  const lowerValue = fieldValue.toLowerCase();

  // Check each pattern
  for (const pattern of patterns) {
    if (typeof pattern === 'string' && lowerValue.includes(pattern.toLowerCase())) {
      return {
        hashtag,
        reason: `${matchOn || 'category'} contains "${pattern}"`,
      };
    }
  }

  return null;
}

/**
 * Apply all custom designation rules to a transaction
 * @param {Object} transaction - Transaction to check
 * @param {Array<Object>} rules - Array of custom designation rules
 * @returns {Array<Object>} Array of matching rules with hashtag and reason
 */
export function detectAllCustomCategories(transaction, rules) {
  if (!rules || !Array.isArray(rules)) {
    return [];
  }

  const matches = [];

  for (const rule of rules) {
    const match = detectCustomCategory(transaction, rule);
    if (match) {
      matches.push(match);
    }
  }

  return matches;
}
