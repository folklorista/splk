import {
  buildAttendanceCsv,
  buildAttendanceReport,
  defaultPeriod,
  expectedMembers,
  filterPeriodEvents,
  hasEventStarted,
  summarizeMember,
} from './actual-attendance.utils';
import { AppEvent } from '../../events/models/event.model';
import { Member } from '../../../core/models/member.model';
import { ActualAttendance } from '../models/actual-attendance.model';

describe('actual-attendance.utils', () => {
  const member = (id: number, nickname: string, groupIds: number[], isActive = true): Member => ({
    id, ensembleId: 1, userId: id, firstName: nickname, lastName: 'X', nickname, groupIds, isAdmin: false, isActive, createdAt: '2020-01-01',
  });
  const event = (id: number, startsAt: string, targetGroupIds: number[], type: AppEvent['type'] = 'rehearsal', title = `Akce ${id}`): AppEvent => ({
    id, ensembleId: 1, title, type, startsAt, endsAt: startsAt, location: 'Sál', targetGroupIds,
  });
  const rec = (eventId: number, memberId: number, present: boolean): ActualAttendance => ({
    eventId, memberId, present, recordedByMemberId: 99, recordedAt: '2026-01-01T00:00:00Z',
  });

  const members = [member(1, 'Zdena', [1]), member(2, 'Adam', [1, 2]), member(3, 'Bára', [2]), member(4, 'Bývalý', [1], false)];
  const now = new Date('2026-10-15T12:00:00');

  describe('expectedMembers', () => {
    it('vrátí aktivní členy cílových skupin', () => {
      expect(expectedMembers({ targetGroupIds: [1] }, members).map((m) => m.id)).toEqual([1, 2]);
    });

    it('akce bez cílení je pro všechny aktivní', () => {
      expect(expectedMembers({ targetGroupIds: [] }, members).map((m) => m.id)).toEqual([1, 2, 3]);
    });
  });

  describe('hasEventStarted', () => {
    it('rozliší proběhlou a budoucí akci', () => {
      expect(hasEventStarted({ startsAt: '2026-10-15T11:00:00' }, now)).toBeTrue();
      expect(hasEventStarted({ startsAt: '2026-10-15T18:00:00' }, now)).toBeFalse();
    });
  });

  describe('defaultPeriod', () => {
    it('vrátí poslední 3 měsíce do dneška', () => {
      expect(defaultPeriod(new Date(2026, 9, 15))).toEqual({ from: '2026-07-15', to: '2026-10-15' });
    });
  });

  describe('filterPeriodEvents', () => {
    const events = [
      event(3, '2026-10-01T18:00:00', [1], 'performance'),
      event(1, '2026-09-01T18:00:00', [1]),
      event(2, '2026-06-01T18:00:00', [1]),
      event(4, '2026-10-20T18:00:00', [1]),
    ];

    it('vybere jen začaté akce v období (včetně hraničních dní) seřazené od nejstarší', () => {
      const result = filterPeriodEvents(events, { from: '2026-09-01', to: '2026-10-31', type: 'all' }, now);
      expect(result.map((e) => e.id)).toEqual([1, 3]);
    });

    it('umí filtrovat podle typu akce', () => {
      const result = filterPeriodEvents(events, { from: '2026-01-01', to: '2026-12-31', type: 'rehearsal' }, now);
      expect(result.map((e) => e.id)).toEqual([2, 1]);
    });
  });

  describe('summarizeMember', () => {
    it('spočítá přítomnost ze zapsaných akcí v období', () => {
      const records = [rec(1, 1, true), rec(2, 1, false), rec(3, 1, true), rec(9, 1, false), rec(1, 2, false)];
      expect(summarizeMember(1, [1, 2, 3], records)).toEqual({ present: 2, recorded: 3, percentage: 67 });
    });

    it('bez zapsaných akcí je procento null', () => {
      expect(summarizeMember(1, [1], [])).toEqual({ present: 0, recorded: 0, percentage: null });
    });
  });

  describe('buildAttendanceReport', () => {
    const events = [event(1, '2026-09-01T18:00:00', [1]), event(2, '2026-09-02T18:00:00', [2])];

    it('sestaví řádky očekávaných členů seřazené podle přezdívky', () => {
      const report = buildAttendanceReport(events, members, []);
      expect(report.rows.map((r) => r.member.nickname)).toEqual(['Adam', 'Bára', 'Zdena']);
    });

    it('rozliší přítomen / nepřítomen / nezkontrolován / akce pro člena nebyla', () => {
      const report = buildAttendanceReport(events, members, [rec(1, 2, true), rec(2, 2, false)]);
      const byName = (name: string) => report.rows.find((r) => r.member.nickname === name)!;
      expect(byName('Adam').cells).toEqual([true, false]);
      expect(byName('Zdena').cells).toEqual([null, undefined]);
      expect(byName('Adam').summary).toEqual({ present: 1, recorded: 2, percentage: 50 });
    });

    it('zahrne i člena mimo cílové skupiny, pokud má zapsanou přítomnost', () => {
      const report = buildAttendanceReport([events[1]], members, [rec(2, 1, true)]);
      expect(report.rows.find((r) => r.member.id === 1)?.cells).toEqual([true]);
    });
  });

  describe('buildAttendanceCsv', () => {
    it('vytvoří CSV se středníky, BOM a českou hlavičkou', () => {
      const events = [event(1, '2026-09-01T18:00:00', [1], 'rehearsal', 'Nácvik; sál "2"')];
      const report = buildAttendanceReport(events, members, [rec(1, 2, true)]);
      const csv = buildAttendanceCsv(report);

      expect(csv.startsWith('﻿')).toBeTrue();
      const lines = csv.slice(1).trimEnd().split('\r\n');
      expect(lines[0]).toBe('Člen;"1. 9. 2026 Nácvik; sál ""2""";Přítomen;Zapsáno;Účast %');
      expect(lines[1]).toBe('Adam;ano;1;1;100');
      expect(lines[2]).toBe('Zdena;;0;0;');
    });

    it('nepřítomnost zapíše jako „ne“', () => {
      const report = buildAttendanceReport([event(1, '2026-09-01T18:00:00', [1])], [members[0]], [rec(1, 1, false)]);
      expect(buildAttendanceCsv(report).split('\r\n')[1]).toBe('Zdena;ne;0;1;0');
    });
  });
});
