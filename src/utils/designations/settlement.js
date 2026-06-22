/**
 * Pure settlement ("who owes whom") math.
 * Convention: a positive balance means the RIGHT person owes the LEFT person.
 */

/**
 * Fraction of a cost the non-payer owes the payer.
 * @param {'left'|'right'|'shared'} ownerSide
 * @param {'left'|'right'} source  who paid (whose budget the txn is in)
 * @returns {number} 0.5 | 0 | 1
 */
export function shareOfNonPayer(ownerSide, source) {
  if (ownerSide === 'shared') return 0.5;
  if (ownerSide === source) return 0;
  return 1;
}

/**
 * Signed milliunits a single transaction adds to the net (right-owes-left) balance.
 * @param {Object} transaction  requires .source, .amount, .ownerSide
 * @returns {number}
 */
export function transactionContribution(transaction) {
  const source = transaction.source;
  const amount = transaction.amount || 0;
  const ownerSide = transaction.ownerSide || 'shared';
  const sign = source === 'left' ? 1 : -1;
  const result = sign * (-amount) * shareOfNonPayer(ownerSide, source);
  return result === 0 ? 0 : result;
}

/**
 * A transaction is a "clearing" (settle-up) iff it carries the transfer tag.
 * Clearings are transfer-exempt: they fund the clearing pool and belong to no group.
 * @param {Object} transaction
 * @returns {boolean}
 */
export function isClearing(transaction) {
  return Boolean(transaction.hasTransferTag);
}

/**
 * The clearing pool: signed settle-up total in the net's direction (milliunits).
 * = -Σ(contribution) over clearings. Clearings pay the balance down, so they sum
 * negative when the net is positive; negating yields a positive pool when the net is
 * positive, and a negative pool when the net is negative (left owes right). The pool
 * can exceed the accrual total (over-cleared), causing `net` to flip sign relative to
 * the accruals — use magnitude comparisons (Math.abs) when testing coverage.
 * @param {Array} transactions
 * @returns {number}
 */
export function clearingPool(transactions = []) {
  const sum = transactions
    .filter(isClearing)
    .reduce((acc, t) => acc + transactionContribution(t), 0);
  return sum === 0 ? 0 : -sum;
}

/**
 * Mark each transaction with a per-transaction `settled` flag via a forward
 * running ledger from day 0 (see docs/funded-groups.md §9).
 *
 * Walk every transaction (accruals AND clearings) oldest→newest, keeping the
 * running net balance. The books close at the LAST point where that balance actually
 * reached zero — or passed into the other person's favour (`sign(net) * balance <= 0`):
 * everything up to and including that "last square" point is **settled**, and the run
 * of transactions since is the open tail that makes up the current balance.
 *
 * Strict by design: a group is settled only once the standing debt was genuinely
 * cleared (the balance reached/crossed zero), not merely paid down part-way. It
 * respects timing — a settle-up only ever clears debt that actually stood when it
 * happened — so it is correct whichever way the balance points and however many times
 * it oscillates. (Dual check: walking BACKWARD from today's balance until the running
 * total returns to zero lands on the same boundary — see the settlement tests.)
 *
 * @param {Array} transactions  each requires .date, .source, .amount, .ownerSide, .hasTransferTag
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {Array} new array (input order) of {...t, contribution, settled}
 */
export function markSettled(transactions = [], options = {}) {
  const sorted = transactions
    .map((t, index) => ({ t, index }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date) || a.index - b.index);
  const n = sorted.length;

  // Running balance after each transaction.
  const balances = new Array(n);
  let running = 0;
  for (let p = 0; p < n; p++) {
    running += transactionContribution(sorted[p].t);
    balances[p] = running;
  }
  const sign = Math.sign(running);

  // Last position where the balance was square or in the other person's favour.
  let lastSquarePos = -1;
  for (let p = 0; p < n; p++) {
    if (sign === 0 || sign * balances[p] <= 0) lastSquarePos = p;
  }

  const settledByIndex = new Array(transactions.length);
  for (let p = 0; p < n; p++) {
    settledByIndex[sorted[p].index] = p <= lastSquarePos;
  }

  return transactions.map((t, index) => ({
    ...t,
    contribution: transactionContribution(t),
    settled: settledByIndex[index],
  }));
}

/**
 * Full settlement watermark summary for the grouped view: the per-transaction
 * `settled` flags plus the authoritative net and the total amount settled so far.
 * @param {Array} transactions
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {{transactions:Array, net:number, clearingPool:number}}
 *   net = computeSettlement().net (the authoritative "who owes whom" headline).
 *   clearingPool = total settle-ups, in the net's direction (informational).
 */
export function settlementWatermark(transactions = [], options = {}) {
  return {
    transactions: markSettled(transactions, options),
    net: computeSettlement(transactions, options).net,
    clearingPool: clearingPool(transactions),
  };
}

/**
 * Compute the settlement net, direction, and running series.
 * @param {Array} transactions  each requires .date, .source, .amount, .ownerSide
 * @param {{leftName?:string, rightName?:string}} options
 * @returns {{net:number, direction:{from:string,to:string,amount:number}, series:Array<{date:string,balance:number}>}}
 */
export function computeSettlement(transactions = [], options = {}) {
  const leftName = options.leftName || 'Left';
  const rightName = options.rightName || 'Right';

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const series = sorted.map(t => {
    running += transactionContribution(t);
    return { date: t.date, balance: running };
  });

  const net = series.length ? series[series.length - 1].balance : 0;
  const direction = net >= 0
    ? { from: rightName, to: leftName, amount: net }
    : { from: leftName, to: rightName, amount: -net };

  return { net, direction, series };
}
