<template>
  <div class="transaction-container">
    <div v-if="!transactions.length" class="text-center p-4">
      <p class="text-muted">No transactions to display</p>
    </div>
    <div v-else class="table-responsive">
      <table class="table table-striped table-hover">
        <thead class="table-light">
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Payee</th>
            <th>Memo</th>
            <th class="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transaction in transactions" v-bind:key="transaction.id" class="transaction-row">
            <td>{{transaction.date}}</td>
            <td>{{transaction.category_name || 'Uncategorized'}}</td>
            <td>{{transaction.payee_name || '-'}}</td>
            <td>{{transaction.memo || '-'}}</td>
            <td class="text-end" :class="{'text-danger': transaction.amount < 0, 'text-success': transaction.amount > 0}">
              {{formatCurrency(transaction.amount)}}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
// Import utils from YNAB
import {utils} from 'ynab';
import * as R from 'ramda';

export default {
  props: ['transactions'],
  methods: {
    // Now we can make this method available to our template
    // So we can format this milliunits in the correct currency format
    convertMilliUnitsToCurrencyAmount: utils.convertMilliUnitsToCurrencyAmount,
    transactionsTotal: R.pipe(R.map(R.prop("amount")),R.sum),
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
  max-height: 400px;
  overflow-y: auto;
}

.transaction-row:hover {
  background-color: rgba(0,0,0,0.05);
}

table {
  margin-bottom: 0;
}
</style>
