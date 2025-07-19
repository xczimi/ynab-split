<template>
  <footer class="pt-4 mt-5 pt-md-5 border-top bg-light rounded shadow-sm">
    <div class="container">
      <div class="row">
        <div class="col-md-8">
          <h4>Privacy Policy</h4>
          <p class="text-muted">This website does not store any information from you or your YNAB account. All data retrieved from the YNAB API is stored only in your browser and is never transmitted to any other location or third-party.</p>
          <div v-if="isAuthenticated" class="mt-3">
            <button class="btn btn-outline-secondary btn-sm" @click="logout">
              <i class="fas fa-sign-out-alt me-1"></i> Logout from YNAB
            </button>
          </div>
        </div>
        <div class="col-md-4 text-md-end">
          <small class="text-muted d-block mb-2">MADE WITH ❤️ BY</small>
          <h5><a href="#" class="text-decoration-none">You!</a></h5>
          <p class="text-muted small">© 2025 YNAB Split App</p>
        </div>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  computed: {
    isAuthenticated() {
      // Check if parent component has the YNAB token
      return this.$parent && this.$parent.ynab && this.$parent.ynab.token;
    }
  },
  methods: {
    logout() {
      // Call the logout method on the parent (App) component
      if (this.$parent && typeof this.$parent.logout === 'function') {
        this.$parent.logout();
      }
    }
  }
}
</script>
