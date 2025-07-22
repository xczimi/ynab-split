/**
 * Unit tests for transaction designation utilities
 */

import {
  extractAllHashtags,
  filterRelevantHashtags,
  extractHashtags,
  isBillTransaction,
  addAutomaticTags,
  addHashtagsToTransactions,
  isTransferTransaction,
  shouldIncludeTransaction,
  processTransactionsWithTrips,
  getTripSummaries,
  DEFAULT_SETTINGS
} from './designator';

import {
  groupTransactionsByConsecutiveDates,
  generateTripName
} from './trips';

describe('tripIdentification utilities', () => {

  describe('extractAllHashtags', () => {
    it('should extract all hashtags from memo', () => {
      const transaction = {
        memo: 'Great #trip to #Hawaii with #family and #friends'
      };
      const hashtags = extractAllHashtags(transaction);
      expect(hashtags).toEqual(['trip', 'Hawaii', 'family', 'friends']);
    });

    it('should return empty array when no hashtags', () => {
      const transaction = { memo: 'No hashtags here' };
      const hashtags = extractAllHashtags(transaction);
      expect(hashtags).toEqual([]);
    });

    it('should return empty array when no memo', () => {
      const transaction = {};
      const hashtags = extractAllHashtags(transaction);
      expect(hashtags).toEqual([]);
    });

    it('should handle hashtags with numbers and underscores', () => {
      const transaction = {
        memo: '#trip_2024 #vacation123 #test_tag_1'
      };
      const hashtags = extractAllHashtags(transaction);
      expect(hashtags).toEqual(['trip_2024', 'vacation123', 'test_tag_1']);
    });
  });

  describe('filterRelevantHashtags', () => {
    it('should filter trip hashtags', () => {
      const hashtags = ['trip', 'tripHawaii', 'vacation', 'food'];
      const relevant = filterRelevantHashtags(hashtags);
      expect(relevant).toEqual(['trip', 'tripHawaii']);
    });

    it('should filter household and transfer tags', () => {
      const hashtags = ['household', 'transfer', 'random', 'bill'];
      const relevant = filterRelevantHashtags(hashtags);
      expect(relevant).toEqual(['household', 'transfer']);
    });

    it('should be case insensitive', () => {
      const hashtags = ['TRIP', 'TripVacation', 'HOUSEHOLD', 'TRANSFER'];
      const relevant = filterRelevantHashtags(hashtags);
      expect(relevant).toEqual(['TRIP', 'TripVacation', 'HOUSEHOLD', 'TRANSFER']);
    });

    it('should return empty array when no relevant tags', () => {
      const hashtags = ['food', 'work', 'random'];
      const relevant = filterRelevantHashtags(hashtags);
      expect(relevant).toEqual([]);
    });
  });

  describe('extractHashtags', () => {
    it('should extract only relevant hashtags', () => {
      const transaction = {
        memo: '#tripHawaii great #vacation with #household stuff and #random tags'
      };
      const hashtags = extractHashtags(transaction);
      expect(hashtags).toEqual(['tripHawaii', 'household']);
    });
  });

  describe('isTransferTransaction', () => {
    it('should identify transfer by matching amounts within 3 days', () => {
      const transaction = {
        id: '1',
        date: '2024-01-15',
        amount: -20000,
        source: 'left'
      };

      const allTransactions = [
        transaction,
        {
          id: '2',
          date: '2024-01-16', // 1 day later
          amount: 20000, // Matching positive amount
          source: 'right'
        }
      ];

      const result = isTransferTransaction(transaction, allTransactions);
      expect(result).toBe(true);
    });

    it('should not identify transfer if amounts do not match', () => {
      const transaction = {
        id: '1',
        date: '2024-01-15',
        amount: -20000,
        source: 'left'
      };

      const allTransactions = [
        transaction,
        {
          id: '2',
          date: '2024-01-16',
          amount: 15000, // Different amount
          source: 'right'
        }
      ];

      const result = isTransferTransaction(transaction, allTransactions);
      expect(result).toBe(false);
    });

    it('should not identify transfer if dates are more than 3 days apart', () => {
      const transaction = {
        id: '1',
        date: '2024-01-15',
        amount: -20000,
        source: 'left'
      };

      const allTransactions = [
        transaction,
        {
          id: '2',
          date: '2024-01-20', // 5 days later
          amount: 20000,
          source: 'right'
        }
      ];

      const result = isTransferTransaction(transaction, allTransactions);
      expect(result).toBe(false);
    });

    it('should not identify transfer from same source', () => {
      const transaction = {
        id: '1',
        date: '2024-01-15',
        amount: -20000,
        source: 'left'
      };

      const allTransactions = [
        transaction,
        {
          id: '2',
          date: '2024-01-16',
          amount: 20000,
          source: 'left' // Same source
        }
      ];

      const result = isTransferTransaction(transaction, allTransactions);
      expect(result).toBe(false);
    });
  });

  describe('isBillTransaction', () => {
    it('should identify bill by category name containing "bill"', () => {
      const transaction = {
        category_name: 'Electric Bill',
        category_group_name: 'Monthly Expenses'
      };
      expect(isBillTransaction(transaction)).toBe(true);
    });

    it('should identify bill by category group containing "bill"', () => {
      const transaction = {
        category_name: 'Electricity',
        category_group_name: 'Monthly Bills'
      };
      expect(isBillTransaction(transaction)).toBe(true);
    });

    it('should be case insensitive', () => {
      const transaction = {
        category_name: 'Electric BILL',
        category_group_name: 'Monthly Expenses'
      };
      expect(isBillTransaction(transaction)).toBe(true);
    });

    it('should not identify non-bill transactions', () => {
      const transaction = {
        category_name: 'Groceries',
        category_group_name: 'Food'
      };
      expect(isBillTransaction(transaction)).toBe(false);
    });
  });

  describe('addAutomaticTags', () => {
    it('should add #household tag to bill transactions', () => {
      const transaction = {
        memo: 'Monthly electricity',
        category_name: 'Electric Bill'
      };

      const result = addAutomaticTags(transaction, []);
      expect(result.memo).toBe('Monthly electricity #household');
      expect(result.autoTaggedAsBill).toBe(true);
    });

    it('should add #transfer tag to transfer transactions', () => {
      const transaction = {
        id: '1',
        memo: 'Moving money',
        date: '2024-01-15',
        amount: -20000,
        source: 'left'
      };

      const allTransactions = [
        transaction,
        {
          id: '2',
          date: '2024-01-16',
          amount: 20000,
          source: 'right'
        }
      ];

      const result = addAutomaticTags(transaction, allTransactions);
      expect(result.memo).toBe('Moving money #transfer');
      expect(result.autoTaggedAsTransfer).toBe(true);
    });

    it('should not add duplicate tags', () => {
      const transaction = {
        memo: 'Already tagged #household',
        category_name: 'Electric Bill'
      };

      const result = addAutomaticTags(transaction, []);
      expect(result.memo).toBe('Already tagged #household');
      expect(result.autoTaggedAsBill).toBe(false);
    });

    it('should add both tags when applicable', () => {
      const transaction = {
        id: '1',
        memo: 'Transfer for bill payment',
        category_name: 'Electric Bill',
        date: '2024-01-15',
        amount: -20000,
        source: 'left'
      };

      const allTransactions = [
        transaction,
        {
          id: '2',
          date: '2024-01-16',
          amount: 20000,
          source: 'right'
        }
      ];

      const result = addAutomaticTags(transaction, allTransactions);
      expect(result.memo).toBe('Transfer for bill payment #household #transfer');
    });
  });

  describe('addHashtagsToTransactions', () => {
    it('should add hashtag information to transactions', () => {
      const transactions = [
        {
          id: '1',
          memo: '#tripHawaii great vacation #household',
          category_name: 'Travel'
        }
      ];

      const result = addHashtagsToTransactions(transactions);
      expect(result[0].hashtags).toEqual(['tripHawaii', 'household']);
      expect(result[0].relevantHashtags).toEqual(['tripHawaii', 'household']);
      expect(result[0].hasTripTag).toBe(true);
      expect(result[0].hasHouseholdTag).toBe(true);
      expect(result[0].hasTransferTag).toBe(false);
    });

    it('should apply automatic tags during processing', () => {
      const transactions = [
        {
          id: '1',
          memo: 'Monthly payment',
          category_name: 'Electric Bill'
        }
      ];

      const result = addHashtagsToTransactions(transactions);
      expect(result[0].memo).toBe('Monthly payment #household');
      expect(result[0].hasHouseholdTag).toBe(true);
    });
  });

  describe('groupTransactionsByConsecutiveDates', () => {
    it('should group transactions within consecutive dates', () => {
      const transactions = [
        { id: '1', date: '2024-01-15', amount: -5000 },
        { id: '2', date: '2024-01-16', amount: -3000 },
        { id: '3', date: '2024-01-18', amount: -2000 }, // 3 days span for first group
        { id: '4', date: '2024-01-25', amount: -4000 }, // New group starts
        { id: '5', date: '2024-01-26', amount: -2000 },
        { id: '6', date: '2024-01-28', amount: -3000 }  // 3 days span for second group
      ];

      const groups = groupTransactionsByConsecutiveDates(transactions, 3);
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(3); // First group: transactions 1, 2, 3
      expect(groups[1]).toHaveLength(3); // Second group: transactions 4, 5, 6
    });

    it('should reject groups with transactions from only one date', () => {
      const transactions = [
        { id: '1', date: '2024-01-15', amount: -5000 },
        { id: '2', date: '2024-01-15', amount: -3000 }, // Same date
        { id: '3', date: '2024-01-20', amount: -2000 }  // Too far apart, single transaction
      ];

      const groups = groupTransactionsByConsecutiveDates(transactions, 2);
      expect(groups).toHaveLength(0); // No groups because neither qualifies (same date or single transaction)
    });

    it('should accept groups with transactions from at least 2 different dates', () => {
      const transactions = [
        { id: '1', date: '2024-01-15', amount: -5000 },
        { id: '2', date: '2024-01-16', amount: -3000 } // Different dates - now acceptable
      ];

      const groups = groupTransactionsByConsecutiveDates(transactions, 2);
      expect(groups).toHaveLength(1); // Forms one group with multiple dates
      expect(groups[0]).toHaveLength(2);
    });

    it('should handle multiple transactions on same dates but reject if only one unique date', () => {
      const transactions = [
        { id: '1', date: '2024-01-15', amount: -5000 },
        { id: '2', date: '2024-01-15', amount: -3000 },
        { id: '3', date: '2024-01-15', amount: -2000 } // All same date
      ];

      const groups = groupTransactionsByConsecutiveDates(transactions, 2);
      expect(groups).toHaveLength(0); // Rejected because all transactions are on the same date
    });
  });

  describe('generateTripName', () => {
    it('should use manual trip hashtag when available', () => {
      const transactions = [
        {
          date: '2024-01-15',
          memo: '#tripHawaii vacation'
        },
        {
          date: '2024-01-16',
          memo: 'Another expense'
        }
      ];

      const name = generateTripName(transactions, 1);
      expect(name).toBe('tripHawaii');
    });

    it('should generate automatic name for single day trip with year first', () => {
      const transactions = [
        { date: '2024-01-13', memo: '' },
        { date: '2024-01-13', memo: '' }
      ];

      const name = generateTripName(transactions, 1);
      expect(name).toBe('trip2024Jan13');
    });

    it('should generate automatic name for same month trip with year first', () => {
      const transactions = [
        { date: '2024-01-13', memo: '' },
        { date: '2024-01-16', memo: '' }
      ];

      const name = generateTripName(transactions, 1);
      expect(name).toBe('trip2024Jan13-16');
    });

    it('should generate automatic name for same year, different months trip', () => {
      const transactions = [
        { date: '2024-01-26', memo: '' },
        { date: '2024-02-02', memo: '' }
      ];

      const name = generateTripName(transactions, 1);
      expect(name).toBe('trip2024Jan26-Feb02');
    });

    it('should generate automatic name for multi-year trip', () => {
      const transactions = [
        { date: '2023-12-30', memo: '' },
        { date: '2024-01-05', memo: '' }
      ];

      const name = generateTripName(transactions, 1);
      expect(name).toBe('trip2023Dec30-2024Jan05');
    });
  });

  describe('shouldIncludeTransaction', () => {
    it('should include negative transactions by default', () => {
      const transaction = { amount: -5000, category_name: 'Food' };
      expect(shouldIncludeTransaction(transaction)).toBe(true);
    });

    it('should exclude positive transactions when setting enabled', () => {
      const transaction = { amount: 5000, category_name: 'Food' };
      const settings = { excludePositiveTransactions: true };
      expect(shouldIncludeTransaction(transaction, settings)).toBe(false);
    });

    it('should exclude bill transactions', () => {
      const transaction = { amount: -5000, category_name: 'Electric Bill' };
      expect(shouldIncludeTransaction(transaction)).toBe(false);
    });

    it('should include positive transactions when setting disabled', () => {
      const transaction = { amount: 5000, category_name: 'Food' };
      const settings = { excludePositiveTransactions: false };
      expect(shouldIncludeTransaction(transaction, settings)).toBe(true);
    });
  });

  describe('processTransactionsWithTrips', () => {
    it('should process transactions and assign trip names', () => {
      const transactions = [
        {
          id: '1',
          date: '2024-01-15',
          amount: -5000,
          memo: '#tripVegas',
          category_name: 'Travel'
        },
        {
          id: '2',
          date: '2024-01-16',
          amount: -3000,
          memo: 'Hotel',
          category_name: 'Travel'
        },
        {
          id: '3',
          date: '2024-01-18',
          amount: -4000,
          memo: 'Food',
          category_name: 'Dining'
        }
      ];

      const result = processTransactionsWithTrips(transactions);

      // First transaction should use manual trip tag
      expect(result[0].tripName).toBe('tripVegas');
      expect(result[0].isAutoGeneratedTrip).toBe(false);

      // Other transactions should be grouped automatically or use manual tag
      expect(result.every(t => t.tripName)).toBe(true);
    });

  });

  describe('getTripSummaries', () => {
    it('should generate trip summaries from processed transactions', () => {
      const transactions = [
        {
          id: '1',
          date: '2024-01-15',
          amount: -5000,
          tripName: 'tripVegas'
        },
        {
          id: '2',
          date: '2024-01-16',
          amount: -3000,
          tripName: 'tripVegas'
        },
        {
          id: '3',
          date: '2024-02-10',
          amount: -4000,
          tripName: 'tripNYC'
        }
      ];

      const summaries = getTripSummaries(transactions);
      expect(summaries).toHaveLength(2);

      const vegasTrip = summaries.find(s => s.name === 'tripVegas');
      expect(vegasTrip.startDate).toBe('2024-01-15');
      expect(vegasTrip.endDate).toBe('2024-01-16');
      expect(vegasTrip.transactionCount).toBe(2);
      expect(vegasTrip.totalSpending).toBe(-8000);
    });

    it('should handle transactions without trip names', () => {
      const transactions = [
        { id: '1', date: '2024-01-15', amount: -5000 },
        { id: '2', date: '2024-01-16', amount: -3000, tripName: 'tripVegas' }
      ];

      const summaries = getTripSummaries(transactions);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].name).toBe('tripVegas');
    });

    it('should calculate total spending correctly (only negative amounts)', () => {
      const transactions = [
        {
          id: '1',
          date: '2024-01-15',
          amount: -5000, // Spending
          tripName: 'tripVegas'
        },
        {
          id: '2',
          date: '2024-01-16',
          amount: 1000, // Income/refund - should not count
          tripName: 'tripVegas'
        }
      ];

      const summaries = getTripSummaries(transactions);
      expect(summaries[0].totalSpending).toBe(-5000); // Only negative amount
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SETTINGS.maxDaysBetween).toBe(2);
      expect(DEFAULT_SETTINGS.excludePositiveTransactions).toBe(false);
    });
  });
});
