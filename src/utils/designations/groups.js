/**
 * Funded Groups: partition settled-marked accruals into trips + non-trip calendar
 * quarters and aggregate per-group net + status. Pure presentation-layer grouping;
 * settlement is computed per-transaction in settlement.js (see docs/funded-groups.md §3, §9).
 */
import { DateTime } from 'luxon';
import { transactionContribution, isClearing, settlementWatermark } from './settlement.js';

const ZONE = 'America/Vancouver';

/**
 * Calendar-quarter key for an ISO date, e.g. "2025-Q2".
 * @param {string} isoDate
 * @param {string} [zone]
 * @returns {string}
 */
export function quarterKey(isoDate, zone = ZONE) {
  const d = DateTime.fromISO(isoDate, { zone });
  return `${d.year}-Q${Math.floor((d.month - 1) / 3) + 1}`;
}

/**
 * Group key for a transaction: trip-tagged → its trip; else its calendar quarter.
 * One transaction belongs to exactly one group.
 * @param {Object} transaction  requires .date and optional .tripName
 * @returns {string}
 */
export function groupKeyFor(transaction) {
  return transaction.tripName
    ? `trip:${transaction.tripName}`
    : `quarter:${quarterKey(transaction.date)}`;
}

/**
 * Partition settled-marked accruals into groups (trips + non-trip quarters) and
 * aggregate each to net + settled/partial/open status. Clearings are excluded —
 * they belong to no group (see §9). Input must already be markSettled().
 * @param {Array} markedTransactions
 * @returns {Array<{key,kind,label,transactions,net,count,settledCount,status,startDate,endDate}>} oldest-first
 */
export function buildGroups(markedTransactions = []) {
  const accruals = markedTransactions.filter(t => !isClearing(t));

  const byKey = new Map();
  for (const t of accruals) {
    const key = groupKeyFor(t);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(t);
  }

  const groups = [...byKey.entries()].map(([key, txns]) => {
    const sorted = [...txns].sort((x, y) => x.date.localeCompare(y.date));
    const net = sorted.reduce((sum, t) => sum + (t.contribution ?? transactionContribution(t)), 0);
    const settledCount = sorted.filter(t => t.settled).length;
    const count = sorted.length;
    const status = settledCount === count ? 'settled' : settledCount === 0 ? 'open' : 'partial';
    const kind = key.startsWith('trip:') ? 'trip' : 'quarter';
    const label = kind === 'trip' ? key.slice('trip:'.length) : key.slice('quarter:'.length);
    return {
      key, kind, label, transactions: sorted,
      net, count, settledCount, status,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
    };
  });

  return groups.sort((x, y) => x.startDate.localeCompare(y.startDate));
}

/**
 * Full grouped-view summary: marks settlement (strict forward zero-crossing, see
 * settlement.markSettled), partitions accruals into groups, and returns the
 * authoritative net. The open/partial groups ARE what is still owed; there is no
 * separate "open tail" total — the headline `net` is the single source of truth.
 * @param {Array} transactions  raw (un-marked) designated transactions
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {{groups:Array, net:number, clearingPool:number}}
 */
export function summarizeGroups(transactions = [], options = {}) {
  const w = settlementWatermark(transactions, options);
  return {
    groups: buildGroups(w.transactions),
    net: w.net,
    clearingPool: w.clearingPool,
  };
}
