# Prompt: Add Running Balance Timeline Chart

## Task
Add a Chart.js line chart showing the cumulative owing balance over time between two YNAB budgets.

## Context
- This is a Vue 3 app that compares transactions between two YNAB budgets (left and right)
- Chart.js is already installed (`npm install chart.js` was run)
- Transactions have a `source` field ('left' or 'right') and `amount` in milliunits (1000 = $1)
- The "owing balance" = difference between budgets / 2 (settlement amount)

## What to Build

### 1. Create `src/components/BalanceTimeline.vue`

A Vue component that:
- Accepts `transactions` prop (array of processed transactions)
- Sorts transactions by date (oldest first)
- Calculates running balance: left transactions add, right transactions subtract
- Renders a Chart.js line chart

**Balance calculation:**
```javascript
let runningBalance = 0;
const dataPoints = sortedTransactions.map(t => {
  runningBalance += (t.source === 'left' ? t.amount : -t.amount);
  return {
    date: t.date,
    balance: runningBalance / 2  // Settlement amount
  };
});
```

**Chart config:**
- Type: Line chart
- X-axis: Dates
- Y-axis: Currency (milliunits / 1000)
- Responsive: true
- Tooltip: Show date and formatted balance

### 2. Add to `src/App.vue`

- Import BalanceTimeline component
- Add after the summary sections (TripSummary, TransferSummary, HouseholdSummary)
- Pass `transactionsWithDesignations` as the transactions prop

**Template location (after HouseholdSummary):**
```vue
<BalanceTimeline
  v-if="leftBudgetId && rightBudgetId"
  :transactions="transactionsWithDesignations"
/>
```

## Files to Create
- `src/components/BalanceTimeline.vue`

## Files to Modify
- `src/App.vue` (import and add component)

## Chart.js Import
```javascript
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
```

## Styling
- Match existing card style from other summary components (HouseholdSummary, TripSummary)
- Collapsible with chevron toggle
- Bootstrap 5 classes
