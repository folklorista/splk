import { AppEvent } from '../events/models/event.model';
import { needsResponse } from '../events/utils/event-reminders';
import { changeAcknowledgement } from '../events/utils/event-views';
import { AccessSubject, canRecordAttendance, isEventAudience, isGroupManager } from '../../core/access/access.utils';
import { Member } from '../../core/models/member.model';
import { JoinRequest } from '../groups/models/join-request.model';
import { Group } from '../../core/models/group.model';
import { CostumeState } from '../costumes/models/costume.model';
import { myCostumeRows } from '../costumes/utils/costume-logic';
import { currentVisit, invitationsFor } from '../costumes/utils/inventory-logic';
import { ActualAttendance } from '../attendance/models/actual-attendance.model';

// „Čeká na vás“ na Přehledu (docs/10 kap. 7.2): jeden seznam povinností napříč moduly.
// Každá oblast dodává své položky; zmizí, jakmile je věc vyřízená.

export type PendingActionKind = 'event-response' | 'event-change' | 'group-invitation' | 'group-requests' | 'inventory-booking' | 'loan-overdue' | 'attendance-record';

export interface PendingAction {
  key: string;
  kind: PendingActionKind;
  title: string;
  detail?: string;
  link: (string | number)[];
  queryParams?: Record<string, string>;
  // Pro řazení: nejdřív to, co hoří (termín akce, vrácení…)
  sortAt: string;
  // U výzvy k účasti rovnou tlačítka Přijdu / Nepřijdu
  eventId?: number;
}

// Docházku k zapsání připomínáme ještě dva týdny po akci
export const ATTENDANCE_REMINDER_DAYS = 14;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });

export function eventResponseActions(events: AppEvent[], member: Member, now = new Date()): PendingAction[] {
  return events
    .filter((e) => isEventAudience(member, e))
    .filter((e) => needsResponse(e, e.attendance?.find((a) => a.memberId === member.id)?.status ?? 'pending', now))
    .map((e) => ({
      key: `event-${e.id}`,
      kind: 'event-response' as const,
      title: `${e.title} – odpovězte na účast`,
      detail: fmtDate(e.startsAt),
      link: ['/app/events', e.id],
      sortAt: e.startsAt,
      eventId: e.id,
    }));
}

// Důležitá změna nadcházející akce, kterou člen ještě neotevřel nebo nepotvrdil
export function eventChangeActions(events: AppEvent[], member: Member, now = new Date()): PendingAction[] {
  return events
    .filter((e) => Date.parse(e.startsAt) >= now.getTime() && isEventAudience(member, e))
    .map((e) => ({ event: e, need: changeAcknowledgement(e, e.attendance?.find((a) => a.memberId === member.id)) }))
    .filter((x) => x.need)
    .map(({ event, need }) => ({
      key: `change-${event.id}`,
      kind: 'event-change' as const,
      title: `${event.title} – ${need === 'confirm' ? 'potvrďte přečtení důležité zprávy' : 'důležitá změna'}`,
      detail: event.importantChange!.note,
      link: ['/app/events', event.id],
      sortAt: event.importantChange!.at,
    }));
}

export function groupRequestActions(requests: JoinRequest[], subject: AccessSubject | null, groups: Pick<Group, 'id' | 'name' | 'slug'>[]): PendingAction[] {
  if (!subject) return [];
  const groupName = (id: number) => groups.find((g) => g.id === id)?.name ?? 'skupina';
  const groupSlug = (id: number) => groups.find((g) => g.id === id)?.slug ?? '';
  const invitations: PendingAction[] = requests
    .filter((r) => r.status === 'awaiting-member' && r.memberId === subject.memberId)
    .map((r) => ({ key: `invitation-${r.id}`, kind: 'group-invitation', title: `Pozvánka do skupiny ${groupName(r.groupId)}`, link: ['/app/boards'], sortAt: r.createdAt }));
  const byGroup = new Map<number, JoinRequest[]>();
  for (const r of requests.filter((x) => x.status === 'awaiting-manager' && isGroupManager(subject, x.groupId))) {
    byGroup.set(r.groupId, [...(byGroup.get(r.groupId) ?? []), r]);
  }
  const decisions: PendingAction[] = [...byGroup.entries()].map(([groupId, list]) => ({
    key: `requests-${groupId}`,
    kind: 'group-requests',
    title: `${list.length === 1 ? '1 žádost' : `${list.length} žádosti`} o vstup do skupiny ${groupName(groupId)}`,
    link: ['/app/boards', groupSlug(groupId)],
    queryParams: { tab: 'manage' },
    sortAt: list.map((r) => r.createdAt).sort()[0],
  }));
  return [...invitations, ...decisions];
}

export function costumeActions(state: CostumeState, memberId: number, now = new Date()): PendingAction[] {
  const borrower = { kind: 'member' as const, memberId };
  const inventories: PendingAction[] = invitationsFor(state, memberId)
    .filter((inv) => !currentVisit(state, inv.id, borrower))
    .map((inv) => ({ key: `inventory-${inv.id}`, kind: 'inventory-booking', title: `Inventura krojů – vyberte termín návštěvy`, detail: inv.name, link: ['/app/costumes'], sortAt: inv.startedAt }));
  const overdue: PendingAction[] = myCostumeRows(state, memberId, now)
    .filter((row) => row.overdue)
    .map((row) => ({ key: `loan-${row.loanId}`, kind: 'loan-overdue', title: `Vraťte ${row.part} ${row.number}`, detail: row.dueAt ? `termín ${fmtDate(row.dueAt)}` : undefined, link: ['/app/costumes'], sortAt: row.dueAt ?? row.issuedAt }));
  return [...inventories, ...overdue];
}

// Proběhlé akce (do 14 dnů), u kterých smím evidovat docházku a není zapsaná vůbec
export function attendanceRecordActions(events: AppEvent[], actual: ActualAttendance[], subject: AccessSubject | null, now = new Date()): PendingAction[] {
  if (!subject) return [];
  const since = now.getTime() - ATTENDANCE_REMINDER_DAYS * 24 * 60 * 60 * 1000;
  const recorded = new Set(actual.map((a) => a.eventId));
  return events
    .filter((e) => Date.parse(e.endsAt) <= now.getTime() && Date.parse(e.endsAt) >= since)
    .filter((e) => !e.skippedReason && !recorded.has(e.id) && canRecordAttendance(subject, e))
    .map((e) => ({ key: `attendance-${e.id}`, kind: 'attendance-record', title: `${e.title} – zapište docházku`, detail: fmtDate(e.startsAt), link: ['/app/events', e.id], sortAt: e.startsAt }));
}

export function sortPendingActions(actions: PendingAction[]): PendingAction[] {
  return [...actions].sort((a, b) => a.sortAt.localeCompare(b.sortAt));
}
