import { applyExceptions, czechPublicHolidays, easterSunday, generateSeriesDates, isoWeekday, nationwideSchoolHolidays, weekStart } from './event-series';

describe('event-series', () => {
  it('generuje termíny ve vybrané dny v rámci období; mimo období nic', () => {
    // 1. 10. 2026 je čtvrtek
    const dates = generateSeriesDates({ from: '2026-10-01', to: '2026-10-31', weekdays: [4], intervalWeeks: 1 });
    expect(dates).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']);
    expect(generateSeriesDates({ from: '2026-10-31', to: '2026-10-01', weekdays: [4], intervalWeeks: 1 })).toEqual([]);
  });

  it('každý druhý týden a více dní v týdnu', () => {
    const dates = generateSeriesDates({ from: '2026-10-05', to: '2026-10-25', weekdays: [1, 3], intervalWeeks: 2 });
    expect(dates).toEqual(['2026-10-05', '2026-10-07', '2026-10-19', '2026-10-21']);
  });

  it('Velikonoce a pohyblivé svátky', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    const holidays = czechPublicHolidays(2026);
    expect(holidays.get('2026-04-03')).toBe('Velký pátek');
    expect(holidays.get('2026-04-06')).toBe('Velikonoční pondělí');
    expect(holidays.get('2026-10-28')).toBe('Vznik Československa');
  });

  it('výjimky: svátek i prázdniny se vynechají s důvodem, režim celý týden', () => {
    const dates = ['2026-10-27', '2026-10-28', '2026-12-29', '2027-01-05'];
    const occurrences = applyExceptions(dates, { publicHolidays: true, holidays: nationwideSchoolHolidays(2026, 2027), wholeWeek: false });
    expect(occurrences.map((o) => o.skipReason)).toEqual([undefined, 'Vznik Československa', 'Vánoční prázdniny', undefined]);

    const autumn = { from: '2026-10-29', to: '2026-10-30', label: 'Podzimní prázdniny' };
    expect(applyExceptions(['2026-10-27'], { publicHolidays: false, holidays: [autumn], wholeWeek: false })[0].skipReason).toBeUndefined();
    expect(applyExceptions(['2026-10-27'], { publicHolidays: false, holidays: [autumn], wholeWeek: true })[0].skipReason).toBe('Podzimní prázdniny');
  });

  it('pomocné funkce dnů', () => {
    expect(isoWeekday('2026-10-18')).toBe(7);
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
  });
});
