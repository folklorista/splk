/** Four fractional digits support exact cost evidence without binary floating point or currency conversion. */
export function normalizeCostAmount(value: string): string {
  if (!/^-?(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/u.test(value)) throw new Error('invalid_cost_amount');
  const negative = value.startsWith('-'), [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const digits = whole + fraction.padEnd(4, '0');
  return `${negative && BigInt(digits) !== 0n ? '-' : ''}${whole}.${fraction.padEnd(4, '0')}`;
}
export function sumCostAmounts(values: readonly string[]): string {
  const total = values.reduce((sum, value) => sum + BigInt(normalizeCostAmount(value).replace('.', '')), 0n);
  const absolute = (total < 0n ? -total : total).toString().padStart(5, '0');
  return `${total < 0n ? '-' : ''}${absolute.slice(0, -4)}.${absolute.slice(-4)}`;
}
export function formatCostAmount(value: string): string {
  if (!/^-?\d+(?:\.\d{1,4})?$/u.test(value)) return value;
  const [whole, part = ''] = value.split('.'); const fraction = part.padEnd(2, '0').replace(/0+$/u, '').padEnd(2, '0');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/gu, '\u00a0') + ',' + fraction;
}
