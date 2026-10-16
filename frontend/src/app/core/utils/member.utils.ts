import { User } from '../auth/models/user.model';
import { Member } from '../models/member.model';

// Plné jméno je jen pro Správu; běžní členové vidí přezdívku (Member.nickname)
export function getFullName(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function memberToUser(member: Member): User {
  return {
    id: member.userId,
    name: member.nickname,
    email: member.email ?? '',
  };
}

// Přezdívky musí být unikátní (rozlišují členy v aplikaci i ve zmínkách) – porovnání bez diakritiky a velikosti písmen
export function nicknameKey(nickname: string): string {
  return nickname.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
