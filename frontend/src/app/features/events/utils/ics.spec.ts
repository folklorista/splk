import { AppEvent } from '../models/event.model';
import { buildIcs, foldLine, icsDateTime, icsEscape, selectIcsEvents } from './ics';

describe('ics', () => {
  const ev = (id: number, extra: Partial<AppEvent> = {}): AppEvent => ({ id, ensembleId: 1, title: `Akce ${id}`, type: 'performance', startsAt: '2026-11-05T17:00:00Z', endsAt: '2026-11-05T19:00:00Z', location: 'Sokolovna, sál', targetGroupIds: [], ...extra });
  const options = { types: ['performance' as const], skippedAsNotice: true, ensembleName: 'Vonica', now: new Date('2026-10-18T10:00:00Z') };

  it('převod času do UTC a escapování textu', () => {
    expect(icsDateTime('2026-11-05T17:00:00Z')).toBe('20261105T170000Z');
    expect(icsEscape('a, b; c\nd')).toBe('a\\, b\\; c\\nd');
  });

  it('výchozí výběr: typy podle nastavení, vynechané termíny jen s volbou', () => {
    const events = [ev(1), ev(2, { type: 'rehearsal' }), ev(3, { type: 'rehearsal', skippedReason: 'Státní svátek' })];
    expect(selectIcsEvents(events, { types: ['performance'], skippedAsNotice: false }).map((e) => e.id)).toEqual([1]);
    expect(selectIcsEvents(events, { types: ['performance'], skippedAsNotice: true }).map((e) => e.id)).toEqual([1, 3]);
  });

  it('vytvoří platný kalendář; vynechaný termín jako viditelné „NENÍ …“, ne zrušená událost', () => {
    const ics = buildIcs([ev(1), ev(3, { type: 'rehearsal', skippedReason: 'Podzimní prázdniny' })], options);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBeTrue();
    expect(ics).toContain('UID:event-1@moje.vonica.cz');
    expect(ics).toContain('LOCATION:Sokolovna\\, sál');
    expect(ics).toContain('SUMMARY:NENÍ VONICA – Podzimní prázdniny');
    expect(ics).toContain('TRANSP:TRANSPARENT');
    expect(ics).not.toContain('STATUS:CANCELLED');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBeTrue();
  });

  it('dlouhé řádky zalomí', () => {
    const folded = foldLine('X'.repeat(160));
    expect(folded.split('\r\n ').every((part) => part.length <= 75)).toBeTrue();
    expect(folded.replace(/\r\n /g, '')).toBe('X'.repeat(160));
  });
});
