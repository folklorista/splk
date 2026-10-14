import { User, UserRole } from '../auth/models/user.model';
import { Member } from '../models/member.model';
import { LEADERSHIP_GROUP_ID } from '../data/mock-groups';

// Plné jméno je jen pro administraci; běžní členové vidí přezdívku (Member.nickname)
export function getFullName(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function getMemberRoles(member: Member): UserRole[] {
  const roles: UserRole[] = ['member'];
  if (member.groupIds.includes(LEADERSHIP_GROUP_ID)) roles.push('leader');
  if (member.isAdmin) roles.push('admin');
  return roles;
}

export function memberToUser(member: Member): User {
  return {
    id: member.userId,
    name: member.nickname,
    email: member.email ?? '',
    groupIds: member.groupIds,
    roles: getMemberRoles(member),
  };
}
