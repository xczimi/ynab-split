# Vue Component Data Hierarchy - Centralized Transaction Model

```mermaid
graph TD
    %% Root Component with Centralized Data
    App[App.vue<br/>Centralized Transaction Store<br/>Combined Data Processing<br/>Loading State Management<br/>Auto-loads Saved Budgets]

    %% Navigation and Footer
    Nav[Nav.vue<br/>Navigation Bar]
    Footer[Footer.vue<br/>Footer with Logout]

    %% Budget Selection Components
    LeftBudget[Budget.vue<br/>Left Budget Selector<br/>Raw Transaction Loading<br/>Loading State Tracking<br/>Events to App]
    RightBudget[Budget.vue<br/>Right Budget Selector<br/>Raw Transaction Loading<br/>Loading State Tracking<br/>Events to App]

    %% Summary Components - Receive Processed Data
    TripSummary[TripSummary.vue<br/>Trip Display Component<br/>Receives Filtered Trip Data<br/>No Processing Logic]
    TransferSummary[TransferSummary.vue<br/>Transfer Display Component<br/>Receives Filtered Transfer Data<br/>No Processing Logic]
    HouseholdSummary[HouseholdSummary.vue<br/>Household Display Component<br/>Receives Filtered Household Data<br/>No Processing Logic]

    %% Transaction Display
    CombinedTransactions[CombinedTransactions.vue<br/>Transaction List Display<br/>Centralized Sorting<br/>Receives Processed Data<br/>Manual Edit Capabilities]

    %% Utility Modules
    TransUtils[utils/transactions.js<br/>YNAB API & Currency Utils<br/>Centralized Sorting Functions<br/>Token & Storage Management<br/>Error Handling]
    DesignatorUtils[utils/designator.js<br/>Trip Detection Logic<br/>Hashtag Processing<br/>Transfer Identification<br/>Vancouver Timezone Handling]

    %% External Dependencies
    Luxon[luxon<br/>Date/Time Library<br/>Timezone Support]

    %% Main Component Relationships
    App --> Nav
    App --> LeftBudget
    App --> RightBudget
    App --> TripSummary
    App --> TransferSummary
    App --> HouseholdSummary
    App --> CombinedTransactions
    App --> Footer

    %% Centralized Processing in App
    App -.->|"Combines & Processes<br/>All Transactions<br/>Waits for Both Budgets"| DesignatorUtils
    App -.->|"YNAB API calls<br/>Budget management<br/>Centralized sorting<br/>Auto-restore saved IDs"| TransUtils

    %% Budget Components Load Raw Data with State Tracking
    LeftBudget -.->|"Raw transaction loading<br/>Loading state events<br/>Error handling<br/>Storage persistence"| TransUtils
    RightBudget -.->|"Raw transaction loading<br/>Loading state events<br/>Error handling<br/>Storage persistence"| TransUtils

    %% Component Sorting Dependencies
    CombinedTransactions -.->|"sortNewestFirst()<br/>Consistent transaction ordering"| TransUtils

    %% Designator Utils Dependencies
    DesignatorUtils -.->|"Date/time operations<br/>Vancouver timezone handling"| Luxon

    %% Centralized Data Flow with Loading Gates
    App -->|"allTransactions<br/>(combined & sorted)"| AppProcessing[App Processing Layer<br/>Waits for Both Budgets Loaded]
    AppProcessing -->|"transactionsWithDesignations<br/>(processed when ready)"| AppComputed[App Computed Properties]
    AppComputed -->|"tripTransactions[]<br/>(filtered)"| TripSummary
    AppComputed -->|"transferTransactions[]<br/>(filtered)"| TransferSummary
    AppComputed -->|"householdTransactions[]<br/>(filtered)"| HouseholdSummary
    AppComputed -->|"transactionsWithDesignations[]<br/>(all processed & sorted)"| CombinedTransactions

    %% Event Flow (Events Up)
    LeftBudget -.->|"budget-selected<br/>transactions-loaded<br/>budget-loading-changed<br/>budget-error"| App
    RightBudget -.->|"budget-selected<br/>transactions-loaded<br/>budget-loading-changed<br/>budget-error"| App
    CombinedTransactions -.->|"transaction-updated"| App
    TripSummary -.->|"identify-trips"| App

    %% Data Storage & Persistence
    LocalStorage[localStorage<br/>Budget ID Storage<br/>Token Storage]
    TransUtils -.->|"Save/load budget IDs<br/>Token management"| LocalStorage

    %% Loading State Management
    LoadingGates[Loading State Gates<br/>leftBudgetLoading: boolean<br/>rightBudgetLoading: boolean<br/>Prevents Premature Processing]
    App -.->|"Tracks loading completion<br/>from both budgets"| LoadingGates

    %% Internal App Data Processing Flow
    classDef centralStore fill:#e8f5e8,stroke:#4caf50,stroke-width:3px
    classDef processor fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef display fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef data fill:#fce4ec,stroke:#e91e63,stroke-width:2px
    classDef utility fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px

    class App centralStore
    class AppProcessing,AppComputed,LoadingGates processor
    class TripSummary,TransferSummary,HouseholdSummary,CombinedTransactions display
    class LeftBudget,RightBudget data
    class TransUtils,DesignatorUtils utility
```

## Updated Centralized Data Model Architecture

### 🎯 **App.vue - Central Data Store with Proper Timing**
- **Raw Data Storage**: `leftTransactions[]`, `rightTransactions[]`
- **Loading State Tracking**: `leftBudgetLoading`, `rightBudgetLoading` (boolean flags)
- **Combined Processing**: `allTransactions` (computed) - merges both budgets with centralized sorting
- **Gated Processing**: `transactionsWithDesignations` (computed) - waits for both budgets to finish loading
- **Filtered Views**: Computed properties for each component type
- **Automatic Updates**: Watchers ensure summaries update when data changes

### 🔄 **Loading State Management**
```
Budget Selection → Loading Starts → API Call → Loading Complete → Process Designations
```

1. **Budget Components** emit `budget-loading-changed` events
2. **App tracks** both budget loading states
3. **Processing waits** until `!leftBudgetLoading && !rightBudgetLoading`
4. **Prevents premature** trip identification before all data is loaded

### 📊 **Enhanced Data Processing Pipeline**
```
Raw Transactions → Combined & Sorted → Loading Gate → Add Hashtags → Process Trips → Filter by Type → Components
```

1. **Budget Components** load raw transactions and emit loading state changes
2. **App combines** left + right transactions with centralized sorting from `transactions.js`
3. **Loading Gate** ensures both budgets are fully loaded before processing
4. **App processes** through designation utilities (hashtags, transfers, trips)
5. **App filters** into specific transaction types (trip, transfer, household)
6. **Summary Components** receive pre-filtered, processed data with consistent sorting

### 🔧 **Key Improvements**
- **Centralized Sorting**: All transaction sorting now handled by `sortingUtils` in `transactions.js`
- **Proper Loading Gates**: Uses Budget component loading flags instead of transaction count
- **Consistent Timing**: Trip Summary items only appear after all transactions are visible
- **Zero Transaction Support**: Handles budgets with legitimately zero transactions
- **Enhanced Events**: Budget components emit loading state changes for proper coordination

### 🎛️ **Transaction Sorting**
- **Primary Sort**: Date (newest first by default)
- **Secondary Sort**: Transaction ID (for consistency when dates match)
- **Centralized Logic**: Single `sortingUtils` used by both App and CombinedTransactions
- **Performance Optimized**: Pre-computed sort keys to avoid repeated date parsing
