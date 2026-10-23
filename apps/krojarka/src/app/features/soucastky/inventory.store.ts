import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import {
  BulkStock, BulkStockInput, BulkStockPatch, CompositionInput, CostumeItem, CostumeKit, ItemEvent, ItemInput, ItemPatch,
  KitDetail, KitInput, KitPatch, Page, PartType, Region, Series, WorkOrder, WorkOrderInput, WorkOrderPatch,
} from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { InventoryApi } from '../../data/inventory/inventory-api';

/** One route-scoped fund view. Every async result is checked against the current fund generation. */
@Injectable()
export class InventoryStore {
  private readonly api = inject(InventoryApi);
  private readonly catalog = inject(CatalogApi);
  readonly fund = inject(FundContext).current;
  readonly canManage = computed(() => this.fund()?.canManage ?? false);
  readonly items = signal<CostumeItem[]>([]);
  readonly stocks = signal<BulkStock[]>([]);
  readonly kits = signal<CostumeKit[]>([]);
  readonly series = signal<Series[]>([]);
  readonly partTypes = signal<PartType[]>([]);
  readonly regions = signal<Region[]>([]);
  readonly item = signal<CostumeItem | null>(null);
  readonly kit = signal<KitDetail | null>(null);
  readonly history = signal<ItemEvent[]>([]);
  readonly orders = signal<WorkOrder[]>([]);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private generation = 0;
  private loadRequest = 0;
  private detailRequest = 0;

  constructor() {
    effect(() => {
      const unit = this.fund()?.unitId;
      untracked(() => {
        this.generation++; this.loadRequest++; this.detailRequest++;
        this.items.set([]); this.stocks.set([]); this.kits.set([]); this.series.set([]); this.partTypes.set([]); this.regions.set([]);
        this.clearDetail(); this.error.set(null); this.loading.set(false); this.busy.set(false);
        if (unit) void this.reload();
      });
    });
  }

  async reload(): Promise<void> {
    const unit = this.fund()?.unitId;
    if (!unit) return;
    const generation = this.generation, request = ++this.loadRequest;
    this.loading.set(true); this.error.set(null);
    try {
      const [active, retired, stocks, kits, series, types, regions] = await Promise.all([
        this.all((offset) => this.api.items(unit, { limit: 200, offset })),
        this.all((offset) => this.api.items(unit, { limit: 200, offset, retired: true })),
        this.all((offset) => this.api.stocks(unit, { limit: 200, offset })),
        this.all((offset) => this.api.kits(unit, { limit: 200, offset })),
        firstValueFrom(this.catalog.series(unit)), firstValueFrom(this.catalog.partTypes(unit)), firstValueFrom(this.catalog.regions(unit)),
      ]);
      if (!this.current(unit, generation) || request !== this.loadRequest) return;
      this.items.set([...active, ...retired]); this.stocks.set(stocks); this.kits.set(kits); this.series.set(series); this.partTypes.set(types); this.regions.set(regions);
    } catch (error) {
      if (this.current(unit, generation) && request === this.loadRequest) this.error.set(errorMessage(error));
    } finally {
      if (this.current(unit, generation) && request === this.loadRequest) this.loading.set(false);
    }
  }

  async openItem(id: number): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.detailRequest;
    this.clearDetail(); this.detailLoading.set(true); this.error.set(null);
    if (!unit) { this.detailLoading.set(false); return; }
    try {
      const [item, history, orders] = await Promise.all([
        firstValueFrom(this.api.item(id)), this.all((offset) => this.api.history(id, { limit: 200, offset })),
        this.all((offset) => this.api.workOrders(id, { limit: 200, offset })),
      ]);
      if (!this.current(unit, generation) || request !== this.detailRequest) return;
      if (item.unitId !== unit) throw new ApiError(404, 'not_found');
      this.item.set(item); this.history.set(history); this.orders.set(orders);
    } catch (error) {
      if (this.current(unit, generation) && request === this.detailRequest) this.error.set(errorMessage(error));
    } finally {
      if (this.current(unit, generation) && request === this.detailRequest) this.detailLoading.set(false);
    }
  }

  async openKit(id: number): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.detailRequest;
    this.clearDetail(); this.detailLoading.set(true); this.error.set(null);
    if (!unit) { this.detailLoading.set(false); return; }
    try {
      const kit = await firstValueFrom(this.api.kit(id));
      if (!this.current(unit, generation) || request !== this.detailRequest) return;
      if (kit.unitId !== unit) throw new ApiError(404, 'not_found');
      this.kit.set(kit);
    } catch (error) {
      if (this.current(unit, generation) && request === this.detailRequest) this.error.set(errorMessage(error));
    } finally {
      if (this.current(unit, generation) && request === this.detailRequest) this.detailLoading.set(false);
    }
  }

  createItem(input: ItemInput) { return this.write((unit) => this.api.createItem(unit, input)); }
  updateItem(id: number, input: ItemPatch) { return this.write(() => this.api.updateItem(id, input)); }
  retireItem(id: number, version: number, reason: string) { return this.write(() => this.api.retireItem(id, { version, reason })); }
  createStock(input: BulkStockInput) { return this.write((unit) => this.api.createStock(unit, input)); }
  updateStock(id: number, input: BulkStockPatch) { return this.write(() => this.api.updateStock(id, input)); }
  createKit(input: KitInput) { return this.write((unit) => this.api.createKit(unit, input)); }
  updateKit(id: number, input: KitPatch) { return this.write(() => this.api.updateKit(id, input)); }
  composition(id: number, input: CompositionInput) { return this.write(() => this.api.composition(id, input)); }
  createOrder(id: number, input: WorkOrderInput) { return this.write(() => this.api.createWorkOrder(id, input)); }
  updateOrder(id: number, input: WorkOrderPatch) { return this.write(() => this.api.updateWorkOrder(id, input)); }

  seriesName(id: number): string {
    const series = this.series().find((s) => s.id === id);
    return series ? [series.name, series.variant].filter(Boolean).join(' · ') : `Řada ${id}`;
  }
  itemName(item: CostumeItem): string { return `${this.seriesName(item.seriesId)} · ${item.number ?? 'zatím bez čísla'}`; }
  kitName(kit: CostumeKit): string { return `${this.seriesName(kit.seriesId)} · ${kit.number ?? 'zatím bez čísla'}`; }
  stockName(stock: BulkStock): string { return [this.partTypes().find((t) => t.id === stock.partTypeId)?.name ?? `Druh ${stock.partTypeId}`, stock.variant].filter(Boolean).join(' · '); }

  closeDetail(): void { this.detailRequest++; this.clearDetail(); }
  private clearDetail(): void { this.item.set(null); this.kit.set(null); this.history.set([]); this.orders.set([]); this.detailLoading.set(false); }
  private current(unit: number, generation: number): boolean { return this.fund()?.unitId === unit && this.generation === generation; }
  private async all<T>(request: (offset: number) => Observable<Page<T>>): Promise<T[]> {
    const rows: T[] = [];
    while (true) {
      const page = await firstValueFrom(request(rows.length));
      rows.push(...page.items);
      if (rows.length >= page.total) return rows;
      if (!page.items.length) throw new ApiError(0, 'internal_error');
    }
  }
  private async write<T>(request: (unit: number) => Observable<T>): Promise<T> {
    const fund = this.fund(), generation = this.generation;
    if (!fund?.canManage) throw new ApiError(403, 'forbidden');
    if (this.busy()) throw new ApiError(422, 'validation_failed', { reason: 'not_allowed' });
    this.busy.set(true);
    try {
      const value = await firstValueFrom(request(fund.unitId));
      if (!this.current(fund.unitId, generation)) throw new ApiError(404, 'not_found');
      await this.reload();
      if (!this.current(fund.unitId, generation)) throw new ApiError(404, 'not_found');
      return value;
    } finally {
      if (this.current(fund.unitId, generation)) this.busy.set(false);
    }
  }
}
