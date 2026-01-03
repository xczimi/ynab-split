# YNAB Split Features

## Overview

YNAB Split is a web application that compares transactions across two YNAB budgets. It automatically categorizes transactions using a hashtag-based designation system, helping you track:

- **Transfers** between budgets
- **Household expenses** (bills and shared costs)
- **Trip expenses** (travel-related spending)

The app only shows transactions with an **Orange flag** in YNAB, allowing you to control which transactions appear in the comparison.

## Designation System

Designations are hashtags embedded in the transaction memo field that categorize transactions. The app recognizes three designation types:

| Designation | Format | Purpose |
|-------------|--------|---------|
| Transfer | `#transfer` | Money moved between budgets |
| Household | `#household` | Shared/household expenses |
| Trip | `#trip` or `#tripName` | Travel-related expenses (e.g., `#tripHawaii`) |

### Automatic vs Manual Designation

**Automatic:** The app auto-detects and tags transactions:
- Bills (category containing "bill") → `#household`
- Matching amounts across budgets within 3 days → `#transfer`

**Manual:** You can add or change designations by:
1. Clicking a transaction's designation badge in the Combined Transactions view
2. Selecting a designation type from the dropdown
3. For trips, choose an existing trip or create a new one
4. Saving the change

### Filtering by Designation

The Combined Transactions view provides toggle switches to show/hide:
- Transfers
- Household expenses
- Trips
- Undesignated transactions

A trip filter dropdown lets you view transactions for a specific trip.

## Transfer Detection

**Purpose:** Identifies money transfers between your two budgets.

**How it works:**
1. Finds transactions with matching absolute amounts (one positive, one negative)
2. Transactions must be from different budgets
3. Transactions must occur within 3 days of each other

**Example:** A $500 withdrawal from Budget A on Jan 15 matches a $500 deposit in Budget B on Jan 16.

**Transfer Summary displays:**
- Number of transfer pairs identified
- Date range of each transfer
- Amount transferred
- Source and destination budgets (color-coded)
- Days elapsed between matching transactions

## Household Expenses

**Purpose:** Tracks shared household expenses like bills and utilities.

**How it works:**
1. Automatically detects transactions where the category or category group contains "bill"
2. Tags these transactions with `#household`
3. You can manually add `#household` to any transaction

**Household Summary displays:**
- Monthly breakdown of expenses by budget
- Transaction counts per budget per month
- Total monthly expenses
- Daily and monthly averages
- Aggregate totals across all months

## Trip Identification

**Purpose:** Groups travel-related expenses together for easy tracking.

**How it works:**
1. Groups consecutive transactions within 2-day gaps
2. Requires at least 2 different transaction dates to qualify as a trip
3. Excludes household and transfer transactions from trip grouping

**Trip naming:**
- **Manual:** Add `#tripHawaii` or similar hashtag to transactions
- **Automatic:** Generated as `trip2024Jan15` based on the start date

**Trip Summary displays:**
- Trip name/hashtag
- Start and end dates
- Number of transactions
- Total spending
- Most frequent words from payee names and memos (helps identify trip location/activities)

## Processing Pipeline

Transactions flow through the system in this order:

```
Raw YNAB Transactions (Orange flagged)
         │
         ▼
   Merge & Sort (newest first)
         │
         ▼
   Loading Gate (wait for both budgets)
         │
         ▼
   Auto-tag Designations
   ├── Bills → #household
   └── Matching amounts → #transfer
         │
         ▼
   Trip Grouping
   ├── Group by consecutive dates
   ├── Apply manual #trip tags
   └── Generate auto trip names
         │
         ▼
   Enhanced Transactions (with designations)
         │
         ▼
   Filter & Display in Components
   ├── TransferSummary
   ├── HouseholdSummary
   ├── TripSummary
   └── CombinedTransactions
```

## Configuration

**Transfer detection window:** 3 days

**Trip grouping:**
- Maximum gap between transactions: 2 days
- Minimum dates required: 2 different dates

**Timezone:** All date calculations use America/Vancouver timezone

**Currency:** Amounts stored as YNAB milliunits (1000 = $1.00), displayed as currency
