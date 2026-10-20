// Zkrácený termín akce: „23. 10. 17:00 – 18:30“, přes více dní „23. 10. 17:00 – 24. 10. 12:00“
export function formatEventRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = (d: Date) => `${d.getDate()}. ${d.getMonth() + 1}.`;
  const time = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? `${date(start)} ${time(start)} – ${time(end)}` : `${date(start)} ${time(start)} – ${date(end)} ${time(end)}`;
}

const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

export interface MonthGroup<T> {
  key: string;
  label: string;
  items: T[];
}

// Rozdělí (už seřazené) akce do měsíců se zachováním pořadí: „říjen 2026“, „listopad 2026“…
// Rok se u aktuálního roku vynechává, aby nadpisy byly krátké.
export function groupByMonth<T extends { startsAt: string }>(items: T[], now = new Date()): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const item of items) {
    const d = new Date(item.startsAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label = d.getFullYear() === now.getFullYear() ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
