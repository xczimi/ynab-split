<template>
  <div class="card shadow-sm">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h3 class="mb-0"><i class="fas fa-layer-group me-2"></i>Funded Groups</h3>
      <span class="badge bg-secondary">{{ balanceText(net) }}</span>
    </div>
    <div class="card-body">
      <div v-if="!transactions.length" class="text-muted">
        No transactions loaded yet.
      </div>
      <template v-else>
        <p class="text-muted small mb-2">
          Running who-owes-whom balance after each trip / quarter — follow it down to today's total.
        </p>
        <div
          v-for="g in groups"
          :key="g.key"
          class="d-flex justify-content-between align-items-center border-bottom py-2"
          :class="{ 'opacity-75': g.status === 'settled' }"
        >
          <div>
            <strong :class="{ 'fw-normal text-muted': g.status === 'settled' }">{{ g.label }}</strong>
            <span class="small text-muted ms-2">{{ g.startDate }} → {{ g.endDate }}</span>
            <span class="d-block small text-muted">this period: {{ balanceText(g.net) }}</span>
          </div>
          <div class="text-end">
            <div :class="g.runningBalance >= 0 ? 'text-success' : 'text-danger'">
              {{ balanceText(g.runningBalance) }}
            </div>
            <span
              class="badge mt-1"
              :class="g.status === 'settled' ? 'bg-light text-secondary border'
                    : g.status === 'open' ? 'bg-warning text-dark' : 'bg-primary'"
            >
              {{ statusLabel(g) }}
            </span>
          </div>
        </div>

        <div class="d-flex justify-content-between fw-bold border-top pt-2 mt-3">
          <span>Net owed today</span><span>{{ balanceText(net) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { currencyUtils } from '../utils/transactions';
import { summarizeGroups } from '../utils/designations/index.js';

export default {
  name: 'FundedGroups',
  props: {
    transactions: { type: Array, default: () => [] },
    leftName: { type: String, default: 'Left' },
    rightName: { type: String, default: 'Right' },
  },
  computed: {
    summary() {
      return summarizeGroups(this.transactions, { leftName: this.leftName, rightName: this.rightName });
    },
    net() { return this.summary.net; },
    groups() { return this.summary.groups; },
  },
  methods: {
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(Math.abs(milliunits));
    },
    // who-owes-whom for a signed balance (positive = right owes left)
    balanceText(amount) {
      if (amount === 0) return 'square';
      const ower = amount > 0 ? this.rightName : this.leftName;
      const owed = amount > 0 ? this.leftName : this.rightName;
      return `${ower} owes ${owed} ${this.formatCurrency(amount)}`;
    },
    statusLabel(g) {
      if (g.status === 'settled') return 'settled';
      if (g.status === 'open') return 'open';
      return `${g.settledCount} of ${g.count} settled`;
    },
  },
};
</script>
