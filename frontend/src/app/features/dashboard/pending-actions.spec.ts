import { AppEvent } from '../events/models/event.model';
import { Member } from '../../core/models/member.model';
import { AccessSubject } from '../../core/access/access.utils';
import { testMandate } from '../../testing/access.testing';
import { seedCostumeState } from '../costumes/data/mock-costumes';
import { MOCK_MEMBERS } from '../members/data/mock-members';
import { attendanceRecordActions, costumeActions, eventChangeActions, eventResponseActions, groupRequestActions, sortPendingActions } from './pending-actions';
import { invitationsFor } from '../costumes/utils/inventory-logic';

describe('pending-actions', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const day = (offset: number) => new Date(now.getTime() + offset * 24 * 60 * 60 * 1000).toISOString();
  const member: Member = { id: 10, ensembleId: 1, userId: 10, firstName: 'A', lastName: 'B', nickname: 'Ája', groupIds: [2], isActive: true, createdAt: '' };
  const subject = (mandates = [] as AccessSubject['mandates']): AccessSubject => ({ memberId: 10, groupIds: [2], isExternal: false, mandates });
  const ev = (id: number, extra: Partial<AppEvent> = {}): AppEvent => ({ id, ensembleId: 1, title: `Akce ${id}`, type: 'rehearsal', startsAt: day(3), endsAt: day(3), location: '', targetGroupIds: [], ...extra });

  it('výzva k účasti jen v předstihu a bez odpovědi', () => {
    const events = [ev(1), ev(2, { startsAt: day(30), endsAt: day(30) }), ev(3, { attendance: [{ eventId: 3, memberId: 10, status: 'yes' }] })];
    expect(eventResponseActions(events, member, now).map((a) => a.eventId)).toEqual([1]);
  });

  it('pozvánka pro mě a žádosti ve skupinách, které spravuji (seskupené po skupině)', () => {
    const groups = [{ id: 2, name: 'Holky', slug: 'holky' }, { id: 3, name: 'Kluci', slug: 'kluci' }];
    const req = (id: number, groupId: number, status: 'awaiting-member' | 'awaiting-manager', memberId: number) => ({ id, groupId, memberId, kind: 'request' as const, status, createdById: memberId, createdAt: day(-id) });
    const requests = [req(1, 3, 'awaiting-member', 10), req(2, 2, 'awaiting-manager', 20), req(3, 2, 'awaiting-manager', 21), req(4, 3, 'awaiting-manager', 22)];
    const actions = groupRequestActions(requests, subject([testMandate(10, 'group-owner', { groupId: 2 })]), groups);
    expect(actions.map((a) => a.kind)).toEqual(['group-invitation', 'group-requests']);
    expect(actions[1].title).toContain('2 žádosti');
    expect(actions[1].link).toEqual(['/app/boards', 'holky']);
  });

  it('kroje: výzva k inventuře bez rezervace termínu a vrácení po termínu', () => {
    const state = seedCostumeState(MOCK_MEMBERS);
    const invited = MOCK_MEMBERS.find((m) => invitationsFor(state, m.id).length)!;
    state.inventoryVisits = state.inventoryVisits.filter((v) => !(v.borrower.kind === 'member' && v.borrower.memberId === invited.id));
    expect(costumeActions(state, invited.id, now).some((a) => a.kind === 'inventory-booking')).toBeTrue();
    const loan = state.loans.find((l) => !l.endedAt && l.borrower.kind === 'member')!;
    loan.dueAt = day(-2);
    const holderId = loan.borrower.kind === 'member' ? loan.borrower.memberId : 0;
    expect(costumeActions(state, holderId, now).some((a) => a.kind === 'loan-overdue')).toBeTrue();
  });

  it('docházka k zapsání jen pro pověřené, po akci (do 14 dnů) a jen když není zapsaná', () => {
    const past = ev(5, { startsAt: day(-2), endsAt: day(-2) });
    const old = ev(6, { startsAt: day(-30), endsAt: day(-30) });
    expect(attendanceRecordActions([past, old], [], subject(), now)).toEqual([]);
    const recorder = subject([testMandate(10, 'attendance')]);
    expect(attendanceRecordActions([past, old], [], recorder, now).map((a) => a.key)).toEqual(['attendance-5']);
    expect(attendanceRecordActions([past], [{ eventId: 5, memberId: 1, present: true, recordedByMemberId: 10, recordedAt: '' }], recorder, now)).toEqual([]);
  });

  it('řadí podle naléhavosti (nejbližší termín první)', () => {
    const sorted = sortPendingActions([
      { key: 'b', kind: 'event-response', title: '', link: [], sortAt: day(5) },
      { key: 'a', kind: 'loan-overdue', title: '', link: [], sortAt: day(-3) },
    ]);
    expect(sorted.map((a) => a.key)).toEqual(['a', 'b']);
  });

  it('důležitá změna: připomínka, dokud člen detail neotevře; s potvrzením, dokud nepotvrdí', () => {
    const change = { at: day(-1), note: 'Sraz dřív' };
    expect(eventChangeActions([ev(7, { importantChange: change })], member, now).length).toBe(1);
    const viewed = [{ eventId: 7, memberId: 10, status: 'yes' as const, lastViewedAt: day(0) }];
    expect(eventChangeActions([ev(7, { importantChange: change, attendance: viewed })], member, now)).toEqual([]);
    const confirm = { ...change, requiresConfirmation: true };
    expect(eventChangeActions([ev(7, { importantChange: confirm, attendance: viewed })], member, now)[0].title).toContain('potvrďte');
  });
});
