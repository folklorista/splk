import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Member } from '../../core/models/member.model';
import { MOCK_MEMBERS } from './data/mock-members';

@Injectable({ providedIn: 'root' })
export class MembersService {
  getMembers(): Observable<Member[]> {
    return of([...MOCK_MEMBERS]).pipe(delay(300));
  }

  getActiveMembers(): Observable<Member[]> {
    return of(MOCK_MEMBERS.filter((m) => m.isActive)).pipe(delay(300));
  }

  getMember(id: number): Observable<Member | undefined> {
    return of(MOCK_MEMBERS.find((m) => m.id === id)).pipe(delay(300));
  }
}
