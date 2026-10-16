import { Injectable, signal } from '@angular/core';
import { AuditEntry } from './audit.model';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

let auditCache = loadDemoData<AuditEntry[]>('audit', () => []);

// Auditní historie změn členství, pověření, skupin a moderace. Záznamy se jen přidávají.
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly _entries = signal<AuditEntry[]>(auditCache);
  readonly entries = this._entries.asReadonly();

  constructor() {
    this._entries.set(auditCache);
  }

  record(entry: Omit<AuditEntry, 'id' | 'at'> & { at?: string }): AuditEntry {
    const created: AuditEntry = {
      ...entry,
      id: Math.max(0, ...auditCache.map((e) => e.id)) + 1,
      at: entry.at ?? new Date().toISOString(),
    };
    auditCache = [...auditCache, created];
    this._entries.set(auditCache);
    saveDemoData('audit', auditCache);
    return created;
  }

  resetCache(): void {
    auditCache = [];
    this._entries.set(auditCache);
  }
}
