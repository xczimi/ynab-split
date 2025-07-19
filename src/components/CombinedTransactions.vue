<template>
  <div class="transaction-container">
    <div v-if="!combinedTransactions.length" class="text-center p-4">
      <p class="text-muted">No transactions to display</p>
    </div>
    <div v-else class="table-responsive">
      <table class="table table-hover">
        <thead class="table-light">
          <tr>
            <th>Budget</th>
            <th>Date</th>
            <th>Category</th>
            <th>Payee</th>
            <th>Memo</th>
            <th class="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transaction in combinedTransactions"
              v-bind:key="transaction.id"
              class="transaction-row"
              :class="{
                'left-budget-row': transaction.source === 'left',
                'right-budget-row': transaction.source === 'right'
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
            <td>{{ transaction.category_name || 'Uncategorized' }}</td>
            <td>{{ transaction.payee_name || '-' }}</td>
            <td>{{ transaction.memo || '-' }}</td>
            <td class="text-end" :class="{'text-danger': transaction.amount < 0, 'text-success': transaction.amount > 0}">
              {{ formatCurrency(transaction.amount) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
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
  computed: {
    combinedTransactions() {
      // Only process if both budget IDs are selected
      if (!this.leftBudgetId || !this.rightBudgetId) {
        return [];
      }

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

      // Combine and sort by date (newest first)
      return [...leftWithSource, ...rightWithSource]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  },
  methods: {
    convertMilliUnitsToCurrencyAmount(milliunits) {
      return milliunits / 1000;
    },
    formatCurrency(milliunits) {
      const amount = this.convertMilliUnitsToCurrencyAmount(milliunits);
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
.transaction-container {
  max-height: 500px;
  overflow-y: auto;
}

.transaction-row:hover {
  background-color: rgba(0,0,0,0.05);
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
</style>
