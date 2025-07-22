<template>
  <div class="card shadow-sm mb-4">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h5 class="mb-0">Household Summary</h5>
      <div class="d-flex align-items-center">
        <span class="badge bg-success me-2" title="Number of months with household expenses">
          {{ monthlyData.length }} Months
        </span>
        <span class="badge bg-info me-3" title="Total number of household transactions">
          {{ totalHouseholdTransactions }} Transactions
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
      <div v-if="!monthlyData.length" class="text-center p-4">
        <p class="text-muted">No household expenses identified yet</p>
        <p class="small text-muted">Transactions with categories containing "bill" are automatically tagged with #household</p>
        <p class="small text-muted">You can also manually add #household to transaction memos</p>
      </div>
      <div v-else>
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Month</th>
                <th>Left Budget</th>
                <th>Right Budget</th>
                <th>Total Transactions</th>
                <th class="text-end">Total Amount</th>
                <th class="text-end">Average per Month</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="month in sortedMonthlyData" :key="month.monthKey" class="household-row">
                <td>
                  <div class="fw-bold">{{ month.monthDisplay }}</div>
                  <small class="text-muted">{{ month.year }}</small>
                </td>
                <td>
                  <div class="d-flex align-items-center">
                    <span class="budget-indicator bg-budget-left me-2"></span>
                    <div>
                      <div class="fw-bold">{{ formatCurrency(month.leftAmount) }}</div>
                      <small class="text-muted">{{ month.leftCount }} transactions</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="d-flex align-items-center">
                    <span class="budget-indicator bg-budget-right me-2"></span>
                    <div>
                      <div class="fw-bold">{{ formatCurrency(month.rightAmount) }}</div>
                      <small class="text-muted">{{ month.rightCount }} transactions</small>
                    </div>
                  </div>
                </td>
                <td>{{ month.totalCount }}</td>
                <td class="text-end">
                  <span class="fw-bold text-danger">{{ formatCurrency(month.totalAmount) }}</span>
                </td>
                <td class="text-end">
                  <span class="text-muted">{{ formatCurrency(month.dailyAverage * 30.44) }}</span>
                  <br>
                  <small class="text-muted">{{ formatCurrency(month.dailyAverage) }}/day</small>
                </td>
              </tr>
            </tbody>
            <tfoot class="table-light">
              <tr class="fw-bold">
                <td>Total</td>
                <td>{{ formatCurrency(totalLeftAmount) }}</td>
                <td>{{ formatCurrency(totalRightAmount) }}</td>
                <td>{{ totalHouseholdTransactions }}</td>
                <td class="text-end">{{ formatCurrency(totalAmount) }}</td>
                <td class="text-end">{{ formatCurrency(overallMonthlyAverage) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HouseholdSummary',
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
    monthlyData() {
      console.log('HouseholdSummary: Processing', this.transactions.length, 'household transactions');

      if (!this.transactions.length) {
        console.log('HouseholdSummary: No transactions to process');
        return [];
      }

      console.log('HouseholdSummary: Sample transaction:', this.transactions[0]);

      const monthlyGroups = {};

      this.transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyGroups[monthKey]) {
          monthlyGroups[monthKey] = {
            monthKey,
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            monthDisplay: date.toLocaleDateString('en-US', { month: 'long' }),
            leftTransactions: [],
            rightTransactions: [],
            leftAmount: 0,
            rightAmount: 0,
            leftCount: 0,
            rightCount: 0,
            totalAmount: 0,
            totalCount: 0
          };
        }

        const group = monthlyGroups[monthKey];
        const amount = Math.abs(transaction.amount); // Use absolute value for spending

        if (transaction.source === 'left') {
          group.leftTransactions.push(transaction);
          group.leftAmount += amount;
          group.leftCount++;
        } else {
          group.rightTransactions.push(transaction);
          group.rightAmount += amount;
          group.rightCount++;
        }

        group.totalAmount += amount;
        group.totalCount++;
      });

      // Add daily average calculation
      const result = Object.values(monthlyGroups).map(group => ({
        ...group,
        daysInMonth: new Date(group.year, group.month, 0).getDate(),
        dailyAverage: group.totalAmount / new Date(group.year, group.month, 0).getDate()
      }));

      console.log('HouseholdSummary: Generated monthly data:', result.length, 'months');
      return result;
    },

    sortedMonthlyData() {
      // Sort by year and month (newest first)
      return [...this.monthlyData].sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year;
        }
        return b.month - a.month;
      });
    },

    totalHouseholdTransactions() {
      return this.transactions.length;
    },

    totalLeftAmount() {
      return this.monthlyData.reduce((sum, month) => sum + month.leftAmount, 0);
    },

    totalRightAmount() {
      return this.monthlyData.reduce((sum, month) => sum + month.rightAmount, 0);
    },

    totalAmount() {
      return this.monthlyData.reduce((sum, month) => sum + month.totalAmount, 0);
    },

    overallMonthlyAverage() {
      if (!this.monthlyData.length) return 0;
      return this.totalAmount / this.monthlyData.length;
    }
  },
  methods: {
    toggleDetails() {
      this.showDetails = !this.showDetails;
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
.household-row {
  transition: all 0.2s ease;
}

.household-row:hover {
  background-color: rgba(0,0,0,0.05);
}

.budget-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
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

/* Table styling for better readability */
tfoot {
  border-top: 2px solid #dee2e6;
}

tfoot td {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}
</style>
