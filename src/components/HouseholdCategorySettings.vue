<template>
  <div class="card shadow-sm mb-4">
    <div class="card-header bg-light d-flex justify-content-between align-items-center">
      <h5 class="mb-0">
        <i class="fas fa-cog me-2"></i>
        Household Category Settings
      </h5>
      <div class="d-flex align-items-center">
        <span class="badge bg-success me-2" :title="selectedCount + ' categories selected as household'">
          {{ selectedCount }} Selected
        </span>
        <button
          @click="togglePanel"
          class="btn btn-sm btn-outline-secondary"
          :title="showPanel ? 'Hide Settings' : 'Show Settings'"
        >
          <i :class="showPanel ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
        </button>
      </div>
    </div>

    <div v-show="showPanel" class="card-body">
      <p class="text-muted small mb-3">
        Select categories that should automatically be tagged as household expenses.
        These will be excluded from trip analysis.
      </p>

      <!-- Flat list of categories with budget color indicators -->
      <div v-if="usedCategories.length > 0" class="category-list" style="max-height: 400px; overflow-y: auto;">
        <div v-for="category in usedCategories" :key="category.id" class="form-check">
          <input
            type="checkbox"
            class="form-check-input"
            :id="'cat-' + category.id"
            :checked="isSelected(category.id)"
            @change="toggleCategory(category.id)"
          >
          <label class="form-check-label d-flex align-items-center" :for="'cat-' + category.id">
            <span
              class="budget-indicator me-2"
              :style="{ backgroundColor: category.source === 'left' ? leftColor : rightColor }"
              :title="category.source === 'left' ? 'Left budget' : 'Right budget'"
            ></span>
            {{ category.displayName }}
          </label>
        </div>
      </div>

      <div v-else class="text-center text-muted py-4">
        <i class="fas fa-folder-open fa-2x mb-2"></i>
        <p>No categories available. Load transactions first.</p>
      </div>
    </div>
  </div>
</template>

<script>
import {
  loadHouseholdCategoryIds,
  saveHouseholdCategoryIds,
  defaultConfig
} from '../utils/designations/config.js';

export default {
  name: 'HouseholdCategorySettings',
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
    }
  },
  data() {
    return {
      showPanel: false,
      selectedCategoryIds: []
    };
  },
  created() {
    this.selectedCategoryIds = loadHouseholdCategoryIds();
  },
  computed: {
    usedCategories() {
      // Extract unique categories from transactions
      const categoryMap = new Map();

      for (const t of this.transactions) {
        if (t.category_id && t.category_name) {
          if (!categoryMap.has(t.category_id)) {
            categoryMap.set(t.category_id, {
              id: t.category_id,
              name: t.category_name,
              category_group_name: t.category_group_name || 'Uncategorized',
              source: t.source
            });
          }
        }
      }

      // Return flat array sorted by display name
      return Array.from(categoryMap.values())
        .map(cat => ({
          ...cat,
          displayName: `${cat.category_group_name}: ${cat.name}`
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
    selectedCount() {
      return this.selectedCategoryIds.length;
    }
  },
  watch: {
    usedCategories: {
      handler(categories) {
        // Only initialize if localStorage is empty and we have categories
        if (categories.length > 0 && this.selectedCategoryIds.length === 0) {
          const patternMatched = categories
            .filter(cat => this.matchesHouseholdPatterns(cat))
            .map(cat => cat.id);

          if (patternMatched.length > 0) {
            this.selectedCategoryIds = patternMatched;
            saveHouseholdCategoryIds(this.selectedCategoryIds);
            this.$emit('categories-changed', this.selectedCategoryIds);
          }
        }
      },
      immediate: true
    }
  },
  methods: {
    togglePanel() {
      this.showPanel = !this.showPanel;
    },
    isSelected(categoryId) {
      return this.selectedCategoryIds.includes(categoryId);
    },
    matchesHouseholdPatterns(category) {
      const { categoryPatterns, categoryGroupPatterns } = defaultConfig.household;
      const catName = (category.name || '').toLowerCase();
      const groupName = (category.category_group_name || '').toLowerCase();

      // Check category name patterns
      for (const pattern of categoryPatterns) {
        if (catName.includes(pattern.toLowerCase())) return true;
      }

      // Check category group patterns
      for (const pattern of categoryGroupPatterns) {
        if (groupName.includes(pattern.toLowerCase())) return true;
      }

      return false;
    },
    toggleCategory(categoryId) {
      const index = this.selectedCategoryIds.indexOf(categoryId);
      if (index === -1) {
        this.selectedCategoryIds.push(categoryId);
      } else {
        this.selectedCategoryIds.splice(index, 1);
      }
      saveHouseholdCategoryIds(this.selectedCategoryIds);
      this.$emit('categories-changed', this.selectedCategoryIds);
    }
  }
};
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

.category-list {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 1rem;
  background-color: #fafafa;
}

.form-check {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.form-check-label {
  cursor: pointer;
}

.budget-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
