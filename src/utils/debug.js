/**
 * Debug utilities for exporting transaction data
 * Access via browser console: window.ynabDebug
 */

// Getter function to be set by App.vue
let getTransactions = () => [];

/**
 * Set the transaction getter function (called by App.vue)
 */
export function setTransactionGetter(getter) {
  getTransactions = getter;
  console.log('ynabDebug: Transaction getter initialized');
}

/**
 * Export all processed transactions with designations
 */
function exportTransactions() {
  const transactions = getTransactions();
  console.log(`Exporting ${transactions.length} transactions`);
  return transactions;
}

/**
 * Export filtered transactions
 * @param {Object} filters - Filter options
 * @param {boolean} filters.hasTransferTag - Include transfer transactions
 * @param {boolean} filters.hasHouseholdTag - Include household transactions
 * @param {string} filters.tripName - Filter by specific trip name
 * @param {boolean} filters.undesignated - Include only undesignated transactions
 */
function exportFiltered(filters = {}) {
  const transactions = getTransactions();

  const filtered = transactions.filter(t => {
    // If undesignated filter is set, only include transactions with no designation
    if (filters.undesignated) {
      return !t.hasTransferTag && !t.hasHouseholdTag && !t.tripName;
    }

    // If specific filters are set, match them
    if (filters.hasTransferTag !== undefined && t.hasTransferTag !== filters.hasTransferTag) {
      return false;
    }
    if (filters.hasHouseholdTag !== undefined && t.hasHouseholdTag !== filters.hasHouseholdTag) {
      return false;
    }
    if (filters.tripName !== undefined && t.tripName !== filters.tripName) {
      return false;
    }

    return true;
  });

  console.log(`Filtered to ${filtered.length} transactions`);
  return filtered;
}

/**
 * Export transactions that might have designation issues
 * (e.g., matching amounts not tagged as transfer)
 */
function exportProblematic() {
  const transactions = getTransactions();
  const problematic = [];

  // Find potential transfer pairs that aren't tagged
  transactions.forEach(t => {
    if (t.hasTransferTag) return;

    // Look for matching amounts from different budgets within 3 days
    const matches = transactions.filter(other => {
      if (other.id === t.id) return false;
      if (other.source === t.source) return false;
      if (Math.abs(other.amount) !== Math.abs(t.amount)) return false;

      const tDate = new Date(t.date);
      const otherDate = new Date(other.date);
      const daysDiff = Math.abs(tDate - otherDate) / (1000 * 60 * 60 * 24);
      return daysDiff <= 3;
    });

    if (matches.length > 0) {
      problematic.push({
        transaction: t,
        potentialMatches: matches,
        issue: 'Potential transfer not tagged'
      });
    }
  });

  console.log(`Found ${problematic.length} potentially problematic transactions`);
  return problematic;
}

/**
 * Copy data to clipboard as formatted JSON
 * @param {any} data - Data to copy (defaults to all transactions)
 */
async function copyToClipboard(data) {
  const toExport = data || exportTransactions();
  const json = JSON.stringify(toExport, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    console.log(`Copied ${Array.isArray(toExport) ? toExport.length + ' transactions' : 'data'} to clipboard`);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    console.log('JSON output:', json);
    return false;
  }
}

/**
 * Download data as JSON file
 * @param {string} filename - Filename (default: transactions.json)
 * @param {any} data - Data to download (defaults to all transactions)
 */
function downloadJSON(filename = 'transactions.json', data) {
  const toExport = data || exportTransactions();
  const json = JSON.stringify(toExport, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Downloaded ${Array.isArray(toExport) ? toExport.length + ' transactions' : 'data'} to ${filename}`);
}

/**
 * Get summary statistics
 */
function getSummary() {
  const transactions = getTransactions();
  const transfers = transactions.filter(t => t.hasTransferTag);
  const household = transactions.filter(t => t.hasHouseholdTag);
  const trips = transactions.filter(t => t.tripName);
  const undesignated = transactions.filter(t => !t.hasTransferTag && !t.hasHouseholdTag && !t.tripName);

  const tripNames = [...new Set(trips.map(t => t.tripName))];

  return {
    total: transactions.length,
    transfers: transfers.length,
    household: household.length,
    trips: trips.length,
    undesignated: undesignated.length,
    tripNames
  };
}

// Expose utilities on window for console access
if (typeof window !== 'undefined') {
  window.ynabDebug = {
    exportTransactions,
    exportFiltered,
    exportProblematic,
    copyToClipboard,
    downloadJSON,
    getSummary,
    help: () => {
      console.log(`
ynabDebug - Transaction Export Utilities
=========================================

Commands:
  ynabDebug.exportTransactions()     - Get all processed transactions
  ynabDebug.exportFiltered(opts)     - Filter transactions
    opts: { hasTransferTag, hasHouseholdTag, tripName, undesignated }
  ynabDebug.exportProblematic()      - Find potential designation issues
  ynabDebug.copyToClipboard(data?)   - Copy to clipboard (default: all)
  ynabDebug.downloadJSON(file?, data?) - Download as JSON file
  ynabDebug.getSummary()             - Get designation statistics

Examples:
  ynabDebug.getSummary()
  ynabDebug.exportFiltered({ hasTransferTag: true })
  ynabDebug.exportFiltered({ tripName: 'tripHawaii' })
  ynabDebug.exportFiltered({ undesignated: true })
  ynabDebug.copyToClipboard()
  ynabDebug.downloadJSON('my-data.json')
      `);
    }
  };

  console.log('ynabDebug utilities loaded. Type ynabDebug.help() for usage.');
}
