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
// Import utils from our transaction utilities instead of direct YNAB SDK
import { currencyUtils, transactionsTotal } from '../utils/transactions';
// Import hashtag utilities from designator for transfer detection
import { extractHashtags } from '../utils/designator';

export default {
  props: ['transactions'],
  methods: {
    isTransferCategory(transaction) {
      // Check if this is a transfer transaction using the new designator utilities
      const hashtags = extractHashtags(transaction);
      const hasTransferTag = hashtags.some(tag => tag.toLowerCase() === 'transfer');

      if (hasTransferTag) {
        return true;
      }

      // Otherwise check category, memo and payee
      const category = (transaction.category_name || '').toLowerCase();
      const memo = (transaction.memo || '').toLowerCase();
      const payee = (transaction.payee_name || '').toLowerCase();

      return category.includes('transfer') ||
             memo.includes('transfer') ||
             payee.includes('transfer');
    },
    // Now we can make this method available to our template
    // So we can format this milliunits in the correct currency format
    convertMilliUnitsToCurrencyAmount: currencyUtils.convertMilliUnitsToCurrencyAmount,
    transactionsTotal,
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(milliunits);
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

table {
  margin-bottom: 0;
}
</style>
