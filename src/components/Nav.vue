<template>
  <div class="navbar navbar-dark bg-primary d-flex flex-column flex-md-row align-items-center p-3 px-md-4 mb-3 border-bottom box-shadow">
    <div class="container">
      <h5 class="my-0 mr-md-auto font-weight-normal navbar-brand">YNAB Split Trip</h5>
    </div>
  </div>
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
