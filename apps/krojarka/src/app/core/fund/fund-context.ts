import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Unit } from '@splk/api-contracts';
import { OrganizationApi } from '../../data/organization/organization-api';
import { AuthService } from '../auth/auth.service';

export interface Fund {
  unitId: number;
  name: string;
  /** costumes.manage – write access; otherwise read-only (costumes.view, D-36) */
  canManage: boolean;
}

const STORAGE_KEY = 'krojarka.fund';

/**
 * Costume funds the signed-in person may work with, derived from mandates (D-21), and the one currently selected.
 * Anuška with mandates for Vonička II and III switches between them; most people have exactly one fund.
 * The API still checks every request – this only shapes the UI.
 */
@Injectable({ providedIn: 'root' })
export class FundContext {
  private readonly auth = inject(AuthService);
  private readonly organization = inject(OrganizationApi);
  private readonly allUnits = signal<Unit[]>([]);
  private loadedFor: object | null = null;
  private loadingFor: object | null = null;
  private unitLoad: Promise<void> | null = null;
  private readonly selectedId = signal<number | null>(readStoredFund());

  readonly funds = computed<Fund[]>(() => {
    const mandates = this.auth.user()?.mandates ?? [];
    const funds = new Map<number, Fund>();
    const add = (unitId: number, name: string, canManage: boolean) => {
      const existing = funds.get(unitId);
      funds.set(unitId, { unitId, name, canManage: canManage || (existing?.canManage ?? false) });
    };
    for (const mandate of mandates) {
      if (mandate.scopeType === 'unit' && mandate.scopeId !== null && mandate.kind.startsWith('costumes.')) {
        add(mandate.scopeId, mandate.scopeName ?? `Složka ${mandate.scopeId}`, mandate.kind === 'costumes.manage');
      }
    }
    if (mandates.some((m) => m.kind === 'costumes.view' && m.scopeType === 'organization')) {
      for (const unit of this.allUnits().filter((u) => u.hasCostumeFund && !u.archived)) {
        add(unit.id, unit.name, false);
      }
    }
    return [...funds.values()].sort((a, b) => a.unitId - b.unitId);
  });

  readonly current = computed<Fund | null>(() => {
    const funds = this.funds();
    return funds.find((f) => f.unitId === this.selectedId()) ?? funds[0] ?? null;
  });

  constructor() {
    effect(() => { this.auth.user(); void this.init(); });
  }

  /** Guards await the unit list for organization-wide viewers, including direct deep links. */
  init(): Promise<void> {
    const user = this.auth.user();
    if (!user?.mandates.some((m) => m.kind === 'costumes.view' && m.scopeType === 'organization')) {
      this.loadingFor = null; this.loadedFor = null; this.unitLoad = null; this.allUnits.set([]);
      return Promise.resolve();
    }
    if (this.loadedFor === user) return Promise.resolve();
    if (this.loadingFor === user && this.unitLoad) return this.unitLoad;
    this.loadingFor = user; this.allUnits.set([]);
    this.unitLoad = firstValueFrom(this.organization.units()).then((units) => {
      if (this.auth.user() === user) { this.allUnits.set(units); this.loadedFor = user; }
    }).catch(() => {
      if (this.auth.user() === user) this.allUnits.set([]);
    }).finally(() => { if (this.loadingFor === user) { this.loadingFor = null; this.unitLoad = null; } });
    return this.unitLoad;
  }

  select(unitId: number): void {
    this.selectedId.set(unitId);
    try {
      localStorage.setItem(STORAGE_KEY, String(unitId));
    } catch {
      // the choice is only a convenience
    }
  }
}

function readStoredFund(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
