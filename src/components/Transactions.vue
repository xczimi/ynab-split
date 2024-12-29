<template>
  <div class="container">
    <h5>Transactions</h5>
    <table class="table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Category</th>
        <th>Payee</th>
        <th>Memo</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="transaction in transactions" v-bind:key="transaction.id">
        <td>{{transaction.date}}</td>
        <td>{{transaction.category_name}}</td>
        <td>{{transaction.payee_name}}</td>
        <td>{{transaction.memo}}</td>
        <td>{{convertMilliUnitsToCurrencyAmount(transaction.amount).toFixed(2)}}</td>
      </tr>
    </tbody>
    </table>
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
    transactionsTotal: R.pipe(R.map(R.prop("amount")),R.sum)
  }
}
</script>
