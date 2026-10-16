import { Injectable, signal } from '@angular/core';
import { Mandate } from '../../core/models/mandate.model';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { seedMandates } from './data/mock-mandates';

let mandatesCache = loadDemoData('mandates', () => seedMandates());

// Úložiště pověření. Přidělování a odebírání s kontrolou oprávnění a ochranou posledního správce
// dělá MembershipService.
@Injectable({ providedIn: 'root' })
export class MandatesService {
  private readonly _mandates = signal<Mandate[]>(mandatesCache);
  readonly mandates = this._mandates.asReadonly();

  constructor() {
    this._mandates.set(mandatesCache);
  }

  private commit(next: Mandate[]): void {
    mandatesCache = next;
    this._mandates.set(next);
    saveDemoData('mandates', next);
  }

  add(mandate: Omit<Mandate, 'id'>): Mandate {
    const created: Mandate = { ...mandate, id: Math.max(0, ...mandatesCache.map((m) => m.id)) + 1 };
    this.commit([...mandatesCache, created]);
    return created;
  }

  remove(id: number): void {
    this.commit(mandatesCache.filter((m) => m.id !== id));
  }

  update(id: number, patch: Partial<Omit<Mandate, 'id'>>): void {
    this.commit(mandatesCache.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  resetCache(): void {
    this.commit(seedMandates());
  }
}
