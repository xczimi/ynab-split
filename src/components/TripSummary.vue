<template>
  <div class="card shadow-sm mb-4">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h5 class="mb-0">Trip Summary</h5>
      <div class="d-flex align-items-center">
        <span class="badge bg-primary me-2" title="Number of unique trips identified by #trip hashtags">
          {{ trips.length }} Trips
        </span>
        <span class="badge bg-info me-3" title="Number of transactions that have been assigned to trips">
          {{ transactionsWithTrips }} Transactions in Trips
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
      <div v-if="!trips.length" class="text-center p-4">
        <p class="text-muted">No trips identified yet</p>
        <p class="small text-muted">Add hashtags starting with #trip to transaction memos (e.g., #tripHawaii, #trip_europe)</p>
        <p class="small text-muted">Use #household or #transfer to exclude transactions from trips</p>
      </div>
      <div v-else>
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Trip</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Transactions</th>
                <th class="text-end">Total Spending</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trip in sortedTrips" :key="trip.name" class="trip-row">
                <td>
                  <span class="badge bg-primary me-1">
                    #{{ trip.name }}
                    <i class="fas fa-hashtag ms-1" title="Trip identified by hashtag"></i>
                  </span>
                </td>
                <td>{{ formatDate(trip.startDate) }}</td>
                <td>{{ formatDate(trip.endDate) }}</td>
                <td>{{ calculateDuration(trip.startDate, trip.endDate) }}</td>
                <td>{{ trip.transactionCount }}</td>
                <td class="text-end text-danger">{{ formatCurrency(trip.totalSpending) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TripSummary',
  props: {
    trips: {
      type: Array,
      default: () => []
    },
    transactionsWithTrips: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      showDetails: true
    };
  },
  computed: {
    sortedTrips() {
      // Sort trips by start date (newest first)
      return [...this.trips].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    }
  },
  methods: {
    toggleDetails() {
      this.showDetails = !this.showDetails;
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    calculateDuration(startDate, endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
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
.trip-row {
  transition: all 0.2s ease;
}

.trip-row:hover {
  background-color: rgba(0,0,0,0.05);
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
</style>
