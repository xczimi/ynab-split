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
