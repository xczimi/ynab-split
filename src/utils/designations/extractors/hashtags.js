/**
 * Hashtag extraction utilities
 */

/**
 * Extract all hashtags from a transaction's memo
 * @param {Object|string} transactionOrMemo - Transaction object or memo string
 * @returns {Array} Array of hashtags without the # symbol
 */
export function extractAllHashtags(transactionOrMemo) {
  const memo = typeof transactionOrMemo === 'string'
    ? transactionOrMemo
    : (transactionOrMemo?.memo || '');

  if (!memo) {
    return [];
  }

  const hashtagPattern = /#([a-zA-Z0-9_]+)/g;
  const matches = [...memo.matchAll(hashtagPattern)];
  return matches.map(match => match[1]);
}

/**
 * Filter hashtags to only include designation-relevant ones
 * @param {Array} hashtags - Array of hashtag strings
 * @returns {Array} Filtered array with only trip/household/transfer tags
 */
export function filterRelevantHashtags(hashtags) {
  return hashtags.filter(tag => {
    const lowerTag = tag.toLowerCase();
    return (
      lowerTag.startsWith('trip') ||
      lowerTag === 'household' ||
      lowerTag === 'transfer'
    );
  });
}

/**
 * Extract trip-specific hashtags
 * @param {Object|string} transactionOrMemo - Transaction object or memo string
 * @returns {Array} Array of trip hashtags
 */
export function extractTripHashtags(transactionOrMemo) {
  const allHashtags = extractAllHashtags(transactionOrMemo);
  return allHashtags.filter(tag => tag.toLowerCase().startsWith('trip'));
}

/**
 * Check if memo contains a specific hashtag
 * @param {string} memo - Memo text
 * @param {string} hashtag - Hashtag to check (without #)
 * @returns {boolean} True if hashtag is present
 */
export function hasHashtag(memo, hashtag) {
  const hashtags = extractAllHashtags(memo);
  return hashtags.some(tag => tag.toLowerCase() === hashtag.toLowerCase());
}

/**
 * Add a hashtag to memo if not already present
 * @param {string} memo - Current memo
 * @param {string} hashtag - Hashtag to add (without #)
 * @returns {string} Updated memo
 */
export function addHashtag(memo, hashtag) {
  if (hasHashtag(memo, hashtag)) {
    return memo;
  }
  return memo ? `${memo} #${hashtag}` : `#${hashtag}`;
}

/**
 * Remove designation hashtags from memo
 * @param {string} memo - Current memo
 * @returns {string} Memo with designation hashtags removed
 */
export function removeDesignationHashtags(memo) {
  if (!memo) return '';
  return memo.replace(/#(transfer|household|trip\w*)/gi, '').trim();
}
