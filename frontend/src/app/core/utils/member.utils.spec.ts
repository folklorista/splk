import { Member } from '../models/member.model';
import { getFullName, memberToUser, nicknameKey } from './member.utils';

describe('member.utils', () => {
  const member: Member = {
    id: 7,
    ensembleId: 1,
    userId: 17,
    firstName: 'Michal',
    lastName: 'Novák',
    nickname: 'Mrož',
    groupIds: [2],
    isActive: true,
    createdAt: '2020-01-01',
  };

  it('getFullName spojí jméno a příjmení', () => {
    expect(getFullName(member)).toBe('Michal Novák');
  });

  it('memberToUser použije userId a přezdívku, chybějící e-mail je prázdný', () => {
    const user = memberToUser(member);
    expect(user.id).toBe(17);
    expect(user.name).toBe('Mrož');
    expect(user.email).toBe('');
    // Členství ani pověření se do přihlášení nekopírují – čtou se živě (AccessService)
    expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name']);
  });

  it('nicknameKey ignoruje diakritiku, velikost písmen a mezery okolo', () => {
    expect(nicknameKey(' Aňyčka ')).toBe(nicknameKey('anycka'));
    expect(nicknameKey('Kuba D')).not.toBe(nicknameKey('Kuba'));
  });
});
