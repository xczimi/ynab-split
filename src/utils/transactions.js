/**
 * YNAB SDK transaction utilities
 * Centralized location for all YNAB API interactions
 */

import * as ynab from 'ynab';
import * as R from 'ramda';
import { TransactionFlagColor } from 'ynab';

/**
 * Initialize YNAB API client
 * @param {string} token - YNAB access token
 * @returns {Object} - YNAB API instance
 */
export function initializeYnabApi(token) {
  if (!token) {
    throw new Error('YNAB token is required');
  }
  return new ynab.api(token);
}

/**
 * Get all budgets from YNAB API
 * @param {Object} api - YNAB API instance
 * @returns {Promise<Array>} - Promise resolving to array of budgets
 */
export async function getBudgets(api) {
  try {
    console.log('Getting budgets from YNAB API');
    const response = await api.budgets.getBudgets();
    console.log('Budgets received:', response.data.budgets.length);
    return response.data.budgets;
  } catch (error) {
    console.error('Error fetching budgets:', error);
    throw error;
  }
}

/**
 * Get transactions and categories for a budget with enhanced data
 * @param {Object} api - YNAB API instance
 * @param {string} budgetId - Budget ID
 * @param {string} sinceDate - Date to fetch transactions since (YYYY-MM-DD format)
 * @returns {Promise<Array>} - Promise resolving to enhanced transactions array
 */
export async function getEnhancedTransactions(api, budgetId, sinceDate = "2024-01-01") {
  try {
    console.log(`Getting transactions for budget ${budgetId} since ${sinceDate}`);

    // Get both transactions and categories to have access to category groups
    const [transRes, catRes] = await Promise.all([
      api.transactions.getTransactions(budgetId, sinceDate),
      api.categories.getCategories(budgetId)
    ]);

    console.log('Transactions received:', transRes.data.transactions.length);

    // Create a lookup map for category groups
    const categoryGroupMap = {};
    catRes.data.category_groups.forEach(group => {
      group.categories.forEach(category => {
        categoryGroupMap[category.id] = group.name;
      });
    });

    // Filter transactions with Orange flag
    const filteredTransactions = R.filter(
      R.propEq(TransactionFlagColor.Orange, "flag_color")
    )(transRes.data.transactions);

    // Add category group name to each transaction
    const enhancedTransactions = filteredTransactions.map(t => ({
      ...t,
      category_group_name: t.category_id ? categoryGroupMap[t.category_id] : null
    }));

    console.log('Filtered transactions (Orange flag):', enhancedTransactions.length);
    return enhancedTransactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Currency formatting utilities
 */
export const currencyUtils = {
  /**
   * Convert YNAB milliunits to currency amount
   * @param {number} milliunits - Amount in milliunits
   * @returns {number} - Amount as decimal
   */
  convertMilliUnitsToCurrencyAmount: ynab.utils.convertMilliUnitsToCurrencyAmount,

  /**
   * Format milliunits as currency string
   * @param {number} milliunits - Amount in milliunits
   * @param {string} currency - Currency code (default: USD)
   * @returns {string} - Formatted currency string
   */
  formatCurrency(milliunits, currency = 'USD') {
    const amount = this.convertMilliUnitsToCurrencyAmount(milliunits);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }
};

/**
 * Calculate total amount from transactions
 * @param {Array} transactions - Array of transaction objects
 * @returns {number} - Total amount in milliunits
 */
export const transactionsTotal = R.pipe(R.map(R.prop("amount")), R.sum);

/**
 * Find a budget by ID
 * @param {string} budgetId - Budget ID to find
 * @param {Array} budgets - Array of budget objects
 * @returns {Object|undefined} - Found budget or undefined
 */
export function findBudgetById(budgetId, budgets) {
  return budgets.find(budget => budget.id === budgetId);
}

/**
 * Token management utilities
 */
export const tokenUtils = {
  /**
   * Find YNAB token from URL hash or sessionStorage
   * @returns {string|null} - YNAB access token or null
   */
  findYNABToken() {
    console.log('Finding YNAB token');
    let token = null;
    const search = window.location.hash.substring(1).replace(/&/g, '","').replace(/=/g, '":"');
    console.log('URL hash present:', search && search !== '');

    if (search && search !== '') {
      // Try to get access_token from the hash returned by OAuth
      const params = JSON.parse('{"' + search + '"}', function (key, value) {
        return key === '' ? value : decodeURIComponent(value);
      });
      token = params.access_token;
      console.log('Token found in URL hash, storing in sessionStorage');
      sessionStorage.setItem('ynab_access_token', token);
      window.location.hash = '';
    } else {
      // Otherwise try sessionStorage
      token = sessionStorage.getItem('ynab_access_token');
      console.log('Token from sessionStorage:', token ? 'Found' : 'Not found');
    }
    return token;
  },

  /**
   * Store YNAB token in sessionStorage
   * @param {string} token - YNAB access token
   */
  storeToken(token) {
    sessionStorage.setItem('ynab_access_token', token);
  },

  /**
   * Remove YNAB token from sessionStorage
   */
  removeToken() {
    sessionStorage.removeItem('ynab_access_token');
  },

  /**
   * Build YNAB OAuth authorization URL
   * @param {string} clientId - YNAB client ID
   * @param {string} redirectUri - OAuth redirect URI
   * @returns {string} - Authorization URL
   */
  buildAuthUrl(clientId, redirectUri) {
    return `https://app.ynab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token`;
  }
};

/**
 * Local storage utilities for budget preferences
 */
export const storageUtils = {
  /**
   * Save budget ID to localStorage
   * @param {string} side - 'left' or 'right'
   * @param {string} budgetId - Budget ID to save
   */
  saveBudgetId(side, budgetId) {
    const key = `ynab_${side}_budget_id`;
    if (budgetId) {
      console.log(`Saving ${side} budget ID to localStorage`);
      localStorage.setItem(key, budgetId);
    } else {
      console.log(`Removing ${side} budget ID from localStorage`);
      localStorage.removeItem(key);
    }
  },

  /**
   * Get saved budget ID from localStorage
   * @param {string} side - 'left' or 'right'
   * @returns {string|null} - Saved budget ID or null
   */
  getSavedBudgetId(side) {
    return localStorage.getItem(`ynab_${side}_budget_id`);
  },

  /**
   * Clear all saved budget IDs
   */
  clearBudgetIds() {
    localStorage.removeItem('ynab_left_budget_id');
    localStorage.removeItem('ynab_right_budget_id');
  }
};

/**
 * Error handling utilities
 */
export const errorUtils = {
  /**
   * Check if error is an authentication error
   * @param {Error} error - Error object
   * @returns {boolean} - True if authentication error
   */
  isAuthError(error) {
    return error.status === 401;
  },

  /**
   * Extract error message from YNAB API error
   * @param {Error} error - Error object
   * @returns {string} - User-friendly error message
   */
  getErrorMessage(error) {
    return error.error?.detail || error.message || 'An unknown error occurred';
  }
};

/**
 * Transaction sorting utilities
 */
export const sortingUtils = {
  /**
   * Sort transactions by date with secondary sort by transaction ID
   * @param {Array} transactions - Array of transaction objects
   * @param {string} order - 'newest' (default) or 'oldest'
   * @returns {Array} - Sorted array of transactions
   */
  sortTransactionsByDate(transactions, order = 'newest') {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    return [...transactions].sort((a, b) => {
      // Parse dates for comparison
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      // Primary sort: by date
      let dateComparison;
      if (order === 'oldest') {
        dateComparison = dateA.getTime() - dateB.getTime(); // oldest first
      } else {
        dateComparison = dateB.getTime() - dateA.getTime(); // newest first (default)
      }

      // If dates are the same, sort by transaction ID for consistent ordering
      if (dateComparison === 0) {
        return (a.id || '').localeCompare(b.id || '');
      }

      return dateComparison;
    });
  },

  /**
   * Sort transactions by date (newest first) - convenience method
   * @param {Array} transactions - Array of transaction objects
   * @returns {Array} - Sorted array of transactions (newest first)
   */
  sortNewestFirst(transactions) {
    return this.sortTransactionsByDate(transactions, 'newest');
  },

  /**
   * Sort transactions by date (oldest first) - convenience method
   * @param {Array} transactions - Array of transaction objects
   * @returns {Array} - Sorted array of transactions (oldest first)
   */
  sortOldestFirst(transactions) {
    return this.sortTransactionsByDate(transactions, 'oldest');
  }
};
