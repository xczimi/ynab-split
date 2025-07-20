<template>
  <div class="transaction-container">
    <!-- Filter Controls -->
    <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
      <div class="d-flex align-items-center">
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
        <div class="form-check form-switch">
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
            <th>Trip</th>
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
              <span v-if="transaction.category_group_name" class="category-cell">
                <span class="category-group">{{ transaction.category_group_name }}</span>
                <span class="category-separator"> › </span>
                <span class="category-name" :class="{'transfer-category': isTransferCategory(transaction)}">
                  {{ transaction.category_name || 'Uncategorized' }}
                </span>
              </span>
              <span v-else :class="{'transfer-category': isTransferCategory(transaction)}">
                {{ transaction.category_name || 'Uncategorized' }}
              </span>
            </td>
            <td>{{ transaction.payee_name || '-' }}</td>
            <td>{{ transaction.memo || '-' }}</td>
            <td>
              <span v-if="transaction.tripName" class="badge bg-primary trip-badge">
                #{{ transaction.tripName }}
                <i class="fas fa-hashtag ms-1" title="Trip identified by hashtag"></i>
              </span>
              <span v-else>-</span>
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
import {
  extractHashtags,
  extractAllHashtags,
  filterRelevantHashtags,
  addHashtagsToTransactions,
  getTripSummaries,
  DEFAULT_SETTINGS
} from '../utils/tripIdentification';
import { currencyUtils } from '../utils/transactions';

export default {
  name: "CombinedTransactions",
  props: {
    leftTransactions: Array,
    rightTransactions: Array,
    leftBudgetId: String,
    rightBudgetId: String,
    selectedLeftBudget: Object,
    selectedRightBudget: Object
  },
  data() {
    return {
      tripsProcessed: false,
      processedTransactions: [],
      tripSettings: {
        ...DEFAULT_SETTINGS,
        maxDaysBetween: 4 // Allow up to 4 days between transactions in a trip
      },
      // Filter toggles
      showTransfers: true,
      showHousehold: true
    };
  },

  // Add watchers to automatically process trips when transactions change
  watch: {
    leftTransactions() {
      this.identifyTrips();
    },
    rightTransactions() {
      this.identifyTrips();
    }
  },

  // Process trips when component is mounted
  mounted() {
    this.$nextTick(() => {
      if (this.leftTransactions.length > 0 || this.rightTransactions.length > 0) {
        this.identifyTrips();
      }
    });
  },
  computed: {
    combinedTransactions() {
      // Only process if both budget IDs are selected
      if (!this.leftBudgetId || !this.rightBudgetId) {
        return [];
      }

      let transactions;

      // If trips have been processed, use those transactions
      if (this.tripsProcessed && this.processedTransactions.length > 0) {
        transactions = this.processedTransactions;
      } else {
        // Add source and budget name to each transaction
        const leftWithSource = this.leftTransactions.map(t => ({
          ...t,
          source: 'left',
          budgetName: this.selectedLeftBudget?.name || 'Left Budget'
        }));

        const rightWithSource = this.rightTransactions.map(t => ({
          ...t,
          source: 'right',
          budgetName: this.selectedRightBudget?.name || 'Right Budget'
        }));

        // Combine and sort by date (oldest first for running balance calculation)
        transactions = [...leftWithSource, ...rightWithSource]
          .sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      // Calculate running balance difference
      let runningLeftTotal = 0;
      let runningRightTotal = 0;

      const transactionsWithBalance = transactions.map(transaction => {
        // Update running totals
        if (transaction.source === 'left') {
          runningLeftTotal += transaction.amount;
        } else {
          runningRightTotal += transaction.amount;
        }

        // Calculate balance difference (positive means left budget owes right budget)
        const balanceDiff = runningLeftTotal - runningRightTotal;

        return {
          ...transaction,
          balanceDiff
        };
      });

      // Sort by date (newest first) for display
      return transactionsWithBalance.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    filteredTransactions() {
      return this.combinedTransactions.filter(transaction => {
        // Check if transaction should be shown based on filters
        if (transaction.hasTransferTag && !this.showTransfers) {
          return false;
        }
        if (transaction.hasHouseholdTag && !this.showHousehold) {
          return false;
        }
        return true;
      });
    },

    tripSummaries() {
      if (!this.tripsProcessed || !this.processedTransactions.length) {
        return [];
      }

      // Now use the getTripSummaries function with our processed transactions
      return getTripSummaries(this.processedTransactions);
    }
  },
  methods: {
    convertMilliUnitsToCurrencyAmount: currencyUtils.convertMilliUnitsToCurrencyAmount,
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(milliunits);
    },
    isTransferCategory(transaction) {
      // Check if this is a transfer transaction
        // First check if we have the hasTransferTag flag from processing
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
      // Reset any previously processed transactions
      this.tripsProcessed = false;
      this.processedTransactions = [];

      // Get the base transactions
      const baseTransactions = this.combinedTransactions;

      // Count total transactions before processing
      const totalTransactions = baseTransactions.length;
      console.log(`Processing ${totalTransactions} transactions for trip identification`);

      // Add hashtags to transactions
      const transactionsWithHashtags = addHashtagsToTransactions(baseTransactions);
      console.log(`Added hashtag information to ${transactionsWithHashtags.length} transactions`);

      // For now, we're just adding hashtag information without trip processing
      this.processedTransactions = transactionsWithHashtags.map(transaction => {
        // Add tripName property based on hashtags that start with 'trip'
        const tripTag = transaction.relevantHashtags?.find(tag => tag.toLowerCase().startsWith('trip'));
        return {
          ...transaction,
          tripName: tripTag || null
        };
      });

      // Count how many transactions have trip hashtags
      const tripsAssigned = this.processedTransactions.filter(t => t.tripName).length;
      const percentAssigned = totalTransactions > 0 ? Math.round((tripsAssigned / totalTransactions) * 100) : 0;
      console.log(`${tripsAssigned} transactions (${percentAssigned}%) have trip hashtags`);

      // Mark trips as processed
      this.tripsProcessed = true;

      // Generate trip summaries
      const tripSummaries = this.tripSummaries;
      console.log(`${tripSummaries.length} unique trips identified`);

      // Emit event with trip data
      this.$emit('trips-identified', {
        trips: tripSummaries,
        transactionsWithTrips: tripsAssigned
      });
    },
    // Method that can be called from parent
    triggerTripIdentification() {
      this.identifyTrips();
    },
    getBalanceTooltip(balanceDiff) {
      if (balanceDiff > 0) {
        return 'Left budget owes this amount to the right budget';
      } else if (balanceDiff < 0) {
        return 'Right budget owes this amount to the left budget';
      } else {
        return 'Balances are equal';
      }
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
</style>
