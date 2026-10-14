import { Member } from '../models/member.model';
import { getFullName, getMemberRoles, memberToUser } from './member.utils';
import { LEADERSHIP_GROUP_ID } from '../data/mock-groups';

describe('member.utils', () => {
  const member: Member = {
    id: 7,
    ensembleId: 1,
    userId: 17,
    firstName: 'Michal',
    lastName: 'Novák',
    nickname: 'Mrož',
    groupIds: [2],
    isAdmin: false,
    isActive: true,
    createdAt: '2020-01-01',
  };

  it('getFullName spojí jméno a příjmení', () => {
    expect(getFullName(member)).toBe('Michal Novák');
  });

  it('běžný člen má jen roli member', () => {
    expect(getMemberRoles(member)).toEqual(['member']);
  });

  it('člen výboru je leader, administrátor má roli admin', () => {
    expect(getMemberRoles({ ...member, groupIds: [LEADERSHIP_GROUP_ID] })).toEqual(['member', 'leader']);
    expect(getMemberRoles({ ...member, isAdmin: true })).toEqual(['member', 'admin']);
  });

  it('memberToUser použije userId a přezdívku, chybějící e-mail je prázdný', () => {
    const user = memberToUser(member);
    expect(user.id).toBe(17);
    expect(user.name).toBe('Mrož');
    expect(user.email).toBe('');
    expect(user.groupIds).toEqual([2]);
  });
});
