import { AppEvent, EventType } from '../../events/models/event.model';
import { Member } from '../../../core/models/member.model';
import { ActualAttendance } from '../models/actual-attendance.model';
import { isItemVisibleToUser } from '../../../core/utils/visibility.utils';

export interface AttendancePeriodFilter {
  from: string; // yyyy-mm-dd, včetně
  to: string; // yyyy-mm-dd, včetně
  type: EventType | 'all';
}

// true/false = zapsáno, null = člen byl očekáván, ale nezkontrolován, undefined = akce pro něj nebyla
export type AttendanceCell = boolean | null | undefined;

export interface MemberAttendanceSummary {
  present: number;
  recorded: number;
  percentage: number | null;
}

export interface AttendanceReportRow {
  member: Member;
  cells: AttendanceCell[];
  summary: MemberAttendanceSummary;
}

export interface AttendanceReport {
  events: AppEvent[];
  rows: AttendanceReportRow[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Výchozí období přehledu – poslední 3 měsíce do dneška
export function defaultPeriod(today = new Date()): { from: string; to: string } {
  const from = new Date(today);
  from.setMonth(from.getMonth() - 3);
  return { from: toDateKey(from), to: toDateKey(today) };
}

// Očekávaní účastníci = aktivní členové skupin, kterým je akce určená
export function expectedMembers(event: Pick<AppEvent, 'targetGroupIds'>, members: Member[]): Member[] {
  return members.filter((m) => m.isActive && isItemVisibleToUser(event.targetGroupIds, m.groupIds));
}

// Docházku lze zapisovat od začátku akce
export function hasEventStarted(event: Pick<AppEvent, 'startsAt'>, now = new Date()): boolean {
  return Date.parse(event.startsAt) <= now.getTime();
}

// Proběhlé (už začaté) akce v období, seřazené od nejstarší
export function filterPeriodEvents(events: AppEvent[], filter: AttendancePeriodFilter, now = new Date()): AppEvent[] {
  return events
    .filter((e) => hasEventStarted(e, now))
    .filter((e) => {
      const day = e.startsAt.slice(0, 10);
      return (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
    })
    .filter((e) => filter.type === 'all' || e.type === filter.type)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Souhrn za období – procento se počítá jen ze zapsaných akcí (nezkontrolované se nepočítají)
export function summarizeMember(memberId: number, eventIds: number[], records: ActualAttendance[]): MemberAttendanceSummary {
  const ids = new Set(eventIds);
  const own = records.filter((r) => r.memberId === memberId && ids.has(r.eventId));
  const present = own.filter((r) => r.present).length;
  const recorded = own.length;
  return { present, recorded, percentage: recorded ? Math.round((present / recorded) * 100) : null };
}

// Tabulka členové × akce. Řádky = aktivní členové očekávaní alespoň na jedné akci
// a také kdokoli, kdo má v období zapsaný záznam (např. host z jiné skupiny).
export function buildAttendanceReport(events: AppEvent[], members: Member[], records: ActualAttendance[]): AttendanceReport {
  const eventIds = events.map((e) => e.id);
  const eventIdSet = new Set(eventIds);
  const periodRecords = records.filter((r) => eventIdSet.has(r.eventId));
  const recordMap = new Map(periodRecords.map((r) => [`${r.eventId}:${r.memberId}`, r.present]));
  const expected = events.map((e) => new Set(expectedMembers(e, members).map((m) => m.id)));
  const recordedMemberIds = new Set(periodRecords.map((r) => r.memberId));

  const rows = members
    .filter((m) => recordedMemberIds.has(m.id) || expected.some((set) => set.has(m.id)))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'cs'))
    .map((member): AttendanceReportRow => ({
      member,
      cells: events.map((e, i) => {
        const value = recordMap.get(`${e.id}:${member.id}`);
        if (value !== undefined) return value;
        return expected[i].has(member.id) ? null : undefined;
      }),
      summary: summarizeMember(member.id, eventIds, periodRecords),
    }));

  return { events, rows };
}

export function formatEventDate(startsAt: string): string {
  const date = new Date(startsAt);
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;
}

export function formatSummary(summary: MemberAttendanceSummary): string {
  return summary.percentage === null ? '–' : `${summary.percentage} %`;
}

function csvField(value: string | number): string {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_CELL: Record<string, string> = { true: 'ano', false: 'ne', null: '', undefined: '' };

// CSV pro Excel: středníky, BOM (aby Excel poznal UTF-8), řádky \r\n
export function buildAttendanceCsv(report: AttendanceReport): string {
  const header = [
    'Člen',
    ...report.events.map((e) => `${formatEventDate(e.startsAt)} ${e.title}`),
    'Přítomen',
    'Zapsáno',
    'Účast %',
  ];
  const lines = report.rows.map((row) => [
    row.member.nickname,
    ...row.cells.map((cell) => CSV_CELL[String(cell)]),
    row.summary.present,
    row.summary.recorded,
    row.summary.percentage ?? '',
  ]);
  return '﻿' + [header, ...lines].map((line) => line.map(csvField).join(';')).join('\r\n') + '\r\n';
}
