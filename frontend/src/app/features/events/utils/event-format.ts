// Zkrácený termín akce: „23. 10. 17:00 – 18:30“, přes více dní „23. 10. 17:00 – 24. 10. 12:00“
export function formatEventRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = (d: Date) => `${d.getDate()}. ${d.getMonth() + 1}.`;
  const time = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? `${date(start)} ${time(start)} – ${time(end)}` : `${date(start)} ${time(start)} – ${date(end)} ${time(end)}`;
}
