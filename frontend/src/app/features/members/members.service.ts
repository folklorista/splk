import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Member } from '../../core/models/member.model';
import { MOCK_MEMBERS } from './data/mock-members';
import { nicknameKey } from '../../core/utils/member.utils';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { DEMO_FUNCTION_TITLES } from '../mandates/data/mock-mandates';

export class NicknameTakenError extends Error {
  constructor(nickname: string) {
    super(`Přezdívku „${nickname}“ už má někdo jiný.`);
  }
}

const seedMembers = (): Member[] =>
  MOCK_MEMBERS.map((m) => (DEMO_FUNCTION_TITLES[m.nickname] ? { ...m, functionTitle: DEMO_FUNCTION_TITLES[m.nickname] } : { ...m }));

let membersCache = loadDemoData('members', seedMembers);

const isNicknameTaken = (nickname: string, exceptId?: number) =>
  membersCache.some((m) => m.id !== exceptId && nicknameKey(m.nickname) === nicknameKey(nickname));

// Osoby se nemažou – odchod ze souboru jen ukončí aktivní členství (historie a zápůjčky zůstávají).
// Členství ve skupinách mění MembershipService (kontroluje oprávnění a zapisuje historii).
@Injectable({ providedIn: 'root' })
export class MembersService {
  // Živý stav pro synchronní vyhodnocení přístupu a obousměrně konzistentní přehledy
  private readonly _members = signal<Member[]>(membersCache);
  readonly members = this._members.asReadonly();

  constructor() {
    this._members.set(membersCache);
  }

  private commit(next: Member[]): void {
    membersCache = next;
    this._members.set(next);
    saveDemoData('members', next);
  }

  getMembers(): Observable<Member[]> {
    return of([...membersCache]).pipe(delay(300));
  }

  getActiveMembers(): Observable<Member[]> {
    return of(membersCache.filter((m) => m.isActive)).pipe(delay(300));
  }

  getMember(id: number): Observable<Member | undefined> {
    return of(membersCache.find((m) => m.id === id)).pipe(delay(300));
  }

  // Člen odpovídající přihlášenému uživateli (podle userId, e-mail si člen může změnit)
  getMemberByUserId(userId: number): Observable<Member | undefined> {
    return of(membersCache.find((m) => m.userId === userId)).pipe(delay(300));
  }

  findMember(id: number): Member | undefined {
    return membersCache.find((m) => m.id === id);
  }

  createMember(member: Omit<Member, 'id' | 'userId'> & { userId?: number }): Observable<Member> {
    try {
      return of(this.insert(member)).pipe(delay(300));
    } catch (error) {
      return throwError(() => error);
    }
  }

  // Synchronní vložení (pro MembershipService); duplicitní přezdívka → NicknameTakenError
  insert(member: Omit<Member, 'id' | 'userId'> & { userId?: number }): Member {
    if (isNicknameTaken(member.nickname)) throw new NicknameTakenError(member.nickname);
    const newId = Math.max(...membersCache.map((m) => m.id), 0) + 1;
    const newMember: Member = { ...member, id: newId, userId: member.userId ?? newId };
    this.commit([...membersCache, newMember]);
    return newMember;
  }

  // Synchronní úprava (pro MembershipService); duplicitní přezdívka → NicknameTakenError
  replace(member: Member): Member {
    if (isNicknameTaken(member.nickname, member.id)) throw new NicknameTakenError(member.nickname);
    this.commit(membersCache.map((m) => (m.id === member.id ? member : m)));
    return member;
  }

  updateMember(id: number, member: Omit<Member, 'id'>): Observable<Member | undefined> {
    const index = membersCache.findIndex((m) => m.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    if (isNicknameTaken(member.nickname, id)) {
      return throwError(() => new NicknameTakenError(member.nickname));
    }
    const updated: Member = { ...member, id };
    const next = [...membersCache];
    next[index] = updated;
    this.commit(next);
    return of(updated).pipe(delay(300));
  }

  // Přímý zápis členství – volá jen MembershipService po kontrole oprávnění
  setGroupMembership(memberId: number, groupId: number, isMember: boolean, at = new Date().toISOString()): Member | undefined {
    const index = membersCache.findIndex((m) => m.id === memberId);
    if (index === -1) return undefined;
    const member = membersCache[index];
    if (member.groupIds.includes(groupId) === isMember) return member;
    const groupJoinedAt = { ...member.groupJoinedAt };
    if (isMember) groupJoinedAt[groupId] = at;
    else delete groupJoinedAt[groupId];
    const updated: Member = {
      ...member,
      groupIds: isMember ? [...member.groupIds, groupId] : member.groupIds.filter((g) => g !== groupId),
      groupJoinedAt,
    };
    const next = [...membersCache];
    next[index] = updated;
    this.commit(next);
    return updated;
  }

  setActive(memberId: number, isActive: boolean): Member | undefined {
    const member = this.findMember(memberId);
    if (!member) return undefined;
    const updated = { ...member, isActive };
    this.commit(membersCache.map((m) => (m.id === memberId ? updated : m)));
    return updated;
  }

  resetCache(): void {
    this.commit(seedMembers());
  }
}
