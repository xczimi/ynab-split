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
              <Budgets :budgets="budgets" :budgetId="leftBudgetId" :selectBudget="selectLeftBudget"
                      :transactions="leftTransactions"
                      :total="transactionsTotal(leftTransactions)"
                      :otherTotal="transactionsTotal(rightTransactions)"
                      budgetType="left"/>
            </div>
            <div class="col-md-6">
              <Budgets :budgets="budgets" :budgetId="rightBudgetId" :selectBudget="selectRightBudget"
                      :transactions="rightTransactions"
                      :total="transactionsTotal(rightTransactions)"
                      :otherTotal="transactionsTotal(leftTransactions)"
                      budgetType="right"/>
            </div>
          </div>
                      <!-- Trip Summary Section -->
                      <div v-if="leftBudgetId && rightBudgetId" class="row mb-4">
            <div class="col-12">
              <TripSummary
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
                :leftTransactions="leftTransactions"
                :rightTransactions="rightTransactions"
                :selectedLeftBudget="selectedBudget(leftBudgetId, budgets)"
                :selectedRightBudget="selectedBudget(rightBudgetId, budgets)"
              />
            </div>
          </div>

          <!-- Household Summary Section -->
          <div v-if="leftBudgetId && rightBudgetId" class="row mb-4">
            <div class="col-12">
              <HouseholdSummary
                :leftTransactions="leftTransactions"
                :rightTransactions="rightTransactions"
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
                    :leftTransactions="leftTransactions"
                    :rightTransactions="rightTransactions"
                    :leftBudgetId="leftBudgetId"
                    :rightBudgetId="rightBudgetId"
                    :selectedLeftBudget="selectedBudget(leftBudgetId, budgets)"
                    :selectedRightBudget="selectedBudget(rightBudgetId, budgets)"
                    @trips-identified="handleTripsIdentified"
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
  errorUtils
} from './utils/transactions';

// Import our config for YNAB
import config from './config.json';

// Import Our Components to Compose Our App
import Nav from './components/Nav.vue';
import Footer from './components/Footer.vue';
import Budgets from './components/Budgets.vue';
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
      rightBudgetId: null,
      rightTransactions: [],
      budgets: [],
      // Data for trip summary
      tripSummaryData: {
        trips: [],
        transactionsWithTrips: 0
      },
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

      // Load saved budget IDs from localStorage
      const savedLeftBudgetId = storageUtils.getSavedBudgetId('left');
      const savedRightBudgetId = storageUtils.getSavedBudgetId('right');

      // Get budgets first
      this.getBudgets();

      // Set a timeout to allow budgets to load before selecting
      setTimeout(() => {
        if (savedLeftBudgetId) {
          this.selectLeftBudget(savedLeftBudgetId);
        }
        if (savedRightBudgetId) {
          this.selectRightBudget(savedRightBudgetId);
        }
      }, 1000);
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
    // This selects a budget and gets all the transactions in that budget
    async selectRightBudget(id) {
      console.log('Selecting right budget:', id);
      this.loading = true;
      this.error = null;
      this.rightBudgetId = id;
      this.rightTransactions = [];

      // Save budget ID to localStorage
      storageUtils.saveBudgetId('right', id);

      if (!id) {
        this.loading = false;
        return;
      }

      try {
        this.rightTransactions = await getEnhancedTransactions(this.api, id, this.sinceDate);
      } catch (err) {
        console.error('Error fetching right transactions:', err);
        this.error = errorUtils.getErrorMessage(err);
        // Don't reset the token, just clear the current budget selection
        storageUtils.saveBudgetId('right', null);
        this.rightBudgetId = null;
      } finally {
        this.loading = false;
      }
    },
    async selectLeftBudget(id) {
      console.log('Selecting left budget:', id);
      this.loading = true;
      this.error = null;
      this.leftBudgetId = id;
      this.leftTransactions = [];

      // Save budget ID to localStorage
      storageUtils.saveBudgetId('left', id);

      if (!id) {
        this.loading = false;
        return;
      }

      try {
        this.leftTransactions = await getEnhancedTransactions(this.api, id, this.sinceDate);
      } catch (err) {
        console.error('Error fetching left transactions:', err);
        this.error = errorUtils.getErrorMessage(err);
        // Don't reset the token, just clear the current budget selection
        storageUtils.saveBudgetId('left', null);
        this.leftBudgetId = null;
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
    handleTripsIdentified(data) {
      console.log('Trips identified:', data.trips.length);
      this.tripSummaryData = data;
    },

    // Method to trigger trip identification from parent
    identifyTrips() {
      // Trigger the trip identification process in the CombinedTransactions component
      if (this.$refs.combinedTransactions) {
        this.$refs.combinedTransactions.triggerTripIdentification();
      }
    }
  },
  // Specify which components we want to make available to our templates
  components: {
    Nav,
    Footer,
    Budgets,
    Transactions,
    CombinedTransactions,
    TripSummary,
    TransferSummary,
    HouseholdSummary
  },
}
</script>
