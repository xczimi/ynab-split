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
          <div class="row">
            <div class="col-12">
              <div class="card shadow-sm">
                <div class="card-header bg-light">
                  <h3 class="mb-0">Combined Transactions</h3>
                </div>
                <div class="card-body p-0">
                  <CombinedTransactions
                    :leftTransactions="leftTransactions"
                    :rightTransactions="rightTransactions"
                    :leftBudgetId="leftBudgetId"
                    :rightBudgetId="rightBudgetId"
                    :selectedLeftBudget="selectedBudget(leftBudgetId, budgets)"
                    :selectedRightBudget="selectedBudget(rightBudgetId, budgets)"
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
// Hooray! Here comes YNAB!
import * as ynab from 'ynab';
import * as R from 'ramda';

// Import our config for YNAB
import config from './config.json';

// Import Our Components to Compose Our App
import Nav from './components/Nav.vue';
import Footer from './components/Footer.vue';
import Budgets from './components/Budgets.vue';
import Transactions from './components/Transactions.vue';
import CombinedTransactions from './components/CombinedTransactions.vue';
import {TransactionFlagColor, utils} from "ynab";

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
    }
  },
  // When this component is created, check whether we need to get a token,
  // budgets or display the transactions
  created() {
    console.log('App component created');
    this.ynab.token = this.findYNABToken();
    console.log('YNAB token found:', this.ynab.token ? 'Yes' : 'No');
    if (this.ynab.token) {
      this.api = new ynab.api(this.ynab.token);

      // Load saved budget IDs from localStorage
      const savedLeftBudgetId = localStorage.getItem('ynab_left_budget_id');
      const savedRightBudgetId = localStorage.getItem('ynab_right_budget_id');

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
    convertMilliUnitsToCurrencyAmount: ynab.utils.convertMilliUnitsToCurrencyAmount,
    transactionsTotal: R.pipe(R.map(R.prop("amount")), R.sum),
    selectedBudget(budgetId, budgets) {
      return budgets.find(budget => budget.id === budgetId);
    },
    formatCurrency(milliunits) {
      const amount = this.convertMilliUnitsToCurrencyAmount(milliunits);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount);
    },
    // This uses the YNAB API to get a list of budgets
    getBudgets() {
      console.log('Getting budgets from YNAB API');
      this.loading = true;
      this.error = null;
      return this.api.budgets.getBudgets().then((res) => {
        console.log('Budgets received:', res.data.budgets.length);
        this.budgets = res.data.budgets;
        return res;
      }).catch((err) => {
        console.error('Error fetching budgets:', err);
        // Check if this is an authentication error
        if (err.status === 401) {
          // If unauthorized, we need to refresh the token
          console.log('Unauthorized error, token may have expired');
          this.logout(); // Full logout for auth errors
        } else {
          // For other errors, keep the token but show the error
          this.error = err.error?.detail || err.message || 'An unknown error occurred';
        }
      }).finally(() => {
        this.loading = false;
      });
    },
    // This selects a budget and gets all the transactions in that budget
    selectRightBudget(id) {
      console.log('Selecting right budget:', id);
      this.loading = true;
      this.error = null;
      this.rightBudgetId = id;
      this.rightTransactions = [];
      // Save budget ID to localStorage
      if (id) {
        console.log('Saving right budget ID to localStorage');
        localStorage.setItem('ynab_right_budget_id', id);
      } else {
        console.log('Removing right budget ID from localStorage');
        localStorage.removeItem('ynab_right_budget_id');
        this.loading = false;
        return;
      }

      this.api.transactions.getTransactions(id, this.sinceDate).then((res) => {
        console.log('Right transactions received:', res.data.transactions.length);
        const filteredTransactions = R.filter(R.propEq(TransactionFlagColor.Orange, "flag_color"))(res.data.transactions);
        console.log('Filtered right transactions (Orange flag):', filteredTransactions.length);
        this.rightTransactions = filteredTransactions;
      }).catch((err) => {
        console.error('Error fetching right transactions:', err);
        this.error = err.error?.detail || err.message || 'An unknown error occurred';
        // Don't reset the token, just clear the current budget selection
        localStorage.removeItem('ynab_right_budget_id');
        this.rightBudgetId = null;
      }).finally(() => {
        this.loading = false;
      });
      if(id) {
      } else {
        this.loading = false;
      }
    },
    selectLeftBudget(id) {
      console.log('Selecting left budget:', id);
      this.loading = true;
      this.error = null;
      this.leftBudgetId = id;
      this.leftTransactions = [];
      // Save budget ID to localStorage
      if (id) {
        console.log('Saving left budget ID to localStorage');
        localStorage.setItem('ynab_left_budget_id', id);
      } else {
        console.log('Removing left budget ID from localStorage');
        localStorage.removeItem('ynab_left_budget_id');
        this.loading = false;
        return;
      }

      this.api.transactions.getTransactions(id, this.sinceDate).then((res) => {
        console.log('Left transactions received:', res.data.transactions.length);
        const filteredTransactions = R.filter(R.propEq(TransactionFlagColor.Orange, "flag_color"))(res.data.transactions);
        console.log('Filtered left transactions (Orange flag):', filteredTransactions.length);
        this.leftTransactions = filteredTransactions;
      }).catch((err) => {
        console.error('Error fetching left transactions:', err);
        this.error = err.error?.detail || err.message || 'An unknown error occurred';
        // Don't reset the token, just clear the current budget selection
        localStorage.removeItem('ynab_left_budget_id');
        this.leftBudgetId = null;
      }).finally(() => {
        this.loading = false;
      });
    },
    // This builds a URI to get an access token from YNAB
    // https://api.ynab.com/#outh-applications
    authorizeWithYNAB(e) {
      console.log('Authorizing with YNAB');
      e.preventDefault();
      const uri = `https://app.ynab.com/oauth/authorize?client_id=${this.ynab.clientId}&redirect_uri=${this.ynab.redirectUri}&response_type=token`;
      console.log('Redirect URI:', this.ynab.redirectUri);
      location.replace(uri);
    },
    // Method to find a YNAB token
    // First it looks in the location.hash and then sessionStorage
    findYNABToken() {
      console.log('Finding YNAB token');
      let token = null;
      const search = window.location.hash.substring(1).replace(/&/g, '","').replace(/=/g, '":"');
      console.log('URL hash present:', search && search !== '');
      if (search && search !== '') {
        // Try to get access_token from the hash returned by OAuth
        const params = JSON.parse('{"' + search + '"}', function (key, value) {
          return key === '' ? value : decodeURIComponent(value);
        });
        token = params.access_token;
        console.log('Token found in URL hash, storing in sessionStorage');
        sessionStorage.setItem('ynab_access_token', token);
        window.location.hash = '';
      } else {
        // Otherwise try sessionStorage
        token = sessionStorage.getItem('ynab_access_token');
        console.log('Token from sessionStorage:', token ? 'Found' : 'Not found');
      }
      return token;
    },
    // Reset application state but keep auth token when there's an error
    resetToken(keepAuth = true) {
      console.log('Resetting application state, keepAuth:', keepAuth);

      // Only remove the token if explicitly requested (for logout)
      if (!keepAuth) {
        console.log('Removing YNAB authentication token');
        sessionStorage.removeItem('ynab_access_token');
        this.ynab.token = null;
      }

      // Always clear budget selections on reset
      localStorage.removeItem('ynab_left_budget_id');
      localStorage.removeItem('ynab_right_budget_id');
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
    }
  },
  // Specify which components we want to make available to our templates
  components: {
    Nav,
    Footer,
    Budgets,
    Transactions,
    CombinedTransactions
  },
}
</script>
