<template>
  <div class="transaction-container">
    <!-- Filter Controls -->
    <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
      <div class="d-flex align-items-center flex-wrap">
        <span class="me-3 fw-bold text-muted">Show:</span>
        <div class="form-check form-switch me-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="showTransfers"
            v-model="showTransfers"
          >
          <label class="form-check-label" for="showTransfers">
            <i class="fas fa-exchange-alt me-1"></i>
            Transfers
          </label>
        </div>
        <div class="form-check form-switch me-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="showHousehold"
            v-model="showHousehold"
          >
          <label class="form-check-label" for="showHousehold">
            <i class="fas fa-home me-1"></i>
            Household
          </label>
        </div>
        <div class="form-check form-switch me-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="showTrips"
            v-model="showTrips"
          >
          <label class="form-check-label" for="showTrips">
            <i class="fas fa-suitcase me-1"></i>
            Trips
          </label>
        </div>
        <div class="form-check form-switch me-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="showUndesignated"
            v-model="showUndesignated"
          >
          <label class="form-check-label" for="showUndesignated">
            <i class="fas fa-question-circle me-1"></i>
            Undesignated
          </label>
        </div>

        <!-- Reset Trips Button -->
        <div class="d-flex align-items-center me-3">
          <button
            @click="resetTrips"
            class="btn btn-sm btn-outline-warning"
            :disabled="!tripsProcessed"
            title="Reset trip identification and clear all processed trip data"
          >
            <i class="fas fa-undo me-1"></i>
            Reset Trips
          </button>
        </div>

        <!-- Trip Filter Dropdown -->
        <div class="d-flex align-items-center ms-3">
          <label for="tripFilter" class="form-label me-2 mb-0 text-muted small">Trip:</label>
          <select
            id="tripFilter"
            class="form-select form-select-sm"
            v-model="selectedTripFilter"
            style="min-width: 150px;"
          >
            <option value="">All Trips</option>
            <option v-for="trip in availableTrips" :key="trip" :value="trip">
              #{{ trip }}
            </option>
          </select>
        </div>
      </div>
      <div class="text-muted small">
        Showing {{ filteredTransactions.length }} of {{ combinedTransactions.length }} transactions
      </div>
    </div>

    <div v-if="!filteredTransactions.length" class="text-center p-4">
      <p class="text-muted">No transactions to display</p>
      <p class="small text-muted" v-if="combinedTransactions.length > 0">
        All transactions are filtered out. Try enabling more transaction types above.
      </p>
    </div>
    <div v-else>
      <div class="table-responsive">
      <table class="table table-hover">
        <thead class="table-light">
          <tr>
            <th>Budget</th>
            <th>Date</th>
            <th>Category</th>
            <th>Payee</th>
            <th>Memo</th>
            <th>Designation</th>
            <th class="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transaction in filteredTransactions"
              v-bind:key="transaction.id"
              class="transaction-row"
              :class="{
                'left-budget-row': transaction.source === 'left',
                'right-budget-row': transaction.source === 'right',
                'transfer-transaction': transaction.hasTransferTag,
                'household-transaction': transaction.hasHouseholdTag
              }"
          >
            <td>
              <span class="budget-indicator" :class="{
                'bg-budget-left': transaction.source === 'left',
                'bg-budget-right': transaction.source === 'right'
              }"></span>
              {{ transaction.budgetName }}
            </td>
            <td>{{ transaction.date }}</td>
            <td>
              <div class="category-cell">
                <div v-if="transaction.category_group_name" class="category-group">
                  {{ transaction.category_group_name }}
                </div>
                <div class="category-name" :class="{'transfer-category': isTransferCategory(transaction)}">
                  {{ transaction.category_name || 'Uncategorized' }}
                </div>
              </div>
            </td>
            <td>{{ transaction.payee_name || '-' }}</td>
            <td>{{ transaction.memo || '-' }}</td>
            <td>
              <!-- Transfer designation -->
              <span v-if="transaction.hasTransferTag" class="badge bg-warning text-dark designation-badge">
                #transfer
                <i class="fas fa-exchange-alt ms-1" title="Transfer transaction"></i>
              </span>
              <!-- Household designation -->
              <span v-else-if="transaction.hasHouseholdTag" class="badge bg-success designation-badge">
                #household
                <i class="fas fa-home ms-1" title="Household expense"></i>
              </span>
              <!-- Trip designation -->
              <span v-else-if="transaction.tripName" class="badge bg-primary designation-badge">
                #{{ transaction.tripName }}
                <i class="fas fa-suitcase ms-1" title="Trip expense"></i>
              </span>
              <!-- No designation -->
              <span v-else class="text-muted">-</span>
            </td>
            <td class="text-end" :class="{'text-danger': transaction.amount < 0, 'text-success': transaction.amount > 0}">
              {{ formatCurrency(transaction.amount) }}
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>

<script>
import { currencyUtils, sortingUtils } from '../utils/transactions';
// Import trip-specific functions for any future trip-related functionality
import { extractTripHashtags } from '../utils/trips';

export default {
  name: "CombinedTransactions",
  props: {
    transactions: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      // Filter toggles - hide transfers and household by default
      showTransfers: false,
      showHousehold: false,
      showTrips: false,
      showUndesignated: false, // New toggle for undesignated transactions
      selectedTripFilter: '' // Trip filter dropdown
    };
  },

  watch: {
    // Automatically enable trips when a specific trip is selected
    selectedTripFilter(newValue) {
      if (newValue && newValue !== '') {
        this.showTrips = true;
      }
    }
  },

  computed: {
    // Use the pre-processed transactions from App.vue (they already have budgetName)
    combinedTransactions() {
      return this.transactions;
    },

    filteredTransactions() {
      const filtered = this.combinedTransactions.filter(transaction => {
        // Determine if transaction has any designation
        const hasDesignation = transaction.hasTransferTag || transaction.hasHouseholdTag || transaction.tripName;

        // If showing undesignated, only show transactions without designations
        if (this.showUndesignated && !hasDesignation) {
          return true;
        }

        // If not showing undesignated, exclude undesignated transactions
        if (!this.showUndesignated && !hasDesignation) {
          return false;
        }

        // For designated transactions, apply specific filters
        if (transaction.hasTransferTag && !this.showTransfers) {
          return false;
        }
        if (transaction.hasHouseholdTag && !this.showHousehold) {
          return false;
        }
        // Only hide transactions that are specifically part of a trip when showTrips is false
        if (transaction.tripName && !this.showTrips) {
          return false;
        }
        // Filter by selected trip if any
        if (this.selectedTripFilter && transaction.tripName !== this.selectedTripFilter) {
          return false;
        }

        return true;
      });

      // Use centralized sorting utility from transactions.js
      return sortingUtils.sortNewestFirst(filtered);
    },

    availableTrips() {
      // Get unique trip names from transactions for the dropdown
      const trips = new Set(this.combinedTransactions.map(t => t.tripName).filter(Boolean));
      return [...trips].sort();
    },

    canIdentifyTrips() {
      // Check if we have transactions
      return this.transactions.length > 0 && !this.loading;
    },

    tripsProcessed() {
      // Check if any transactions have trip assignments
      return this.transactions.some(t => t.tripName);
    }
  },

  methods: {
    convertMilliUnitsToCurrencyAmount: currencyUtils.convertMilliUnitsToCurrencyAmount,
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(milliunits);
    },

    isTransferCategory(transaction) {
      // Check if this is a transfer transaction
      if (transaction.hasTransferTag) {
        return true;
      }

      // Otherwise check category, memo and payee
      const category = (transaction.category_name || '').toLowerCase();
      const memo = (transaction.memo || '').toLowerCase();
      const payee = (transaction.payee_name || '').toLowerCase();

      return category.includes('transfer') ||
             memo.includes('transfer') ||
             payee.includes('transfer') ||
             transaction.hashtags?.some(tag => tag.toLowerCase() === 'transfer');
    },

    identifyTrips() {
      // Trigger trip identification in the parent App.vue
      console.log('Trip identification triggered from CombinedTransactions');
      this.$emit('trips-identified');
    },

    // Method that can be called from parent
    triggerTripIdentification() {
      this.identifyTrips();
    },

    resetTrips() {
      // Clear the trip filter selection
      this.selectedTripFilter = '';

      // Emit event to reset trip summary data in parent component
      this.$emit('trips-reset');

      console.log('Trips reset - all trip data cleared');
    }
  }
}
</script>

<style scoped>
.transaction-container {
  max-height: 500px;
  overflow-y: auto;
}

/* Add some column sizing for better readability */
table th:nth-child(3), /* Category (combined) */
table td:nth-child(3) {
  min-width: 220px;
}

.category-cell {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
}

.category-group {
  color: #6c757d;
  font-size: 0.9em;
}

.category-separator {
  color: #adb5bd;
  margin: 0 2px;
}

.category-name {
  font-weight: 500;
}

.transfer-category {
  font-style: italic;
  color: #6c757d;
}

.transaction-row:hover {
  background-color: rgba(0,0,0,0.05);
}

.trip-badge {
  font-size: 0.85rem;
  padding: 4px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trip-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.trip-badge i {
  font-size: 0.7rem;
}

.budget-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

/* CSS variables for budget colors to ensure consistency */
:root {
  --budget-left-color: #8a2be2; /* Purple by default */
  --budget-right-color: #20c997; /* Teal by default */
}

.left-budget-row {
  border-left: 4px solid var(--budget-left-color);
}

.right-budget-row {
  border-left: 4px solid var(--budget-right-color);
}

table {
  margin-bottom: 0;
}

/* Additional styles for transfer and household transactions */
.transfer-transaction {
  opacity: 0.7;
}

.household-transaction {
  opacity: 0.7;
}

/* Designation badge styles */
.designation-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
}

.designation-badge i {
  font-size: 0.6rem;
  margin-left: 4px;
}
</style>
