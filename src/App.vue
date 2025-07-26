<template>
  <div id="app">
    <Nav/>
    <div class="container py-4">

      <!-- Display a loading message if loading -->
      <div v-if="loading" class="text-center my-5">
        <h1 class="display-4">Loading...</h1>
        <div class="spinner-border mt-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <!-- Display an error if we got one -->
      <div v-if="error" class="alert alert-danger p-4 mt-4">
        <h1 class="display-4">Oops!</h1>
        <p class="lead">{{ error }}</p>
        <div class="mt-3">
          <button class="btn btn-primary me-2" @click="resetToken(true)">Try Again &gt;</button>
          <button class="btn btn-outline-secondary" @click="logout">Logout</button>
        </div>
      </div>

      <!-- Otherwise show our app contents -->
      <div v-else class="fade-in">

        <!-- If we dont have a token ask the user to authorize with YNAB -->
        <form v-if="!ynab.token">
          <h1 class="display-4">Congrats!</h1>
          <p class="lead">You have successfully initialized a new YNAB API Application!</p>
          <p>The next step is the OAuth configuration, you can
            <a
              href="https://github.com/ynab/ynab-api-starter-kit#step-2-obtain-an-oauth-client-id-so-the-app-can-access-the-ynab-api">read
              detailed instructions in the README.md</a>. Essentially:</p>
          <ul>
            <li>Make sure to be logged into your YNAB account, go to your <a
              href="https://app.ynab.com/settings/developer" target="_blank" rel="noopener noreferrer">YNAB Developer
              Settings</a> and create a new OAuth Application.
            </li>
            <li>Enter the URL of this project as a Redirect URI (in addition to the existing three options), then "Save
              Application."
            </li>
            <li>Copy your Client ID and Redirect URI into the <em>src/config.json</em> file of your project.</li>
            <li>Then build your amazing app!</li>
          </ul>
          <p>If you have any questions please reach out to us at <strong>api@ynab.com</strong>.</p>
          <p>&nbsp;</p>

          <div class="form-group">
            <h2>Hello!</h2>
            <p class="lead">If you would like to use this App, please authorize with YNAB!</p>
            <button @click="authorizeWithYNAB" class="btn btn-primary">Authorize This App With YNAB &gt;</button>
          </div>
        </form>
        <!-- Otherwise if we have a token, show the budget selects and transactions -->
        <div v-else>
          <div class="row mb-4">
            <div class="col-md-6 mb-4 mb-md-0">
              <Budget
                :budgets="budgets"
                :budgetId="leftBudgetId"
                budgetType="left"
                :otherTotal="rightTotal"
                :api="api"
                :sinceDate="sinceDate"
                @budget-selected="handleLeftBudgetSelected"
                @transactions-loaded="handleTransactionsLoaded"
                @budget-error="handleBudgetError"
                @budget-loading-changed="handleBudgetLoadingChanged"
                @color-selected="handleBudgetColorSelected"
              />
            </div>
            <div class="col-md-6">
              <Budget
                :budgets="budgets"
                :budgetId="rightBudgetId"
                budgetType="right"
                :otherTotal="leftTotal"
                :api="api"
                :sinceDate="sinceDate"
                @budget-selected="handleRightBudgetSelected"
                @transactions-loaded="handleTransactionsLoaded"
                @budget-error="handleBudgetError"
                @budget-loading-changed="handleBudgetLoadingChanged"
                @color-selected="handleBudgetColorSelected"
              />
            </div>
          </div>
                      <!-- Trip Summary Section -->
                      <div v-if="leftBudgetId && rightBudgetId" class="row mb-4">
            <div class="col-12">
              <TripSummary
                :transactions="tripTransactions"
                :trips="tripSummaryData.trips"
                :transactionsWithTrips="tripSummaryData.transactionsWithTrips"
                @identify-trips="identifyTrips"
              />
            </div>
          </div>

          <!-- Transfer Summary Section -->
          <div v-if="leftBudgetId && rightBudgetId" class="row mb-4">
            <div class="col-12">
              <TransferSummary
                :transactions="transferTransactions"
                :allTransactions="transactionsWithDesignations"
                :selectedLeftBudget="selectedBudget(leftBudgetId, budgets)"
                :selectedRightBudget="selectedBudget(rightBudgetId, budgets)"
              />
            </div>
          </div>

          <!-- Household Summary Section -->
          <div v-if="leftBudgetId && rightBudgetId" class="row mb-4">
            <div class="col-12">
              <HouseholdSummary
                :transactions="householdTransactions"
                :allTransactions="transactionsWithDesignations"
                :selectedLeftBudget="selectedBudget(leftBudgetId, budgets)"
                :selectedRightBudget="selectedBudget(rightBudgetId, budgets)"
              />
            </div>
          </div>

          <div class="row">
            <div class="col-12">
              <div class="card shadow-sm">
                <div class="card-header bg-light">
                  <h3 class="mb-0">Combined Transactions</h3>
                </div>
                <div class="card-body p-0">
                  <CombinedTransactions
                    ref="combinedTransactions"
                    :transactions="transactionsWithDesignations"
                    :loading="false"
                    @trips-identified="handleTripsIdentified"
                    @trips-reset="resetTrips"
                    @transaction-updated="handleTransactionUpdated"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer class="mt-5"/>
    </div>
  </div>
</template>

<style>
.fade-in {
  animation: fadeIn 0.5s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.card {
  transition: transform 0.3s, box-shadow 0.3s;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}
</style>

<script>
// Import our transaction utilities instead of direct YNAB SDK
import {
  initializeYnabApi,
  getBudgets,
  getEnhancedTransactions,
  currencyUtils,
  transactionsTotal,
  findBudgetById,
  tokenUtils,
  storageUtils,
  errorUtils,
  sortingUtils
} from './utils/transactions';

// Import transaction designation utilities
import {
  addHashtagsToTransactions,
  processTransactionsWithTrips,
  getTripSummaries
} from './utils/designator';

// Import trip-specific functions from the new trips utility
import {
  DEFAULT_TRIP_SETTINGS
} from './utils/trips';

// Import our config for YNAB
import config from './config.json';

// Import Our Components to Compose Our App
import Nav from './components/Nav.vue';
import Footer from './components/Footer.vue';
import Budget from './components/Budget.vue';
import Transactions from './components/Transactions.vue';
import CombinedTransactions from './components/CombinedTransactions.vue';
import TripSummary from './components/TripSummary.vue';
import TransferSummary from './components/TransferSummary.vue';
import HouseholdSummary from './components/HouseholdSummary.vue';

export default {
  // The data to feed our templates
  data() {
    return {
      ynab: {
        clientId: config.clientId,
        // Use environment variable if available, otherwise fall back to config values
        redirectUri: this.getRedirectUri(),
        token: null,
        api: null,
      },
      loading: false,
      error: null,
      sinceDate: "2024-01-01",
      leftBudgetId: null,
      leftTransactions: [],
      leftTotal: 0,
      leftBudgetLoading: false, // Track left budget loading state
      rightBudgetId: null,
      rightTransactions: [],
      rightTotal: 0,
      rightBudgetLoading: false, // Track right budget loading state
      budgets: [],
      // New combined data model
      combinedTransactions: [], // All transactions with designations
      processedTransactions: [], // Transactions with trip/transfer/household tags
      tripSummaryData: {
        trips: [],
        transactionsWithTrips: 0
      },
      // Add manual trip processing control
      manualTripProcessingEnabled: false,
      // Budget color management
      budgetColors: {
        left: 'bg-primary',
        right: 'bg-success'
      }
    }
  },
  // When this component is created, check whether we need to get a token,
  // budgets or display the transactions
  created() {
    console.log('App component created');
    this.ynab.token = tokenUtils.findYNABToken();
    console.log('YNAB token found:', this.ynab.token ? 'Yes' : 'No');
    if (this.ynab.token) {
      this.api = initializeYnabApi(this.ynab.token);

      // Get budgets first, then load saved budget IDs
      this.getBudgets();
    }

    // Load saved budget colors on startup
    this.loadSavedBudgetColors();
  },
  mounted() {
    // Apply initial budget colors to CSS variables
    this.updateBudgetColorVariables();
  },
  computed: {
    // Combined transactions from both budgets
    allTransactions() {
      const combined = [
        ...this.leftTransactions.map(t => ({ ...t, source: 'left' })),
        ...this.rightTransactions.map(t => ({ ...t, source: 'right' }))
      ];

      // Use centralized sorting utility from transactions.js
      return sortingUtils.sortNewestFirst(combined);
    },

    // Transactions with designations (transfer, household, trips)
    transactionsWithDesignations() {
      // Only process designations when both budgets are selected and have completed loading
      if (this.allTransactions.length === 0) return [];

      // Check if both budgets are selected
      const bothBudgetsSelected = this.leftBudgetId && this.rightBudgetId;
      const bothBudgetsLoaded = !this.leftBudgetLoading && !this.rightBudgetLoading;

      if (!bothBudgetsSelected || !bothBudgetsLoaded) {
        console.log('Waiting for both budgets to be selected and fully loaded before processing designations');

        // Return transactions without designations
        return this.allTransactions.map(transaction => ({
          ...transaction,
          hashtags: [],
          relevantHashtags: [],
          hasTripTag: false,
          hasHouseholdTag: false,
          hasTransferTag: false,
          tripName: null,
          budgetName: transaction.source === 'left'
            ? this.selectedBudget(this.leftBudgetId, this.budgets)?.name || 'Left Budget'
            : this.selectedBudget(this.rightBudgetId, this.budgets)?.name || 'Right Budget'
        }));
      }

      console.log('Processing', this.allTransactions.length, 'transactions');

      // Add automatic hashtags and process transactions
      const transactionsWithHashtags = addHashtagsToTransactions(this.allTransactions);
      console.log('After hashtag processing:', transactionsWithHashtags.length, 'transactions');

      // Automatically process trips when both budgets are loaded
      const processedForTrips = processTransactionsWithTrips(transactionsWithHashtags);
      console.log('After trip processing:', processedForTrips.length, 'transactions');

      // Add budget names to the processed transactions
      return processedForTrips.map(transaction => ({
        ...transaction,
        budgetName: transaction.source === 'left'
          ? this.selectedBudget(this.leftBudgetId, this.budgets)?.name || 'Left Budget'
          : this.selectedBudget(this.rightBudgetId, this.budgets)?.name || 'Right Budget'
      }));
    },

    // Filtered transaction lists for summary components
    transferTransactions() {
      const transfers = this.transactionsWithDesignations.filter(t => t.hasTransferTag);
      console.log('Transfer transactions:', transfers.length);
      return transfers;
    },

    householdTransactions() {
      const household = this.transactionsWithDesignations.filter(t => t.hasHouseholdTag);
      console.log('Household transactions for component:', household.length);
      if (household.length > 0) {
        console.log('Sample household transaction:', household[0]);
      }
      return household;
    },

    tripTransactions() {
      const trips = this.transactionsWithDesignations.filter(t => t.tripName);
      console.log('Trip transactions:', trips.length);
      return trips;
    }
  },
  watch: {
    // Watch for changes in combined transactions to update trip summaries
    transactionsWithDesignations: {
      handler(newTransactions) {
        if (newTransactions.length > 0) {
          // Update trip summary data automatically
          const trips = getTripSummaries(newTransactions);
          const transactionsWithTrips = newTransactions.filter(t => t.tripName).length;

          this.tripSummaryData = {
            trips,
            transactionsWithTrips
          };
        }
      },
      immediate: true
    }
  },
  methods: {
    convertMilliUnitsToCurrencyAmount: currencyUtils.convertMilliUnitsToCurrencyAmount,
    transactionsTotal,
    selectedBudget(budgetId, budgets) {
      return findBudgetById(budgetId, budgets);
    },
    formatCurrency(milliunits) {
      return currencyUtils.formatCurrency(milliunits);
    },
    // This uses the YNAB API to get a list of budgets
    async getBudgets() {
      console.log('Getting budgets from YNAB API');
      this.loading = true;
      this.error = null;
      try {
        this.budgets = await getBudgets(this.api);

        // After budgets are loaded, restore saved budget IDs
        const savedLeftBudgetId = storageUtils.getSavedBudgetId('left');
        const savedRightBudgetId = storageUtils.getSavedBudgetId('right');

        if (savedLeftBudgetId) {
          console.log('Restoring saved left budget ID:', savedLeftBudgetId);
          this.leftBudgetId = savedLeftBudgetId;
        }
        if (savedRightBudgetId) {
          console.log('Restoring saved right budget ID:', savedRightBudgetId);
          this.rightBudgetId = savedRightBudgetId;
        }
      } catch (err) {
        console.error('Error fetching budgets:', err);
        // Check if this is an authentication error
        if (errorUtils.isAuthError(err)) {
          // If unauthorized, we need to refresh the token
          console.log('Unauthorized error, token may have expired');
          this.logout(); // Full logout for auth errors
        } else {
          // For other errors, keep the token but show the error
          this.error = errorUtils.getErrorMessage(err);
        }
      } finally {
        this.loading = false;
      }
    },
    // This builds a URI to get an access token from YNAB
    // https://api.ynab.com/#outh-applications
    authorizeWithYNAB(e) {
      console.log('Authorizing with YNAB');
      e.preventDefault();
      const uri = tokenUtils.buildAuthUrl(this.ynab.clientId, this.ynab.redirectUri);
      console.log('Redirect URI:', this.ynab.redirectUri);
      location.replace(uri);
    },
    // Method to find a YNAB token
    // First it looks in the location.hash and then sessionStorage
    findYNABToken() {
      return tokenUtils.findYNABToken();
    },
    // Reset application state but keep auth token when there's an error
    resetToken(keepAuth = true) {
      console.log('Resetting application state, keepAuth:', keepAuth);

      // Only remove the token if explicitly requested (for logout)
      if (!keepAuth) {
        console.log('Removing YNAB authentication token');
        tokenUtils.removeToken();
        this.ynab.token = null;
      }

      // Always clear budget selections on reset
      storageUtils.clearBudgetIds();
      this.leftBudgetId = null;
      this.rightBudgetId = null;
      this.leftTransactions = [];
      this.rightTransactions = [];
      this.leftTotal = 0;
      this.rightTotal = 0;
      this.error = null;
      console.log('Application reset complete');
    },

    // Completely log out (clear token and state)
    logout() {
      console.log('Logging out');
      this.resetToken(false); // false = don't keep auth
      // Force page reload to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 100);
    },

    // Get the redirect URI from environment variables or config
    getRedirectUri() {
      // Check for environment variable
      if (process.env.VUE_APP_REDIRECT_URI) {
        console.log('Using redirect URI from environment variable:', process.env.VUE_APP_REDIRECT_URI);
        return process.env.VUE_APP_REDIRECT_URI;
      }

      // Fall back to default config value
      console.log('Using default redirect URI from config:', config.redirectUri);
      return config.redirectUri;
    },

    // Handler for trips-identified event from CombinedTransactions
    handleTripsIdentified() {
      console.log('Manual trip identification triggered');
      // Enable manual trip processing
      this.manualTripProcessingEnabled = true;

      // Force reactive update of transactionsWithDesignations
      this.$nextTick(() => {
        // Update trip summary data
        const trips = getTripSummaries(this.transactionsWithDesignations);
        const transactionsWithTrips = this.transactionsWithDesignations.filter(t => t.tripName).length;

        this.tripSummaryData = {
          trips,
          transactionsWithTrips
        };

        console.log('Trip identification complete:', trips.length, 'trips found');
      });
    },

    // Method to trigger trip identification manually
    identifyTrips() {
      console.log('Triggering manual trip identification');
      this.handleTripsIdentified();
    },

    // Method to reset trips
    resetTrips() {
      console.log('Resetting trips');
      this.manualTripProcessingEnabled = false;

      // Clear trip summary data
      this.tripSummaryData = {
        trips: [],
        transactionsWithTrips: 0
      };

      // Automatically trigger trip identification after reset
      this.$nextTick(() => {
        console.log('Auto-triggering trip identification after reset');
        this.handleTripsIdentified();
      });
    },
    handleLeftBudgetSelected(budgetId) {
      this.leftBudgetId = budgetId;
    },
    handleRightBudgetSelected(budgetId) {
      this.rightBudgetId = budgetId;
    },
    handleTransactionsLoaded({ budgetType, transactions, total }) {
      console.log(`Transactions loaded for ${budgetType} budget:`, transactions.length);

      if (budgetType === 'left') {
        this.leftTransactions = transactions;
        this.leftTotal = total;
      } else if (budgetType === 'right') {
        this.rightTransactions = transactions;
        this.rightTotal = total;
      }
    },
    handleBudgetError({ budgetType, error }) {
      console.error(`Error for ${budgetType} budget:`, error);
      this.error = `Error loading ${budgetType} budget: ${error}`;
    },
    handleBudgetLoadingChanged({ budgetType, loading }) {
      console.log(`Budget loading changed - ${budgetType} budget:`, loading);

      if (budgetType === 'left') {
        this.leftBudgetLoading = loading;
      } else if (budgetType === 'right') {
        this.rightBudgetLoading = loading;
      }
    },

    // New method to handle transaction updates from components
    handleTransactionUpdated(updatedTransaction) {
      console.log('Transaction updated:', updatedTransaction);

      // Find and update the transaction in the appropriate array
      if (updatedTransaction.source === 'left') {
        const index = this.leftTransactions.findIndex(t => t.id === updatedTransaction.id);
        if (index !== -1) {
          this.leftTransactions.splice(index, 1, updatedTransaction);
        }
      } else if (updatedTransaction.source === 'right') {
        const index = this.rightTransactions.findIndex(t => t.id === updatedTransaction.id);
        if (index !== -1) {
          this.rightTransactions.splice(index, 1, updatedTransaction);
        }
      }

      // The computed properties will automatically update
    },

    // Method to update trip summaries when needed
    updateTripSummaries() {
      if (this.transactionsWithDesignations.length > 0) {
        const trips = getTripSummaries(this.transactionsWithDesignations);
        const transactionsWithTrips = this.transactionsWithDesignations.filter(t => t.tripName).length;

        this.tripSummaryData = {
          trips,
          transactionsWithTrips
        };
      }
    },

    // Handle budget color selection from Budget components
    handleBudgetColorSelected({ budgetType, color }) {
      console.log(`Budget color selected for ${budgetType}:`, color);

      // Update local budget colors
      this.budgetColors[budgetType] = color;

      // Update CSS variables immediately for visual feedback
      this.updateBudgetColorVariables();
    },

    // New methods to load and save budget colors
    loadSavedBudgetColors() {
      const savedLeftColor = localStorage.getItem('budget_color_left');
      const savedRightColor = localStorage.getItem('budget_color_right');

      if (savedLeftColor) {
        this.budgetColors.left = savedLeftColor;
      }
      if (savedRightColor) {
        this.budgetColors.right = savedRightColor;
      }
    },
    updateBudgetColorVariables() {
      // Convert Bootstrap classes to actual colors for CSS variables
      const colorMap = {
        'bg-success': '#198754',
        'bg-danger': '#dc3545',
        'bg-warning': '#ffc107',
        'bg-info': '#0dcaf0',
        'bg-primary': '#0d6efd',
        'bg-secondary': '#6c757d'
      };

      const leftColor = colorMap[this.budgetColors.left] || '#0d6efd';
      const rightColor = colorMap[this.budgetColors.right] || '#198754';

      // Set CSS variables for budget colors
      document.documentElement.style.setProperty('--budget-left-color', leftColor);
      document.documentElement.style.setProperty('--budget-right-color', rightColor);
    },
  },
  // Specify which components we want to make available to our templates
  components: {
    Nav,
    Footer,
    Budget,
    Transactions,
    CombinedTransactions,
    TripSummary,
    TransferSummary,
    HouseholdSummary
  },
}
</script>
