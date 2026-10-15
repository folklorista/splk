import { toCsv } from './export.utils';

describe('toCsv', () => {
  it('odděluje středníkem a escapuje uvozovky a středníky', () => {
    expect(toCsv([['a', 'b;c'], ['"x"', 1], [undefined, null]])).toBe('a;"b;c"\r\n"""x""";1\r\n;');
  });
});
