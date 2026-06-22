<template>
  <div class="card shadow-sm">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h3 class="mb-0"><i class="fas fa-layer-group me-2"></i>Funded Groups</h3>
      <span class="badge bg-secondary">
        {{ headline }}
      </span>
    </div>
    <div class="card-body">
      <div v-if="!transactions.length" class="text-muted">
        No transactions loaded yet.
      </div>
      <template v-else>
        <!-- Open & partial groups: prominent -->
        <div
          v-for="g in openGroups"
          :key="g.key"
          class="d-flex justify-content-between align-items-center border-bottom py-2"
        >
          <div>
            <strong>{{ g.label }}</strong>
            <span class="text-muted small ms-2">{{ g.startDate }} → {{ g.endDate }}</span>
          </div>
          <div class="text-end">
            <span class="me-3">{{ owedLabel(g.net) }}</span>
            <span class="badge" :class="g.status === 'open' ? 'bg-warning text-dark' : 'bg-primary'">
              {{ g.status === 'open' ? 'open' : `${g.settledCount} of ${g.count} settled` }}
            </span>
          </div>
        </div>

        <div v-if="!openGroups.length" class="text-muted small py-2">
          All groups settled — you're square.
        </div>

        <!-- Authoritative bottom line (matches the budget-card Owes/Owed) -->
        <div class="d-flex justify-content-between fw-bold border-top pt-2 mt-3">
          <span>Net owed</span><span>{{ owedLabel(net) }}</span>
        </div>

        <!-- Settled groups: collapsed / greyed -->
        <div v-if="settledGroups.length" class="mt-3">
          <button class="btn btn-sm btn-outline-secondary" @click="showSettled = !showSettled">
            {{ showSettled ? 'Hide' : 'Show' }} {{ settledGroups.length }} settled groups
          </button>
          <div v-if="showSettled" class="mt-2">
            <div
              v-for="g in settledGroups"
              :key="g.key"
              class="d-flex justify-content-between text-muted small py-1"
            >
              <span>{{ g.label }} <span class="ms-2">{{ g.startDate }} → {{ g.endDate }}</span></span>
              <span>{{ formatCurrency(Math.abs(g.net)) }} · settled</span>
            </div>
          </div>
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
  data() {
    return { showSettled: false };
  },
  computed: {
    summary() {
      return summarizeGroups(this.transactions, { leftName: this.leftName, rightName: this.rightName });
    },
    net() { return this.summary.net; },
    openGroups() {
      return this.summary.groups.filter(g => g.status !== 'settled');
    },
    settledGroups() {
      return this.summary.groups.filter(g => g.status === 'settled');
    },
    headline() {
      const amount = Math.abs(this.net);
      const from = this.net >= 0 ? this.rightName : this.leftName;
      const to   = this.net >= 0 ? this.leftName  : this.rightName;
      return `${from} owes ${to} ${this.formatCurrency(amount)}`;
    },
  },
  methods: {
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(milliunits);
    },
    owedLabel(net) {
      if (net === 0) return 'even';
      const who = net >= 0 ? this.rightName : this.leftName;
      return `${who} owes ${this.formatCurrency(Math.abs(net))}`;
    },
  },
};
</script>
