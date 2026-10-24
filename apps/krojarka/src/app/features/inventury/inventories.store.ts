import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import type * as Inv from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { PeopleApi } from '../../data/people/people-api';
import { OrganizationApi } from '../../data/organization/organization-api';

/** One fund's inventory workflow; components never select a transport or implement physical movements. */
@Injectable()
export class InventoriesStore {
  private readonly api = inject(InventoryApi);
  private readonly catalog = inject(CatalogApi);
  private readonly peopleApi = inject(PeopleApi);
  private readonly organization = inject(OrganizationApi);
  readonly fund = inject(FundContext).current;
  readonly canManage = computed(() => this.fund()?.canManage ?? false);
  readonly inventories = signal<Inv.CostumeInventory[]>([]);
  readonly detail = signal<Inv.InventoryDetail | null>(null);
  readonly targets = signal<Inv.InventoryTarget[]>([]);
  readonly checks = signal<Inv.InventoryCheck[]>([]);
  readonly slots = signal<Inv.InventorySlot[]>([]);
  readonly visits = signal<Inv.InventoryVisit[]>([]);
  readonly movements = signal<Inv.LoanMovement[]>([]);
  readonly orders = signal<Inv.WorkOrder[]>([]);
  readonly series = signal<Inv.Series[]>([]);
  readonly types = signal<Inv.PartType[]>([]);
  readonly regions = signal<Inv.Region[]>([]);
  readonly groups = signal<Inv.GroupOption[]>([]);
  readonly people = signal<Inv.PersonInFund[]>([]);
  readonly units = signal<Inv.Unit[]>([]);
  readonly items = signal<Inv.CostumeItem[]>([]);
  readonly kits = signal<Inv.CostumeKit[]>([]);
  readonly stocks = signal<Inv.BulkStock[]>([]);
  readonly preview = signal<Inv.InventoryPreview | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastWrittenCheck = signal<number | null>(null);
  private generation = 0;
  private listRequest = 0;
  private detailRequest = 0;
  private previewRequest = 0;
  private selectedId: number | null = null;

  constructor() {
    effect(() => { const fund = this.fund(); untracked(() => {
      this.generation++; this.listRequest++; this.detailRequest++; this.previewRequest++; this.selectedId = null;
      this.inventories.set([]); this.clearDetail(); this.preview.set(null); this.people.set([]); this.units.set([]); this.groups.set([]);
      this.items.set([]); this.kits.set([]); this.stocks.set([]); this.series.set([]); this.types.set([]); this.regions.set([]);
      this.busy.set(false); this.error.set(null); this.loading.set(false);
      if (fund) void this.reload();
    }); });
  }
  async reload(): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.listRequest;
    if (!unit) return;
    this.loading.set(true); this.error.set(null);
    try {
      const [inventories, series, types, regions, groups, people, units, items, retired, kits, stocks] = await Promise.all([
        this.all((offset) => this.api.inventories(unit, { limit: 200, offset })), firstValueFrom(this.catalog.series(unit)), firstValueFrom(this.catalog.partTypes(unit)),
        firstValueFrom(this.catalog.regions(unit)), firstValueFrom(this.organization.groupOptions(unit)),
        this.all((offset) => this.peopleApi.people({ fund: unit, limit: 200, offset })), firstValueFrom(this.organization.units()),
        this.all((offset) => this.api.items(unit, { limit: 200, offset })), this.all((offset) => this.api.items(unit, { limit: 200, offset, retired: true })),
        this.all((offset) => this.api.kits(unit, { limit: 200, offset })), this.all((offset) => this.api.stocks(unit, { limit: 200, offset })),
      ]);
      if (!this.current(unit, generation) || request !== this.listRequest) return;
      this.inventories.set(inventories); this.series.set(series); this.types.set(types); this.regions.set(regions); this.groups.set(groups); this.people.set(people); this.units.set(units);
      this.items.set([...items, ...retired]); this.kits.set(kits); this.stocks.set(stocks);
    } catch (e) { if (this.current(unit, generation) && request === this.listRequest) this.error.set(errorMessage(e)); }
    finally { if (this.current(unit, generation) && request === this.listRequest) this.loading.set(false); }
  }
  async open(id: number): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.detailRequest;
    if (this.selectedId !== id) this.clearDetail(); this.selectedId = id; this.detailLoading.set(true); this.error.set(null);
    if (!unit) { this.detailLoading.set(false); return; }
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const detail = await firstValueFrom(this.api.inventory(id));
        if (!this.current(unit, generation) || request !== this.detailRequest) return;
        if (detail.unitId !== unit) throw new ApiError(404, 'not_found');
        const [targets, checks, slots, visits, movements, orders] = await Promise.all([
          this.collection(id, 'targets'), this.collection(id, 'checks'), this.collection(id, 'slots'), this.collection(id, 'visits'), this.collection(id, 'movements'), this.collection(id, 'workOrders'),
        ]);
        const after = await firstValueFrom(this.api.inventory(id));
        if (!this.current(unit, generation) || request !== this.detailRequest) return;
        if (after.unitId !== unit) throw new ApiError(404, 'not_found');
        if (after.version !== detail.version) { if (attempt === 0) continue; throw new ApiError(409, 'version_conflict'); }
        this.detail.set(after); this.targets.set(targets); this.checks.set(checks); this.slots.set(slots); this.visits.set(visits); this.movements.set(movements); this.orders.set(orders); return;
      }
    } catch (e) { if (this.current(unit, generation) && request === this.detailRequest) { this.clearDetail(); this.error.set(errorMessage(e)); } }
    finally { if (this.current(unit, generation) && request === this.detailRequest) this.detailLoading.set(false); }
  }
  closeDetail(): void { this.selectedId = null; this.detailRequest++; this.clearDetail(); }
  async showPreview(scope: Inv.InventoryScope): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.previewRequest;
    if (!unit || !this.canManage()) throw new ApiError(403, 'forbidden');
    this.preview.set(null);
    const preview = await firstValueFrom(this.api.inventoryPreview(unit, scope));
    if (this.current(unit, generation) && request === this.previewRequest) this.preview.set(preview);
  }
  invalidatePreview(): void { this.previewRequest++; this.preview.set(null); }
  create(input: Inv.InventoryCreate) { return this.write((unit) => this.api.createInventory(unit, input)); }
  async check(input: Omit<Inv.InventoryCheckBatch, 'version'>): Promise<Inv.InventoryCheckResponse> {
    const result = await this.write((_unit, detail) => this.api.checkInventory(this.required(detail).id, { ...input, version: this.required(detail).version }));
    if (this.selectedId === result.id) this.lastWrittenCheck.set(result.results.filter((r) => r.check).at(-1)?.check?.id ?? this.lastWrittenCheck());
    return result;
  }
  async cancel(checkId: number): Promise<void> {
    if (!this.checks().some((c) => c.id === checkId && c.inventoryId === this.detail()?.id)) throw new ApiError(404, 'not_found');
    await this.write((_unit, detail) => this.api.cancelInventoryCheck(checkId, this.required(detail).version));
    if (this.lastWrittenCheck() === checkId) this.lastWrittenCheck.set(null);
  }
  addTarget(input: Omit<Inv.InventoryTargetAdd, 'version'>) { return this.write((_unit, d) => this.api.addInventoryTarget(this.required(d).id, { ...input, version: this.required(d).version } as Inv.InventoryTargetAdd)); }
  createSlot(input: Omit<Inv.InventorySlotInput, 'version'>) { return this.write((_unit, d) => this.api.createInventorySlot(this.required(d).id, { ...input, version: this.required(d).version })); }
  updateSlot(id: number, input: Omit<Inv.InventorySlotPatch, 'version'>) { return this.write((_unit, d) => this.api.updateInventorySlot(this.required(d).id, id, { ...input, version: this.required(d).version })); }
  createVisit(input: Omit<Inv.InventoryVisitInput, 'version'>) { return this.write((_unit, d) => this.api.createInventoryVisit(this.required(d).id, { ...input, version: this.required(d).version })); }
  updateVisit(id: number, input: Omit<Inv.InventoryVisitPatch, 'version'>) { return this.write((_unit, d) => this.api.updateInventoryVisit(this.required(d).id, id, { ...input, version: this.required(d).version })); }
  close(input: Omit<Inv.InventoryClose, 'version'>) { return this.write((_unit, d) => this.api.closeInventory(this.required(d).id, { ...input, version: this.required(d).version })); }
  personName(id: number): string { const p = this.people().find((p) => p.id === id); return p ? `${p.firstName} ${p.lastName}${p.nickname ? ' („' + p.nickname + '“)' : ''}` : `Osoba #${id}`; }
  targetLabel(t: Inv.InventoryTarget): string { return String(t.snapshot['label'] ?? 'Součástka'); }
  holderLabel(t: Inv.InventoryTarget): string { return t.holderPersonId !== null ? this.personName(t.holderPersonId) : t.holderUnitId !== null ? this.units().find((u) => u.id === t.holderUnitId)?.name ?? `Složka #${t.holderUnitId}` : 'bez výpůjčky při zahájení'; }
  private required(detail: Inv.InventoryDetail | null): Inv.InventoryDetail { if (!detail) throw new ApiError(404, 'not_found'); if (detail.status !== 'open') throw new ApiError(409, 'inventory_closed'); return detail; }
  private collection<K extends keyof Inv.InventoryCollections>(id: number, kind: K) { return this.all((offset) => this.api.inventoryCollection(id, kind, { limit: 200, offset })); }
  private current(unit: number, generation: number): boolean { return this.fund()?.unitId === unit && this.generation === generation; }
  private clearDetail(): void { this.detail.set(null); this.targets.set([]); this.checks.set([]); this.slots.set([]); this.visits.set([]); this.movements.set([]); this.orders.set([]); this.lastWrittenCheck.set(null); this.detailLoading.set(false); }
  private async all<T>(read: (offset: number) => Observable<Inv.Page<T>>): Promise<T[]> { const rows: T[] = []; while (true) { const page = await firstValueFrom(read(rows.length)); rows.push(...page.items); if (rows.length >= page.total) return rows; if (!page.items.length) throw new ApiError(500, 'internal_error'); } }
  private async write<T>(work: (unit: number, detail: Inv.InventoryDetail | null) => Observable<T>): Promise<T> {
    const unit = this.fund()?.unitId, generation = this.generation, selected = this.selectedId;
    if (!unit || !this.canManage()) throw new ApiError(403, 'forbidden');
    if (this.busy() || this.detailLoading()) throw new ApiError(422, 'validation_failed', { reason: 'not_allowed' });
    this.busy.set(true);
    try {
      const result = await firstValueFrom(work(unit, this.detail()));
      if (!this.current(unit, generation)) throw new ApiError(404, 'not_found');
      await this.reload(); if (!this.current(unit, generation)) throw new ApiError(404, 'not_found');
      if (selected !== null && this.selectedId === selected) await this.open(selected);
      if (!this.current(unit, generation)) throw new ApiError(404, 'not_found'); return result;
    } finally { if (this.current(unit, generation)) this.busy.set(false); }
  }
}
