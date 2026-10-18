// Série nácviků (docs/07 kap. 17): konečné období, opakování po týdnech ve vybrané dny a čas.
// Každý výskyt je samostatná akce s vlastní účastí a docházkou. Výjimky (svátky, prázdniny) se při
// založení jednorázově předvyplní, uživatel je v náhledu upraví a uloží se jako „Vynecháno + důvod“.
// Pozdější změna pravidel existující sérii tiše nepřepočítává. Mimo období série nic nevzniká.

export interface SeriesRule {
  // Datum první možné akce a posledního dne série (YYYY-MM-DD)
  from: string;
  to: string;
  // Dny v týdnu: 1 = pondělí … 7 = neděle
  weekdays: number[];
  // Každý / každý druhý týden …
  intervalWeeks: number;
}

export interface HolidayRange {
  from: string;
  to: string;
  label: string;
}

export interface SeriesOccurrence {
  date: string;
  // Důvod vynechání; chybí = akce se koná
  skipReason?: string;
}

// Ochrana proti omylem obrovské sérii
export const MAX_SERIES_OCCURRENCES = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return toDateString(new Date(parse(date).getTime() + days * DAY_MS));
}

// Den v týdnu 1–7 (pondělí–neděle)
export function isoWeekday(date: string): number {
  const day = parse(date).getUTCDay();
  return day === 0 ? 7 : day;
}

// Pondělí týdne, do kterého datum patří
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export function generateSeriesDates(rule: SeriesRule): string[] {
  if (!rule.from || !rule.to || rule.to < rule.from || !rule.weekdays.length) return [];
  const interval = Math.max(1, Math.round(rule.intervalWeeks || 1));
  const firstWeek = weekStart(rule.from);
  const dates: string[] = [];
  for (let date = rule.from; date <= rule.to && dates.length < MAX_SERIES_OCCURRENCES; date = addDays(date, 1)) {
    const weekIndex = Math.round((parse(weekStart(date)).getTime() - parse(firstWeek).getTime()) / (7 * DAY_MS));
    if (weekIndex % interval === 0 && rule.weekdays.includes(isoWeekday(date))) dates.push(date);
  }
  return dates;
}

// Velikonoční neděle (anonymní gregoriánský algoritmus)
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Státní svátky a ostatní svátky ČR (dny pracovního klidu)
export function czechPublicHolidays(year: number): Map<string, string> {
  const fixed: [string, string][] = [
    ['01-01', 'Nový rok'],
    ['05-01', 'Svátek práce'],
    ['05-08', 'Den vítězství'],
    ['07-05', 'Cyril a Metoděj'],
    ['07-06', 'Mistr Jan Hus'],
    ['09-28', 'Den české státnosti'],
    ['10-28', 'Vznik Československa'],
    ['11-17', 'Den boje za svobodu a demokracii'],
    ['12-24', 'Štědrý den'],
    ['12-25', '1. svátek vánoční'],
    ['12-26', '2. svátek vánoční'],
  ];
  const map = new Map(fixed.map(([md, name]) => [`${year}-${md}`, name]));
  const easter = easterSunday(year);
  map.set(addDays(easter, -2), 'Velký pátek');
  map.set(addDays(easter, 1), 'Velikonoční pondělí');
  return map;
}

// Celostátní školní prázdniny, které lze předvyplnit spolehlivě: vánoční (23. 12.–2. 1.) a velikonoční
// čtvrtek. Podzimní, pololetní a jarní (podle okresu) zadá organizátor sám – data se liší po letech a okresech.
export function nationwideSchoolHolidays(fromYear: number, toYear: number): HolidayRange[] {
  const ranges: HolidayRange[] = [];
  for (let year = fromYear - 1; year <= toYear; year++) {
    ranges.push({ from: `${year}-12-23`, to: `${year + 1}-01-02`, label: 'Vánoční prázdniny' });
  }
  for (let year = fromYear; year <= toYear; year++) {
    const thursday = addDays(easterSunday(year), -3);
    ranges.push({ from: thursday, to: thursday, label: 'Velikonoční prázdniny' });
  }
  return ranges;
}

export interface ExceptionOptions {
  publicHolidays: boolean;
  holidays: HolidayRange[];
  // Vynechat celý týden, ve kterém jsou prázdniny
  wholeWeek: boolean;
}

// Předvyplnění výjimek: svátek → „Vynecháno: <svátek>“, prázdniny → „Vynecháno: <prázdniny>“
export function applyExceptions(dates: string[], options: ExceptionOptions): SeriesOccurrence[] {
  const years = new Set(dates.map((d) => Number(d.slice(0, 4))));
  const holidaysByDate = new Map<string, string>();
  if (options.publicHolidays) {
    for (const year of years) czechPublicHolidays(year).forEach((name, date) => holidaysByDate.set(date, name));
  }
  const inRange = (date: string, range: HolidayRange) => {
    if (!options.wholeWeek) return date >= range.from && date <= range.to;
    return weekStart(date) >= weekStart(range.from) && weekStart(date) <= weekStart(range.to);
  };
  return dates.map((date) => {
    const holiday = holidaysByDate.get(date);
    const range = options.holidays.find((r) => r.from && r.to && inRange(date, r));
    const skipReason = holiday ?? (range ? range.label.trim() || 'Prázdniny' : undefined);
    return skipReason ? { date, skipReason } : { date };
  });
}
