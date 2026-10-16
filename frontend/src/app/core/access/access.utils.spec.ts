import { Group } from '../models/group.model';
import { Mandate } from '../models/mandate.model';
import * as access from './access.utils';
import { testMandate, testMember } from '../../testing/access.testing';

// Akceptační scénáře docs/08 kap. 13.1 nad čistými pravidly
describe('access.utils', () => {
  const holky: Group = { id: 5, ensembleId: 1, name: 'Holky', slug: 'holky', visibility: 'private' };
  const kluci: Group = { id: 4, ensembleId: 1, name: 'Kluci', slug: 'kluci' };
  const otevrena: Group = { id: 8, ensembleId: 1, name: 'Propagace', slug: 'propagace', visibility: 'open' };
  const skryta: Group = { id: 9, ensembleId: 1, name: 'Velikonoce', slug: 'velikonoce', visibility: 'hidden' };

  const subject = (groupIds: number[], mandates: Mandate[] = [], extra: Partial<access.AccessSubject> = {}): access.AccessSubject => ({
    memberId: 1,
    groupIds,
    isExternal: false,
    mandates,
    ...extra,
  });

  describe('soukromí skupin', () => {
    it('Správa souboru (i technická správa skupiny) nečte obsah skupiny, kde není členem', () => {
      const kubaD = subject([4], [testMandate(1, 'ensemble-admin'), testMandate(1, 'group-owner', { groupId: 5 })]);
      expect(access.canReadGroupContent(kubaD, holky)).toBeFalse();
      expect(access.canModerateGroup(kubaD, holky)).toBeFalse();
      expect(access.canSeeReadStats(kubaD, holky)).toBeFalse();
      // spravovat smí
      expect(access.canManageGroupMembership(kubaD, 5)).toBeTrue();
      expect(access.canEditGroupMetadata(kubaD, 5)).toBeTrue();
    });

    it('člen čte a píše, otevřenou skupinu ostatní jen čtou, externista ne', () => {
      expect(access.canReadGroupContent(subject([5]), holky)).toBeTrue();
      expect(access.canReadGroupContent(subject([]), otevrena)).toBeTrue();
      expect(access.canPostInGroup(subject([]), otevrena)).toBeFalse();
      expect(access.canReadGroupContent(subject([], [], { isExternal: true }), otevrena)).toBeFalse();
    });

    it('skrytou skupinu nečlen nevidí ani v nabídce, soukromou ano', () => {
      expect(access.canSeeGroup(subject([]), skryta)).toBeFalse();
      expect(access.canSeeGroup(subject([9]), skryta)).toBeTrue();
      expect(access.canSeeGroup(subject([]), holky)).toBeTrue();
      expect(access.canRequestToJoin(subject([]), holky)).toBeTrue();
      expect(access.canRequestToJoin(subject([]), skryta)).toBeFalse();
      expect(access.canJoinDirectly(subject([]), otevrena)).toBeTrue();
      expect(access.canJoinDirectly(subject([]), holky)).toBeFalse();
    });
  });

  describe('správa skupiny', () => {
    it('hlavní správkyně spravuje svou skupinu, ale ne cizí', () => {
      const anycka = subject([5], [testMandate(1, 'group-owner', { groupId: 5 })]);
      expect(access.canManageGroupMembership(anycka, 5)).toBeTrue();
      expect(access.canEditGroupMetadata(anycka, 5)).toBeTrue();
      expect(access.canManageGroupMembership(anycka, 4)).toBeFalse();
      expect(access.canEditGroupCommunication(anycka, 4)).toBeFalse();
    });

    it('spolusprávce moderuje a schvaluje, ale nepověřuje další správce a nemění metadata', () => {
      const tezi = subject([5, 2], [testMandate(1, 'group-deputy', { groupId: 5 }), testMandate(1, 'group-deputy', { groupId: 2 })]);
      expect(access.canModerateGroup(tezi, holky)).toBeTrue();
      expect(access.canManageGroupMembership(tezi, 2)).toBeTrue();
      expect(access.canEditGroupCommunication(tezi, 5)).toBeTrue();
      expect(access.canAssignGroupManagers(tezi, 5)).toBeFalse();
      expect(access.canEditGroupMetadata(tezi, 5)).toBeFalse();
      expect(access.groupRole(tezi, 5)).toBe('deputy');
    });

    it('zakládání skupin podle konfigurace souboru', () => {
      expect(access.canCreateGroup(subject([]), { groupCreation: 'admins' })).toBeFalse();
      expect(access.canCreateGroup(subject([], [testMandate(1, 'ensemble-admin')]), { groupCreation: 'admins' })).toBeTrue();
      expect(access.canCreateGroup(subject([]), { groupCreation: 'members' })).toBeTrue();
      expect(access.canCreateGroup(subject([], [], { isExternal: true }), { groupCreation: 'members' })).toBeFalse();
    });
  });

  describe('akce a docházka', () => {
    const event = { id: 10, targetGroupIds: [2], organizerGroupIds: [4] };

    it('Správa souboru sama neupraví akci ani nezapíše docházku', () => {
      const admin = subject([], [testMandate(1, 'ensemble-admin')]);
      expect(access.canEditEvent(admin, event)).toBeFalse();
      expect(access.canRecordAttendance(admin, event)).toBeFalse();
      expect(access.canCreateEvents(admin)).toBeFalse();
    });

    it('organizátor v rozsahu soubor / skupina / akce', () => {
      expect(access.canEditEvent(subject([], [testMandate(1, 'events')]), event)).toBeTrue();
      expect(access.canEditEvent(subject([], [testMandate(1, 'events', { groupId: 4 })]), event)).toBeTrue();
      // pozvaná (ne pořádající) skupina akci nespravuje
      expect(access.canEditEvent(subject([], [testMandate(1, 'events', { groupId: 2 })]), event)).toBeFalse();
      expect(access.canEditEvent(subject([], [testMandate(1, 'events', { eventId: 10 })]), event)).toBeTrue();
      expect(access.canCreateEvents(subject([], [testMandate(1, 'events', { eventId: 10 })]))).toBeFalse();
    });

    it('organizátor konkrétní akce smí zapsat její docházku', () => {
      expect(access.canRecordAttendance(subject([], [testMandate(1, 'events', { eventId: 10 })]), event)).toBeTrue();
      expect(access.canRecordAttendance(subject([], [testMandate(1, 'attendance', { groupId: 2 })]), event)).toBeTrue();
      expect(access.canRecordAttendance(subject([], [testMandate(1, 'attendance', { groupId: 7 })]), event)).toBeFalse();
    });

    it('host vidí jen akci, kam je pozván; pozvání nedává přístup jinam', () => {
      const guest = subject([], [], { isExternal: true });
      expect(access.canSeeEvent(guest, { id: 1, targetGroupIds: [], guestMemberIds: [1] })).toBeTrue();
      expect(access.canSeeEvent(guest, { id: 2, targetGroupIds: [] })).toBeFalse();
      expect(access.canReadGroupContent(guest, holky)).toBeFalse();
    });

    it('akce bez cílení je pro celý soubor, ne pro externisty', () => {
      const member = testMember({ groupIds: [] });
      expect(access.isEventAudience(member, { targetGroupIds: [] })).toBeTrue();
      expect(access.isEventAudience({ ...member, isExternal: true }, { targetGroupIds: [] })).toBeFalse();
      expect(access.isEventAudience({ ...member, isActive: false }, { targetGroupIds: [] })).toBeFalse();
    });
  });

  describe('kroje', () => {
    it('krojárka spravuje kroje bez Správy souboru a bez cizích skupin', () => {
      const luckaS = subject([7], [testMandate(1, 'costumes')]);
      expect(access.canManageCostumes(luckaS)).toBeTrue();
      expect(access.isEnsembleAdmin(luckaS)).toBeFalse();
      expect(access.canReadGroupContent(luckaS, holky)).toBeFalse();
    });

    it('Správa souboru nedává správu krojů; náhled ano jen s vlastním pověřením', () => {
      expect(access.canManageCostumes(subject([], [testMandate(1, 'ensemble-admin')]))).toBeFalse();
      expect(access.canViewCostumeStock(subject([], [testMandate(1, 'costumes-view')]))).toBeTrue();
      expect(access.canManageCostumes(subject([], [testMandate(1, 'costumes-view')]))).toBeFalse();
    });
  });

  it('bývalý člen nemá žádné přístupy ani pověření', () => {
    const former = access.toAccessSubject(testMember({ id: 1, groupIds: [5], isActive: false }), [testMandate(1, 'ensemble-admin')]);
    expect(former.groupIds).toEqual([]);
    expect(access.isEnsembleAdmin(former)).toBeFalse();
  });

  it('náhled přístupů odliší čtené skupiny od technicky spravovaných', () => {
    const s = subject([4], [testMandate(1, 'group-owner', { groupId: 5 }), testMandate(1, 'attendance', { groupId: 4 }), testMandate(1, 'costumes-view')]);
    const overview = access.accessOverview(s, [holky, kluci, otevrena]);
    expect(overview.readableGroupIds).toEqual([4, 8]);
    expect(overview.managedWithoutContentGroupIds).toEqual([5]);
    expect(overview.attendance).toBe('scoped');
    expect(overview.events).toBe('none');
    expect(overview.costumes).toBe('view');
  });
});
