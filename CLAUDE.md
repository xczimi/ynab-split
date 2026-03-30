# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YNAB Split is a Vue 3 web application that integrates with the YNAB (You Need A Budget) API to compare and analyze transactions across two budgets. It features smart auto-categorization, trip identification, transfer detection, and household expense tracking.

## Build & Development Commands

```bash
npm start          # Dev server on localhost:8080 with hot reload
npm run build      # Production build to dist/build.js
npm test           # Run Jest tests (56 tests across 2 suites)
npm run test:watch # Run tests in watch mode
npm run check      # Run tests + build (single verification command)
npm test -- --coverage  # Run tests with coverage report
```

The project is ESM (`"type": "module"` in package.json). Tests require `--experimental-vm-modules`.

Deployment is automatic via GitHub Actions on pushes to `main` branch (tests run before deploy).

## Architecture

### Tech Stack
- Vue.js 3.4 (Options API style)
- Webpack 5 with Dev Server
- Bootstrap 5.3 + Font Awesome 6.5
- Chart.js 4.5 with annotation plugin (BalanceTimeline)
- Ramda (functional utilities), Luxon (timezone handling)
- YNAB SDK 2.6 for API integration
- Jest 30 for testing

### Core Structure

**App.vue** — Central component with all state management:
- Budget IDs and transactions for left/right budgets
- Loading gates (`leftBudgetLoading`, `rightBudgetLoading`) to prevent premature processing
- Tab navigation: **Trip Analysis** (default, works with 1 budget) and **Joint Spending** (requires both budgets)
- Computed properties for transaction filtering and designation pipeline

**Designation System** (`src/utils/designations/`) — Modular rule-based processing:
```
designations/
  config.js              — defaultConfig, mergeConfig, localStorage persistence
  processor.js           — Pipeline orchestrator: addHashtagsToTransactions, processTransactions
  dateUtils.js           — Luxon timezone-aware date helpers
  index.js               — Barrel exports (primary import target)
  extractors/
    hashtags.js          — extractAllHashtags, filterRelevantHashtags, addHashtag
    tripGrouper.js       — groupByConsecutiveDates, getDateRange
  rules/
    transferRule.js      — detect(), findMatches(), isTransferTransaction()
    householdRule.js     — detect(), isBillTransaction(), shouldAutoTag()
    tripRule.js          — processTrips(), getTripSummaries(), generateTripName()
    categoryRule.js      — detectCustomCategory() for user-defined rules
```

**Legacy Wrappers** (thin re-export layers for backward compatibility):
- `src/utils/designator.js` — delegates to `designations/`
- `src/utils/trips.js` — delegates to `designations/`

**Other Utilities** (`src/utils/`):
- `transactions.js` — YNAB API wrapper, OAuth token management, getCategories(), currency formatting, sorting
- `debug.js` — Console debug utilities (exposed on `window.ynabDebug`)

**Components** (`src/components/`):
- `Budget.vue` — Budget selector with balance display and color picker
- `CombinedTransactions.vue` — Main transaction list with designation filters
- `TripSummary.vue` — Expandable trip table with category breakdowns (Trip Analysis tab)
- `TransferSummary.vue` — Transfer pairs display (Joint Spending tab)
- `HouseholdSummary.vue` — Monthly household expense breakdown (Joint Spending tab)
- `BalanceTimeline.vue` — Chart.js timeline chart (Joint Spending tab)
- `HouseholdCategorySettings.vue` — Category picker for household designation (Joint Spending tab)
- `Nav.vue`, `Footer.vue` — Chrome

### Data Flow Pattern

```
Raw YNAB Transactions (Orange flagged)
→ Merge & Sort (sortingUtils.sortNewestFirst)
→ Loading Gate Check (both budgets loaded)
→ processor.addHashtagsToTransactions():
    → householdRule: pattern match + user-selected category IDs → #household
    → transferRule: matching amounts across budgets within 3 days → #transfer
    → categoryRule: user-defined custom rules from localStorage
    → Enrich with hashtag arrays and boolean flags
→ processor.processTransactionsWithTrips():
    → Filter eligible (exclude household, transfers)
    → tripGrouper.groupByConsecutiveDates()
    → tripRule.getTripNameForGroup() (manual hashtag or auto-generated)
→ Filter by Type → Display in Tab Components
```

### Key Conventions

- All dates use **America/Vancouver timezone** via Luxon
- Transaction amounts in **milliunits** (1000 = $1.00), negative = expense
- State in App.vue, utility functions in designations/, components for display
- Budget colors stored in localStorage, OAuth tokens in sessionStorage
- Custom designation rules stored in localStorage under `custom_designations`
- Household category IDs stored in localStorage under `household_category_ids`

### Detection Thresholds

- **Transfer detection:** Matching absolute amounts within **3 days** across different budgets
- **Trip grouping:** Consecutive transactions within **2-day gaps**, requires **2+ unique dates**
- **Household detection:** Category/group matching patterns: `bill`, `utilities`, `rent`, `insurance`, `strata`, `hydro`, `internet`, `phone`, `home`, `housing` — plus user-selected category IDs via HouseholdCategorySettings

### Designation System

Transactions are categorized via hashtags in the memo field:
- `#transfer` — Auto-tagged when matching amounts found across budgets
- `#household` — Auto-tagged for matching categories, or manual
- `#trip` / `#tripName` — Manual (e.g., `#tripHawaii`) or auto-generated (`trip2024Jan15`)
- Custom hashtags — User-defined rules via `categoryRule.js`

### Configuration

- OAuth credentials in `src/config.json`. Supports `VUE_APP_REDIRECT_URI` env var for dev/prod.
- `mise.toml` — Node.js version management (`node = "latest"`)
- `jest.config.json` — Test configuration with coverage thresholds

## Testing

```
src/utils/designator.test.js         — 31 unit tests (hashtags, transfers, trips, settings)
test/integration.test.js             — 25 integration tests (full pipeline with real data)
test/fixtures/sample-transactions.json — 161 real YNAB transactions from two budgets
```

Integration tests exercise the full designation pipeline against real transaction data: hashtag extraction, transfer detection, household detection, trip grouping, and trip summaries.

Coverage targets: 80% statements/functions/lines, 65% branches. Run `npm test -- --coverage` to check.

## Documentation

See `docs/features.md` for detailed user-facing documentation on transfers, trips, household expenses, and the designation system.
