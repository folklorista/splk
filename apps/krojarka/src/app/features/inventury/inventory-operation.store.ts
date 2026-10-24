import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CostumeInventory, InventoryOperationContext } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { ApiError } from '../../data/api-error';
import { errorMessage } from '../../core/auth/error-messages';

/** A route-scoped bridge into ordinary movement/work forms; an invalid context never silently disappears. */
@Injectable()
export class InventoryOperationStore {
  private readonly api = inject(InventoryApi);
  private readonly fund = inject(FundContext).current;
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);
  readonly inventory = signal<CostumeInventory | null>(null);
  readonly requested = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly blocked = computed(() => {
    const raw = this.params()?.get('inventoryId') ?? null;
    return (raw !== null) !== this.requested() || this.requested() && (this.loading() || !this.inventory() || this.inventory()?.unitId !== this.fund()?.unitId || String(this.inventory()?.id) !== raw || this.inventory()?.status !== 'open' || this.error() !== null);
  });
  private request = 0;
  private problem: ApiError | null = null;
  constructor() { effect(() => { this.fund(); this.params(); untracked(() => { void this.reload(); }); }); }
  async reload(): Promise<void> {
    const request = ++this.request, unit = this.fund()?.unitId, raw = this.params()?.get('inventoryId') ?? null;
    this.inventory.set(null); this.error.set(null); this.problem = null; this.requested.set(raw !== null); this.loading.set(false);
    if (raw === null) return;
    this.loading.set(true);
    try {
      const id = Number(raw);
      if (!unit || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id)) throw new ApiError(404, 'not_found');
      const inventory = await firstValueFrom(this.api.inventory(id));
      if (request !== this.request || this.fund()?.unitId !== unit) return;
      if (inventory.unitId !== unit) throw new ApiError(404, 'not_found');
      this.inventory.set(inventory);
      if (inventory.status !== 'open') throw new ApiError(409, 'inventory_closed');
    } catch (e) { if (request === this.request && this.fund()?.unitId === unit) { this.problem = ApiError.from(e); this.error.set(errorMessage(e)); } }
    finally { if (request === this.request) this.loading.set(false); }
  }
  values(): Partial<InventoryOperationContext> {
    if (this.blocked() && !this.problem) throw new ApiError(422, 'validation_failed', { reason: 'not_allowed' });
    if (!this.requested()) return {};
    if (this.problem) throw this.problem;
    const inventory = this.inventory();
    if (this.blocked() || !inventory || inventory.unitId !== this.fund()?.unitId) throw new ApiError(422, 'validation_failed', { reason: 'not_allowed' });
    return { inventoryId: inventory.id, inventoryVersion: inventory.version };
  }
  committed(context: Partial<InventoryOperationContext>): void {
    const current = this.inventory();
    if (current && current.unitId === this.fund()?.unitId && String(current.id) === this.params()?.get('inventoryId') && current.id === context.inventoryId && current.version === context.inventoryVersion) this.inventory.set({ ...current, version: current.version + 1 });
  }
}
