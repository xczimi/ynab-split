<template>
  <div class="card shadow-sm mb-4">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h5 class="mb-0">Transfer Summary</h5>
      <div class="d-flex align-items-center">
        <span class="badge bg-warning me-2" title="Number of transfer pairs identified between budgets">
          {{ transferPairs.length }} Transfer Pairs
        </span>
        <span class="badge bg-secondary me-3" title="Total number of individual transfer transactions">
          {{ totalTransferTransactions }} Transactions
        </span>
        <button
          @click="toggleDetails"
          class="btn btn-sm btn-outline-secondary"
          :title="showDetails ? 'Hide Details' : 'Show Details'"
        >
          <i :class="showDetails ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
        </button>
      </div>
    </div>
    <div v-show="showDetails" class="card-body p-0">
      <div v-if="!transferPairs.length" class="text-center p-4">
        <p class="text-muted">No transfers identified between budgets</p>
        <p class="small text-muted">Transfers are automatically detected by matching absolute amounts between different budgets within 3 days</p>
      </div>
      <div v-else>
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Date Range</th>
                <th>Amount</th>
                <th>From Budget</th>
                <th>To Budget</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pair in sortedTransferPairs" :key="pair.id" class="transfer-row">
                <td>
                  <div class="d-flex flex-column">
                    <span class="fw-bold">{{ formatDate(pair.fromTransaction.date) }}</span>
                    <span v-if="pair.fromTransaction.date !== pair.toTransaction.date" class="text-muted small">
                      to {{ formatDate(pair.toTransaction.date) }}
                    </span>
                    <span v-if="pair.daysDifference > 0" class="badge bg-light text-dark mt-1">
                      {{ pair.daysDifference }} day{{ pair.daysDifference !== 1 ? 's' : '' }} apart
                    </span>
                  </div>
                </td>
                <td>
                  <span class="fw-bold text-primary">{{ formatCurrency(pair.amount) }}</span>
                </td>
                <td>
                  <div class="d-flex align-items-center">
                    <span class="budget-indicator bg-budget-left me-2"></span>
                    <div>
                      <div class="fw-bold">{{ pair.fromBudget }}</div>
                      <small class="text-muted">{{ pair.fromTransaction.payee_name || '-' }}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="d-flex align-items-center">
                    <span class="budget-indicator bg-budget-right me-2"></span>
                    <div>
                      <div class="fw-bold">{{ pair.toBudget }}</div>
                      <small class="text-muted">{{ pair.toTransaction.payee_name || '-' }}</small>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TransferSummary',
  props: {
    transactions: {
      type: Array,
      default: () => []
    },
    allTransactions: {
      type: Array,
      default: () => []
    },
    selectedLeftBudget: {
      type: Object,
      default: null
    },
    selectedRightBudget: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      showDetails: false
    };
  },
  computed: {
    transferPairs() {
      if (!this.transactions.length) return [];

      const pairs = [];
      const processedTransactions = new Set();

      this.transactions.forEach(transaction => {
        // Skip if already processed
        if (processedTransactions.has(transaction.id)) return;

        const transactionDate = new Date(transaction.date);
        const transactionAmount = Math.abs(transaction.amount);

        // Look for matching transactions in all transactions
        const matchingTransactions = this.allTransactions.filter(otherTransaction => {
          if (otherTransaction.id === transaction.id) return false;
          if (otherTransaction.source === transaction.source) return false;
          if (Math.abs(otherTransaction.amount) !== transactionAmount) return false;

          const otherDate = new Date(otherTransaction.date);
          const daysDifference = Math.abs(transactionDate - otherDate) / (1000 * 60 * 60 * 24);
          return daysDifference <= 3;
        });

        // Create pairs for each match
        matchingTransactions.forEach(match => {
          if (!processedTransactions.has(match.id)) {
            // Determine which is "from" and which is "to" based on amount sign
            const fromTransaction = transaction.amount < 0 ? transaction : match;
            const toTransaction = transaction.amount > 0 ? transaction : match;

            const daysDifference = Math.abs(new Date(fromTransaction.date) - new Date(toTransaction.date)) / (1000 * 60 * 60 * 24);

            // Get budget names
            const fromBudget = fromTransaction.source === 'left'
              ? this.selectedLeftBudget?.name || 'Left Budget'
              : this.selectedRightBudget?.name || 'Right Budget';
            const toBudget = toTransaction.source === 'left'
              ? this.selectedLeftBudget?.name || 'Left Budget'
              : this.selectedRightBudget?.name || 'Right Budget';

            pairs.push({
              id: `${fromTransaction.id}-${toTransaction.id}`,
              fromTransaction,
              toTransaction,
              fromBudget,
              toBudget,
              amount: Math.abs(fromTransaction.amount),
              daysDifference: Math.round(daysDifference)
            });

            processedTransactions.add(fromTransaction.id);
            processedTransactions.add(toTransaction.id);
          }
        });
      });

      return pairs;
    },

    sortedTransferPairs() {
      // Sort by date (newest first)
      return [...this.transferPairs].sort((a, b) =>
        new Date(b.fromTransaction.date) - new Date(a.fromTransaction.date)
      );
    },

    totalTransferTransactions() {
      return this.transactions.length;
    }
  },
  methods: {
    toggleDetails() {
      this.showDetails = !this.showDetails;
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    formatCurrency(milliunits) {
      if (milliunits === undefined || milliunits === null) {
        return '$0.00';
      }
      const amount = milliunits / 1000;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount);
    }
  }
}
</script>

<style scoped>
.transfer-row {
  transition: all 0.2s ease;
}

.transfer-row:hover {
  background-color: rgba(0,0,0,0.05);
}

.budget-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-info {
  max-width: 200px;
}

.category-name {
  font-weight: 500;
  word-wrap: break-word;
}

.category-group {
  color: #6c757d;
  display: block;
  word-wrap: break-word;
}

.badge {
  font-size: 0.85rem;
  padding: 4px 8px;
  border-radius: 12px;
}

.card {
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  padding: 0.75rem 1.25rem;
  background-color: rgba(0,0,0,0.03);
}

/* CSS variables for budget colors to ensure consistency */
:root {
  --budget-left-color: #8a2be2; /* Purple by default */
  --budget-right-color: #20c997; /* Teal by default */
}

.bg-budget-left {
  background-color: var(--budget-left-color) !important;
}

.bg-budget-right {
  background-color: var(--budget-right-color) !important;
}
</style>
