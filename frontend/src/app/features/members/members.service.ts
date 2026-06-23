import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Member } from '../../core/models/member.model';
import { MOCK_MEMBERS } from './data/mock-members';

let membersCache = [...MOCK_MEMBERS];

@Injectable({ providedIn: 'root' })
export class MembersService {
  getMembers(): Observable<Member[]> {
    return of([...membersCache]).pipe(delay(300));
  }

  getActiveMembers(): Observable<Member[]> {
    return of(membersCache.filter((m) => m.isActive)).pipe(delay(300));
  }

  getMember(id: number): Observable<Member | undefined> {
    return of(membersCache.find((m) => m.id === id)).pipe(delay(300));
  }

  createMember(member: Omit<Member, 'id'>): Observable<Member> {
    const newId = Math.max(...membersCache.map((m) => m.id), 0) + 1;
    const newMember: Member = { ...member, id: newId };
    membersCache.push(newMember);
    return of(newMember).pipe(delay(300));
  }

  updateMember(id: number, member: Omit<Member, 'id'>): Observable<Member | undefined> {
    const index = membersCache.findIndex((m) => m.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    const updated: Member = { ...member, id };
    membersCache[index] = updated;
    return of(updated).pipe(delay(300));
  }

  deleteMember(id: number): Observable<boolean> {
    const index = membersCache.findIndex((m) => m.id === id);
    if (index === -1) {
      return of(false).pipe(delay(300));
    }
    membersCache.splice(index, 1);
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    membersCache = [...MOCK_MEMBERS];
  }
}
