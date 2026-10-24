export class NumberInputError extends Error {
  constructor(readonly code: 'empty' | 'invalid_number' | 'invalid_range' | 'too_many', readonly token = '') { super(code); }
}

/** Exact identifiers stay strings (03 differs from 3). Server validates every expanded entry again. */
export function parseInventoryNumbers(input: string, maximum = 200): string[] {
  if (!input.trim()) throw new NumberInputError('empty');
  if (input.length > 4000 || !Number.isInteger(maximum) || maximum < 1 || maximum > 200) throw new NumberInputError('too_many');
  const tokens = input.trim().replace(/(\d)\s*[-–]\s*(?=\d)/g, '$1-').split(/[\s,;]+/u).filter(Boolean);
  if (!tokens.length) throw new NumberInputError('empty');
  const numbers: string[] = [];
  for (const token of tokens) {
    const range = /^(\d+)-(\d+)$/.exec(token);
    if (range) {
      const start = Number(range[1]), end = Number(range[2]);
      const padded = /^0\d/.test(range[1]) || /^0\d/.test(range[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start || padded && range[1].length !== range[2].length) throw new NumberInputError('invalid_range', token);
      if (end - start + 1 > maximum - numbers.length) throw new NumberInputError('too_many', token);
      for (let value = start; value <= end; value++) numbers.push(String(value).padStart(padded ? range[1].length : 0, '0'));
    } else {
      if (token.length > 100 || !/^[\p{L}\p{N}_.\/-]+$/u.test(token) || !/[\p{L}\p{N}]/u.test(token) || /^[-\d]+$/.test(token) && token.includes('-')) throw new NumberInputError('invalid_number', token);
      numbers.push(token);
      if (numbers.length > maximum) throw new NumberInputError('too_many', token);
    }
  }
  return numbers;
}

export function formatInventoryNumber(series: string, number: string | null): string {
  return `${series.trim()} ${number ?? '(bez čísla)'}`.trim();
}
