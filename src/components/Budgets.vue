<template>
  <div class="card text-white mb-3" :class="{ 'bg-primary': !budgetId, 'bg-success': total < otherTotal, 'bg-warning': otherTotal < total }" style="max-width: 20rem;">
    <div class="card-header">{{ selectedBudget(budgetId, budgets)?.name }}</div>
    <div v-if="!budgetId" class="budgets container">
      <h4 class="card-title">Select budget</h4>
      <p class="card-text">
        <ul class="list-group">
          <li v-for="budget in budgets" class="list-group-item d-flex justify-content-between align-items-center">
            <a class="col" href="#" @click="selectBudget(budget.id, $event)">
              {{ budget.name }}
            </a>
          </li>
        </ul>
      </p>
    </div>
    <div v-else class="budgets container">
      <h4 class="card-title">Balance {{ convertMilliUnitsToCurrencyAmount(total) }}</h4>
      <div class="card-text">
        <h5>{{ otherTotal > total ? "Owed" : "Owes" }} {{ convertMilliUnitsToCurrencyAmount((otherTotal - total) / 2) }}</h5>
        <a href="#" @click="selectBudget(null, $event)">Change</a>
        <table class="table">
          <thead>
          <tr>
            <th>Category</th>
            <th>Amount</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(transaction,category_name) in transactionsSummary(transactions)" v-bind:key="category_name">
            <td>{{category_name}}</td>
            <td>{{convertMilliUnitsToCurrencyAmount(transaction).toFixed(2)}}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import * as R from 'ramda';
import * as ynab from "ynab";

export default {
  props: ['budgets', 'selectBudget', 'budgetId', 'total', 'otherTotal', 'transactions'],
  methods: {
    selectedBudget(budgetId, budgets) {
      return R.find(R.propEq(budgetId, "id"))(budgets)
    },
    convertMilliUnitsToCurrencyAmount: ynab.utils.convertMilliUnitsToCurrencyAmount,
    transactionsTotal: R.pipe(R.map(R.prop("amount")), R.sum),
    transactionsSummary: R.pipe(R.groupBy(R.prop('category_name')),R.map(R.pipe(R.map(R.prop("amount")),R.sum))),
  }
}
</script>
