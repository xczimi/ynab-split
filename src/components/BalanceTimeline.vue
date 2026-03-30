<template>
  <div class="card shadow-sm mb-4">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h5 class="mb-0">Balance Timeline</h5>
      <div class="d-flex align-items-center">
        <span class="badge bg-info me-3" title="Current settlement balance">
          {{ formatCurrency(currentBalance) }}
        </span>
        <button
          @click="toggleDetails"
          class="btn btn-sm btn-outline-secondary"
          :title="showDetails ? 'Hide Chart' : 'Show Chart'"
        >
          <i :class="showDetails ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
        </button>
      </div>
    </div>
    <div v-show="showDetails" class="card-body">
      <div v-if="!transactions.length" class="text-center p-4">
        <p class="text-muted">No transactions to display</p>
      </div>
      <div v-else>
        <canvas ref="chartCanvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script>
import { Chart, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
Chart.register(...registerables, annotationPlugin);

// Color palette for trip regions
const TRIP_COLORS = [
  '99, 102, 241',   // Indigo
  '236, 72, 153',   // Pink
  '34, 197, 94',    // Green
  '251, 146, 60',   // Orange
  '14, 165, 233',   // Sky blue
  '168, 85, 247',   // Purple
  '234, 179, 8',    // Yellow
  '239, 68, 68'     // Red
];

export default {
  name: 'BalanceTimeline',
  props: {
    transactions: {
      type: Array,
      default: () => []
    },
    leftColor: {
      type: String,
      default: '#0d6efd'
    },
    rightColor: {
      type: String,
      default: '#198754'
    },
    leftBudgetName: {
      type: String,
      default: 'Left Budget'
    },
    rightBudgetName: {
      type: String,
      default: 'Right Budget'
    }
  },
  data() {
    return {
      showDetails: false,
      chart: null
    };
  },
  computed: {
    sortedTransactions() {
      // Sort transactions by date (oldest first)
      return [...this.transactions].sort((a, b) => {
        return a.date.localeCompare(b.date);
      });
    },
    chartData() {
      let runningBalance = 0;
      const dataPoints = [];

      this.sortedTransactions.forEach(t => {
        runningBalance += (t.source === 'left' ? t.amount : -t.amount);
        dataPoints.push({
          date: t.date,
          balance: runningBalance / 2  // Settlement amount
        });
      });

      return dataPoints;
    },
    currentBalance() {
      if (this.chartData.length === 0) return 0;
      return this.chartData[this.chartData.length - 1].balance;
    },
    tripRegions() {
      // Group transactions by tripName to find date ranges
      const trips = {};
      this.sortedTransactions.forEach(t => {
        if (t.tripName) {
          if (!trips[t.tripName]) {
            trips[t.tripName] = { startDate: t.date, endDate: t.date, name: t.tripName };
          } else {
            if (t.date < trips[t.tripName].startDate) trips[t.tripName].startDate = t.date;
            if (t.date > trips[t.tripName].endDate) trips[t.tripName].endDate = t.date;
          }
        }
      });
      return Object.values(trips);
    }
  },
  watch: {
    showDetails(newVal) {
      if (newVal && this.transactions.length > 0) {
        this.$nextTick(() => {
          this.renderChart();
        });
      }
    },
    transactions: {
      handler() {
        if (this.showDetails && this.transactions.length > 0) {
          this.$nextTick(() => {
            this.renderChart();
          });
        }
      },
      deep: true
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
    },
    renderChart() {
      const canvas = this.$refs.chartCanvas;
      if (!canvas) return;

      // Destroy existing chart if it exists
      if (this.chart) {
        this.chart.destroy();
      }

      const ctx = canvas.getContext('2d');
      const data = this.chartData;

      // Get unique dates and aggregate balances by date
      const dateBalances = {};
      data.forEach(point => {
        dateBalances[point.date] = point.balance;
      });

      const labels = Object.keys(dateBalances);
      const values = Object.values(dateBalances);

      // Prepare bar data for transactions by source
      const leftBarData = labels.map(date => {
        const dayTransactions = this.sortedTransactions.filter(t => t.date === date && t.source === 'left');
        const total = dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return total / 1000; // Convert to dollars
      });

      const rightBarData = labels.map(date => {
        const dayTransactions = this.sortedTransactions.filter(t => t.date === date && t.source === 'right');
        const total = dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return total / 1000; // Convert to dollars
      });

      // Build annotations for trip regions
      const annotations = {};
      this.tripRegions.forEach((trip, index) => {
        const color = TRIP_COLORS[index % TRIP_COLORS.length];
        annotations[`trip${index}`] = {
          type: 'box',
          xMin: trip.startDate,
          xMax: trip.endDate,
          backgroundColor: `rgba(${color}, 0.15)`,
          borderColor: `rgba(${color}, 0.5)`,
          borderWidth: 1,
          label: {
            display: true,
            content: '#' + trip.name,
            position: { x: 'start', y: 'start' },
            font: { size: 11, weight: 'bold' },
            color: `rgb(${color})`,
            padding: 4
          }
        };
      });

      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              type: 'line',
              label: 'Settlement Balance',
              data: values.map(v => v / 1000), // Convert milliunits to currency
              borderColor: '#6c757d',
              backgroundColor: 'rgba(108, 117, 125, 0.1)',
              fill: true,
              tension: 0.1,
              pointRadius: 3,
              pointHoverRadius: 6,
              yAxisID: 'y',
              order: 0 // Draw line on top
            },
            {
              type: 'bar',
              label: this.leftBudgetName,
              data: leftBarData,
              backgroundColor: this.leftColor + '80',
              borderColor: this.leftColor,
              borderWidth: 1,
              yAxisID: 'y1',
              order: 1
            },
            {
              type: 'bar',
              label: this.rightBudgetName,
              data: rightBarData,
              backgroundColor: this.rightColor + '80',
              borderColor: this.rightColor,
              borderWidth: 1,
              yAxisID: 'y1',
              order: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2.5,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                boxWidth: 8
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y;
                  return this.formatCurrency(value * 1000);
                },
                title: (tooltipItems) => {
                  return tooltipItems[0].label;
                }
              }
            },
            annotation: {
              annotations: annotations
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Date'
              },
              ticks: {
                maxTicksLimit: 10,
                maxRotation: 45,
                minRotation: 0
              }
            },
            y: {
              type: 'linear',
              position: 'left',
              title: {
                display: true,
                text: 'Balance ($)'
              },
              ticks: {
                callback: (value) => {
                  return '$' + value.toFixed(0);
                }
              }
            },
            y1: {
              type: 'linear',
              position: 'right',
              title: {
                display: true,
                text: 'Transaction ($)'
              },
              ticks: {
                callback: (value) => {
                  return '$' + value.toFixed(0);
                }
              },
              grid: {
                drawOnChartArea: false
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });
    }
  },
  beforeUnmount() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
</script>

<style scoped>
.card {
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  padding: 0.75rem 1.25rem;
  background-color: rgba(0,0,0,0.03);
}

.badge {
  font-size: 0.85rem;
  padding: 4px 8px;
  border-radius: 12px;
}

canvas {
  max-height: 300px;
}
</style>
