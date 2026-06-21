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

        <!-- Reconciliation: open tail + residual = net -->
        <div v-if="openGroups.length" class="d-flex justify-content-between small text-muted mt-3">
          <span>Open &amp; partial total</span><span>{{ formatCurrency(openTailTotal) }}</span>
        </div>
        <div v-if="openGroups.length" class="d-flex justify-content-between small text-muted">
          <span>Earlier settle-up residual</span><span>{{ formatCurrency(residual) }}</span>
        </div>
        <div class="d-flex justify-content-between fw-bold border-top pt-2 mt-1">
          <span>Net owed</span><span>{{ formatCurrency(net) }}</span>
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
    openTailTotal() { return this.summary.openTailTotal; },
    residual() { return this.summary.residual; },
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
