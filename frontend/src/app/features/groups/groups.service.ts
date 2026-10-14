import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Group } from '../../core/models/group.model';
import { MOCK_GROUPS } from '../../core/data/mock-groups';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

let groupsCache = loadDemoData('groups', () => [...MOCK_GROUPS]);
const persist = () => saveDemoData('groups', groupsCache);

@Injectable({ providedIn: 'root' })
export class GroupsService {
  getGroups(): Observable<Group[]> {
    return of([...groupsCache]).pipe(delay(300));
  }

  getGroup(id: number): Observable<Group | undefined> {
    return of(groupsCache.find((g) => g.id === id)).pipe(delay(300));
  }

  createGroup(group: Omit<Group, 'id'>): Observable<Group> {
    const newId = Math.max(...groupsCache.map((g) => g.id), 0) + 1;
    const newGroup: Group = { ...group, id: newId };
    groupsCache.push(newGroup);
    persist();
    return of(newGroup).pipe(delay(300));
  }

  updateGroup(id: number, group: Omit<Group, 'id'>): Observable<Group | undefined> {
    const index = groupsCache.findIndex((g) => g.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    const updated: Group = { ...group, id };
    groupsCache[index] = updated;
    persist();
    return of(updated).pipe(delay(300));
  }

  deleteGroup(id: number): Observable<boolean> {
    const index = groupsCache.findIndex((g) => g.id === id);
    if (index === -1) {
      return of(false).pipe(delay(300));
    }
    groupsCache.splice(index, 1);
    persist();
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    groupsCache = [...MOCK_GROUPS];
  }
}
