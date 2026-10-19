import { formatEventRange } from './event-format';

describe('formatEventRange', () => {
  it('stejný den: datum jednou, čas od–do', () => {
    expect(formatEventRange('2026-10-23T17:00:00', '2026-10-23T18:30:00')).toBe('23. 10. 17:00 – 18:30');
  });

  it('přes více dní: datum u začátku i konce', () => {
    expect(formatEventRange('2026-10-23T17:00:00', '2026-10-25T12:05:00')).toBe('23. 10. 17:00 – 25. 10. 12:05');
  });
});
