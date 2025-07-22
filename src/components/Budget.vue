<template>
  <div class="card text-white mb-3 shadow h-100" :class="budgetColor" style="width: 100%;">
    <div class="card-header d-flex justify-content-between align-items-center">
      <span>{{ selectedBudget(budgetId, budgets)?.name }}</span>
      <div v-if="loading" class="spinner-border spinner-border-sm text-light" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    <div v-if="!budgetId" class="budgets container p-3">
      <h4 class="card-title text-center mb-3">Select Budget</h4>
      <div class="card-text">
        <div class="list-group shadow-sm">
          <button v-for="budget in budgets"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  @click="handleBudgetSelect(budget.id, $event)">
            <span>{{ budget.name }}</span>
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
    <div v-else class="budgets container p-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="card-title mb-0">Balance</h4>
        <span class="h4 mb-0 badge" :class="{'bg-success': total > 0, 'bg-danger': total < 0}">
          {{ formatCurrency(total) }}
        </span>
      </div>
      <div class="card-text">
        <div class="alert mb-4" :class="{'alert-info': otherTotal > total, 'alert-success': otherTotal <= total}">
          <div class="d-flex justify-content-between">
            <strong>{{ otherTotal > total ? "Owed" : "Owes" }}</strong>
            <span class="text-end">{{ formatCurrency(Math.abs((otherTotal - total) / 2)) }}</span>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center">
          <button class="btn btn-sm btn-outline-light" @click="handleBudgetSelect(null, $event)">
            <i class="fas fa-exchange-alt me-1"></i> Change Budget
          </button>

          <div class="text-end">
            <div class="small text-light-emphasis mb-1">Transactions</div>
            <span class="badge rounded-pill bg-light text-dark">
              {{ transactions.length }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  currencyUtils,
  transactionsTotal,
  findBudgetById,
  getEnhancedTransactions,
  storageUtils,
  errorUtils
} from '../utils/transactions';

export default {
  name: "Budget",
  props: {
    budgets: {
      type: Array,
      default: () => []
    },
    budgetId: {
      type: String,
      default: null
    },
    budgetType: {
      type: String,
      required: true,
      validator: value => ['left', 'right'].includes(value)
    },
    otherTotal: {
      type: Number,
      default: 0
    },
    api: {
      type: Object,
      required: true
    },
    sinceDate: {
      type: String,
      default: "2024-01-01"
    }
  },
  data() {
    return {
      transactions: [],
      loading: false,
      error: null
    };
  },
  computed: {
    total() {
      return transactionsTotal(this.transactions);
    },
    budgetColor() {
      // When no budget is selected, show blue
      if (!this.budgetId) {
        return 'bg-primary';
      }

      // Position-specific classes for left/right budget
      if (this.budgetType === 'left') {
        return 'bg-budget-left';
      } else if (this.budgetType === 'right') {
        return 'bg-budget-right';
      }

      // Default fallback colors based on balance comparison
      return this.total < this.otherTotal ? 'bg-success' : 'bg-warning';
    }
  },
  watch: {
    // Watch for budget ID changes from parent
    budgetId(newId, oldId) {
      if (newId !== oldId) {
        if (newId) {
          this.loadTransactions(newId);
        } else {
          this.transactions = [];
        }
      }
    }
  },
  methods: {
    selectedBudget(budgetId, budgets) {
      return findBudgetById(budgetId, budgets);
    },
    convertMilliUnitsToCurrencyAmount: currencyUtils.convertMilliUnitsToCurrencyAmount,
    transactionsTotal,
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(milliunits);
    },
    async handleBudgetSelect(id, event) {
      event.preventDefault();

      // Emit budget selection to parent
      this.$emit('budget-selected', id);

      // Load transactions if budget was selected
      if (id) {
        await this.loadTransactions(id);
      } else {
        this.transactions = [];
      }
    },
    async loadTransactions(budgetId) {
      console.log(`Loading transactions for ${this.budgetType} budget:`, budgetId);
      this.loading = true;
      this.error = null;
      this.transactions = [];

      // Emit loading state to parent
      this.$emit('budget-loading-changed', {
        budgetType: this.budgetType,
        loading: true
      });

      // Save budget ID to localStorage
      storageUtils.saveBudgetId(this.budgetType, budgetId);

      try {
        this.transactions = await getEnhancedTransactions(this.api, budgetId, this.sinceDate);
        console.log(`${this.budgetType} transactions loaded:`, this.transactions.length);

        // Emit transactions to parent
        this.$emit('transactions-loaded', {
          budgetType: this.budgetType,
          transactions: this.transactions,
          total: this.total
        });
      } catch (err) {
        console.error(`Error fetching ${this.budgetType} transactions:`, err);
        this.error = errorUtils.getErrorMessage(err);

        // Clear saved budget ID on error
        storageUtils.saveBudgetId(this.budgetType, null);

        // Emit error to parent
        this.$emit('budget-error', {
          budgetType: this.budgetType,
          error: this.error
        });
      } finally {
        this.loading = false;

        // Emit loading completion to parent
        this.$emit('budget-loading-changed', {
          budgetType: this.budgetType,
          loading: false
        });
      }
    }
  }
}
</script>

<style scoped>
.card {
  border-radius: 0.5rem;
  overflow: hidden;
}

.card-header {
  font-weight: bold;
  padding: 1rem;
}

.list-group-item-action:hover {
  transform: translateX(5px);
  transition: transform 0.2s;
}

.text-end {
  text-align: right !important;
}

.text-light-emphasis {
  opacity: 0.8;
}

/* Ensure all numeric values are right-aligned */
.badge, .alert span {
  text-align: right;
}

/* CSS variables for budget colors to ensure consistency */
:root {
  --budget-left-color: #8a2be2; /* Purple by default */
  --budget-right-color: #20c997; /* Teal by default */
}

/* Custom budget colors - named by position instead of color */
.bg-budget-left {
  background-color: var(--budget-left-color) !important;
}

.bg-budget-right {
  background-color: var(--budget-right-color) !important;
}

/* Ensure text remains readable on custom backgrounds */
.bg-budget-left, .bg-budget-right {
  color: white !important;
}
</style>
