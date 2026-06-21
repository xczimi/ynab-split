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
                <th>Transactions</th>
                <th>Frequent Words</th>
                <th class="text-end">Total Spending</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="trip in sortedTrips" :key="trip.tripName">
                <tr class="trip-row" @click="toggleTrip(trip.tripName)" style="cursor: pointer;">
                  <td>
                    <i :class="expandedTrips[trip.tripName] ? 'fas fa-chevron-down' : 'fas fa-chevron-right'" class="me-2 text-muted"></i>
                    <span class="badge bg-primary me-1">
                      #{{ trip.tripName }}
                    </span>
                  </td>
                  <td>{{ formatDate(trip.startDate) }}</td>
                  <td>{{ formatDate(trip.endDate) }}</td>
                  <td>{{ trip.transactionCount }}</td>
                  <td>
                    <span v-if="trip.frequentWords && trip.frequentWords.length"
                          class="frequent-words"
                          :title="'Most frequent words from payee and memo fields: ' + trip.frequentWords.join(', ')">
                      {{ trip.frequentWords.join(', ') }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-end text-danger">{{ formatCurrency(trip.totalSpending) }}</td>
                </tr>
                <!-- Category breakdown row -->
                <tr v-if="expandedTrips[trip.tripName] && trip.categoryBreakdown" class="category-breakdown">
                  <td colspan="6" class="p-0">
                    <div class="bg-light p-3">
                      <h6 class="mb-2 text-muted">Spending by Category</h6>
                      <div class="row">
                        <div v-for="[category, data] in trip.categoryBreakdown" :key="category" class="col-md-4 col-sm-6 mb-2">
                          <div class="d-flex justify-content-between align-items-center">
                            <span class="category-name">{{ category }}</span>
                            <span class="category-amount text-danger">{{ formatCurrency(data.amount) }}</span>
                          </div>
                          <small class="text-muted">{{ data.count }} transaction{{ data.count !== 1 ? 's' : '' }}</small>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
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
      showDetails: true,
      expandedTrips: {}
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
    toggleTrip(tripName) {
      this.expandedTrips[tripName] = !this.expandedTrips[tripName];
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

.frequent-words {
  font-size: 0.9rem;
  color: #6c757d;
  font-style: italic;
  max-width: 200px;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-breakdown {
  background-color: #f8f9fa;
}

.category-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.category-amount {
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
