import { buildMonthGrid, eventsOnDay, toDateKey, weekdayLabel } from './calendar.utils';
import { AppEvent } from '../models/event.model';

describe('calendar.utils', () => {
  describe('buildMonthGrid', () => {
    it('začíná pondělím a doplní dny předchozího měsíce', () => {
      // 1. 10. 2026 je čtvrtek
      const grid = buildMonthGrid(2026, 9);
      expect(grid[0][0].dateKey).toBe('2026-09-28');
      expect(grid[0][0].inMonth).toBeFalse();
      expect(grid[0][3]).toEqual({ dateKey: '2026-10-01', day: 1, inMonth: true });
    });

    it('obsahuje celé týdny a všechny dny měsíce', () => {
      const grid = buildMonthGrid(2026, 9);
      expect(grid.every((w) => w.length === 7)).toBeTrue();
      const inMonth = grid.flat().filter((d) => d.inMonth);
      expect(inMonth.length).toBe(31);
      expect(inMonth[30].dateKey).toBe('2026-10-31');
    });

    it('nepřidá prázdný týden, když měsíc končí nedělí', () => {
      // Únor 2027 začíná pondělím a končí nedělí → přesně 4 týdny
      const grid = buildMonthGrid(2027, 1);
      expect(grid.length).toBe(4);
      expect(grid[3][6].dateKey).toBe('2027-02-28');
    });
  });

  it('toDateKey vrací lokální datum', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('weekdayLabel vrací českou zkratku dne', () => {
    expect(weekdayLabel('2026-10-13T18:00:00')).toBe('Út');
    expect(weekdayLabel('2026-10-18')).toBe('Ne');
  });

  describe('eventsOnDay', () => {
    const make = (id: number, startsAt: string, endsAt: string): AppEvent => ({
      id, ensembleId: 1, title: `Akce ${id}`, type: 'other', startsAt, endsAt, location: '', targetGroupIds: [],
    });

    it('vrátí víc akcí v jednom dni seřazených podle začátku', () => {
      const events = [
        make(1, '2026-10-16T19:00:00', '2026-10-16T21:00:00'),
        make(2, '2026-10-16T14:00:00', '2026-10-16T16:00:00'),
        make(3, '2026-10-17T14:00:00', '2026-10-17T16:00:00'),
      ];
      expect(eventsOnDay(events, '2026-10-16').map((e) => e.id)).toEqual([2, 1]);
    });

    it('zahrne vícedenní akci do každého jejího dne', () => {
      const camp = make(1, '2026-10-20T15:00:00', '2026-10-24T17:00:00');
      expect(eventsOnDay([camp], '2026-10-22').length).toBe(1);
      expect(eventsOnDay([camp], '2026-10-25').length).toBe(0);
    });
  });
});
