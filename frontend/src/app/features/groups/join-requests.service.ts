import { Injectable, signal } from '@angular/core';
import { JoinRequest } from './models/join-request.model';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

let requestsCache = loadDemoData<JoinRequest[]>('join-requests', () => []);

// Úložiště žádostí a pozvánek. Přechody stavů s kontrolou oprávnění řídí MembershipService.
@Injectable({ providedIn: 'root' })
export class JoinRequestsService {
  private readonly _requests = signal<JoinRequest[]>(requestsCache);
  readonly requests = this._requests.asReadonly();

  constructor() {
    this._requests.set(requestsCache);
  }

  private commit(next: JoinRequest[]): void {
    requestsCache = next;
    this._requests.set(next);
    saveDemoData('join-requests', next);
  }

  find(id: number): JoinRequest | undefined {
    return requestsCache.find((r) => r.id === id);
  }

  add(request: Omit<JoinRequest, 'id'>): JoinRequest {
    const created: JoinRequest = { ...request, id: Math.max(0, ...requestsCache.map((r) => r.id)) + 1 };
    this.commit([...requestsCache, created]);
    return created;
  }

  update(id: number, patch: Partial<Omit<JoinRequest, 'id'>>): JoinRequest | undefined {
    this.commit(requestsCache.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    return this.find(id);
  }

  resetCache(): void {
    this.commit([]);
  }
}
