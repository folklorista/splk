import { AppEvent } from '../models/event.model';

export const WEEKDAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export const MONTH_LABELS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

export interface CalendarDay {
  dateKey: string;
  day: number;
  inMonth: boolean;
}

// Lokální datum ve tvaru YYYY-MM-DD (stejný tvar jako začátek startsAt/endsAt)
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Česká zkratka dne v týdnu pro datum ve tvaru YYYY-MM-DD…
export function weekdayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.slice(0, 10).split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return WEEKDAY_LABELS[(jsDay + 6) % 7];
}

// Mřížka měsíce po týdnech (pondělí–neděle), doplněná o dny sousedních měsíců
export function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cursor = new Date(year, month, 1 - offset);

  const weeks: CalendarDay[][] = [];
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ dateKey: toDateKey(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === month);

  return weeks;
}

// Akce probíhající v daný den – vícedenní akce (soustředění) se počítá do každého svého dne
export function eventsOnDay(events: AppEvent[], dateKey: string): AppEvent[] {
  return events
    .filter((e) => e.startsAt.slice(0, 10) <= dateKey && e.endsAt.slice(0, 10) >= dateKey)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
