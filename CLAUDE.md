# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YNAB Split is a Vue 3 web application that integrates with the YNAB (You Need A Budget) API to compare and analyze transactions across two budgets. It features smart auto-categorization, trip identification, and transfer detection between budgets.

## Build & Development Commands

```bash
npm start          # Dev server on localhost:8080 with hot reload
npm run build      # Production build to dist/build.js
npm test           # Run Jest tests
npm test:watch     # Run tests in watch mode
```

Deployment is automatic via GitHub Actions on pushes to `main` branch.

## Architecture

### Tech Stack
- Vue.js 3.4 (Options API style)
- Webpack 5 with Dev Server
- Bootstrap 5.3 + Font Awesome 6.5
- Ramda (functional utilities), Luxon (timezone handling)
- YNAB SDK 2.6 for API integration
- Jest for testing

### Core Structure

**App.vue** - Central component with all state management:
- Budget IDs and transactions for left/right budgets
- Loading gates (`leftBudgetLoading`, `rightBudgetLoading`) to prevent premature processing
- Computed properties for transaction filtering (trips, transfers, household)

**Utility Modules** (`src/utils/`):
- `transactions.js` - YNAB API wrapper, OAuth token management, currency formatting, sorting utilities
- `designator.js` - Transaction processing: auto-tagging (#household, #transfer), hashtag extraction
- `trips.js` - Trip detection engine: groups consecutive dates, generates trip summaries

**Components** (`src/components/`):
- `Budget.vue` - Budget selector with balance display and color picker
- `CombinedTransactions.vue` - Main transaction list with filtering controls
- `TripSummary.vue`, `TransferSummary.vue`, `HouseholdSummary.vue` - Summary displays

### Data Flow Pattern

```
Raw YNAB Transactions (Orange flagged)
→ Merge & Sort (sortingUtils.sortNewestFirst)
→ Loading Gate Check (both budgets loaded)
→ Add Hashtags (auto #household for bills, #transfer for matching amounts)
→ Process Trips (consecutive dates with trip hashtags)
→ Filter by Type → Display in Components
```

### Key Conventions

- All dates use **America/Vancouver timezone** via Luxon's `createVancouverDateTime()`
- Transaction amounts in **milliunits** (1000 = $1.00), negative = expense
- State in App.vue, utility functions for logic, components for display
- Budget colors stored in localStorage, OAuth tokens in sessionStorage
- Transfer detection: matching amounts within 3 days across budgets

### Configuration

OAuth credentials in `src/config.json`. Supports `VUE_APP_REDIRECT_URI` env var for dev/prod flexibility.

## Testing

Tests are in `src/utils/designator.test.js` covering hashtag extraction, transfer detection, and trip identification. Run with `npm test`.