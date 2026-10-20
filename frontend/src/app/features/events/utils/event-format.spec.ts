import { formatEventRange, groupByMonth } from './event-format';

describe('formatEventRange', () => {
  it('stejný den: datum jednou, čas od–do', () => {
    expect(formatEventRange('2026-10-23T17:00:00', '2026-10-23T18:30:00')).toBe('23. 10. 17:00 – 18:30');
  });

  it('přes více dní: datum u začátku i konce', () => {
    expect(formatEventRange('2026-10-23T17:00:00', '2026-10-25T12:05:00')).toBe('23. 10. 17:00 – 25. 10. 12:05');
  });
});

describe('groupByMonth', () => {
  const now = new Date(2026, 9, 20);
  const at = (y: number, m: number, d: number) => ({ startsAt: new Date(y, m, d, 18).toISOString() });

  it('seskupí po sobě jdoucí akce podle měsíce a zachová pořadí', () => {
    const groups = groupByMonth([at(2026, 9, 20), at(2026, 9, 27), at(2026, 10, 3)], now);

    expect(groups.map((g) => g.label)).toEqual(['říjen', 'listopad']);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
  });

  it('u jiného roku přidá k měsíci rok', () => {
    const groups = groupByMonth([at(2026, 11, 18), at(2027, 0, 8)], now);

    expect(groups.map((g) => g.label)).toEqual(['prosinec', 'leden 2027']);
  });

  it('sestupné pořadí (uplynulé) vytvoří skupiny od nejnovější', () => {
    const groups = groupByMonth([at(2026, 9, 11), at(2026, 8, 30), at(2025, 11, 1)], now);

    expect(groups.map((g) => g.label)).toEqual(['říjen', 'září', 'prosinec 2025']);
  });
});
