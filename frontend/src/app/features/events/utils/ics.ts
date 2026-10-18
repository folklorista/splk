import { AppEvent, EventType } from '../models/event.model';

// Export do iCalendar (.ics, RFC 5545) – jednorázové stažení (docs/07 kap. 17). Průběžný odběr s tokenem
// přijde s backendem. Vynechané termíny série jdou jako viditelné informační události „NENÍ <soubor> – důvod“,
// ne jako skryté STATUS:CANCELLED.

export interface IcsOptions {
  // Které typy akcí exportovat; vynechané termíny se řídí volbou skippedAsNotice
  types: EventType[];
  skippedAsNotice: boolean;
  ensembleName: string;
  host?: string;
  now?: Date;
}

export const DEFAULT_ICS_TYPES: EventType[] = ['performance', 'camp', 'meeting', 'other'];

const pad = (n: number) => String(n).padStart(2, '0');

// UTC ve tvaru 20261105T170000Z
export function icsDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Řádky delší než 75 znaků se zalamují (pokračování začíná mezerou)
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += i === 0 ? 75 : 74) parts.push(line.slice(i, i === 0 ? 75 : i + 74));
  return parts.join('\r\n ');
}

export function selectIcsEvents(events: AppEvent[], options: Pick<IcsOptions, 'types' | 'skippedAsNotice'>): AppEvent[] {
  return events.filter((e) => (e.skippedReason ? options.skippedAsNotice : options.types.includes(e.type)));
}

export function buildIcs(events: AppEvent[], options: IcsOptions): string {
  const host = options.host ?? 'moje.vonica.cz';
  const stamp = icsDateTime(options.now ?? new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${icsEscape(options.ensembleName)}//Souborovy system//CS`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const event of selectIcsEvents(events, options)) {
    const skipped = !!event.skippedReason;
    lines.push(
      'BEGIN:VEVENT',
      `UID:event-${event.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDateTime(event.startsAt)}`,
      `DTEND:${icsDateTime(event.endsAt)}`,
      `SUMMARY:${icsEscape(skipped ? `NENÍ ${options.ensembleName.toUpperCase()} – ${event.skippedReason}` : event.title)}`,
      ...(event.location && !skipped ? [`LOCATION:${icsEscape(event.location)}`] : []),
      ...(event.description && !skipped ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
      // Vynechaný termín jen informuje – neblokuje čas v kalendáři
      ...(skipped ? ['TRANSP:TRANSPARENT'] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// Stažení souboru v prohlížeči
export function downloadIcs(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
