import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Group } from '../../core/models/group.model';
import { MOCK_GROUPS } from '../../core/data/mock-groups';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

let groupsCache = loadDemoData('groups', () => MOCK_GROUPS.map((g) => ({ ...g })));

// Úložiště skupin. Změny s kontrolou oprávnění a historií jdou přes MembershipService.
@Injectable({ providedIn: 'root' })
export class GroupsService {
  private readonly _groups = signal<Group[]>(groupsCache);
  readonly groups = this._groups.asReadonly();

  constructor() {
    this._groups.set(groupsCache);
  }

  private commit(next: Group[]): void {
    groupsCache = next;
    this._groups.set(next);
    saveDemoData('groups', next);
  }

  getGroups(): Observable<Group[]> {
    return of([...groupsCache]).pipe(delay(300));
  }

  getGroup(id: number): Observable<Group | undefined> {
    return of(groupsCache.find((g) => g.id === id)).pipe(delay(300));
  }

  getGroupsByIds(ids: number[]): Observable<Group[]> {
    return of(groupsCache.filter((g) => ids.includes(g.id))).pipe(delay(300));
  }

  findGroup(id: number): Group | undefined {
    return groupsCache.find((g) => g.id === id);
  }

  createGroup(group: Omit<Group, 'id'>): Observable<Group> {
    return of(this.insert(group)).pipe(delay(300));
  }

  insert(group: Omit<Group, 'id'>): Group {
    const newGroup: Group = { ...group, id: Math.max(...groupsCache.map((g) => g.id), 0) + 1 };
    this.commit([...groupsCache, newGroup]);
    return newGroup;
  }

  replace(group: Group): void {
    this.commit(groupsCache.map((g) => (g.id === group.id ? group : g)));
  }

  remove(id: number): void {
    this.commit(groupsCache.filter((g) => g.id !== id));
  }

  updateGroup(id: number, group: Omit<Group, 'id'>): Observable<Group | undefined> {
    const index = groupsCache.findIndex((g) => g.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    const updated: Group = { ...group, id };
    const next = [...groupsCache];
    next[index] = updated;
    this.commit(next);
    return of(updated).pipe(delay(300));
  }

  deleteGroup(id: number): Observable<boolean> {
    if (!groupsCache.some((g) => g.id === id)) {
      return of(false).pipe(delay(300));
    }
    this.commit(groupsCache.filter((g) => g.id !== id));
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    this.commit(MOCK_GROUPS.map((g) => ({ ...g })));
  }
}
