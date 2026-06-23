import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Group } from '../models/group.model';
import { MOCK_GROUPS } from '../data/mock-groups';

@Injectable({ providedIn: 'root' })
export class GroupsService {
  getGroups(): Observable<Group[]> {
    return of([...MOCK_GROUPS]).pipe(delay(300));
  }

  getGroupsByIds(ids: number[]): Observable<Group[]> {
    return of(MOCK_GROUPS.filter((g) => ids.includes(g.id))).pipe(delay(300));
  }
}
