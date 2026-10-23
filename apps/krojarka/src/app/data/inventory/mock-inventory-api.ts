import { inject, Injectable } from '@angular/core';
import { defer, firstValueFrom, from, Observable } from 'rxjs';
import {
  BulkStock, BulkStockInput, BulkStockPatch, CompositionInput, CostumeItem, CostumeKit, ItemEvent,
  ItemInput, ItemPatch, ItemQuery, ItemRetireInput, KitDetail, KitInput, KitPatch, Page, PageQuery, Series,
  WorkOrder, WorkOrderInput, WorkOrderPatch, WorkOrderStatus,
} from '@splk/api-contracts';
import { ApiError } from '../api-error';
import { CatalogApi } from '../catalog/catalog-api';
import { InventoryApi } from './inventory-api';

interface State {
  items: CostumeItem[];
  stocks: BulkStock[];
  kits: KitDetail[];
  events: ItemEvent[];
  orders: WorkOrder[];
}

/** Session-only synthetic inventory. Serialized operations roll back together, like server transactions. */
@Injectable()
export class MockInventoryApi extends InventoryApi {
  private readonly catalog = inject(CatalogApi);
  private state: State = { items: [], stocks: [], kits: [], events: [], orders: [] };
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();

  items(unit: number, query: ItemQuery = {}) {
    return this.run(async () => {
      const series = await firstValueFrom(this.catalog.series(unit));
      let rows = this.state.items.filter((i) => i.unitId === unit && !!i.retiredAt === (query.retired ?? false));
      rows = rows.filter((i) => (!query.series || i.seriesId === query.series) && (!query.condition || i.condition === query.condition)
        && (!query.location || i.location === query.location) && (!query.acquiredFrom || (i.acquiredOn !== null && i.acquiredOn >= query.acquiredFrom))
        && (!query.acquiredTo || (i.acquiredOn !== null && i.acquiredOn <= query.acquiredTo))
        && (!query.q || normalize([series.find((s) => s.id === i.seriesId)?.name, i.number, i.variant, i.description, i.note].join(' ')).includes(normalize(query.q))));
      const sort = query.sort ?? 'series';
      const key = sort.replace('-', '');
      const value = (i: CostumeItem) => key === 'series' ? `${series.find((s) => s.id === i.seriesId)?.name ?? ''} ${i.number ?? '~'}`
        : key === 'id' ? i.id : key === 'acquiredOn' ? i.acquiredOn : i.number;
      rows.sort((a, b) => {
        const x = value(a), y = value(b);
        if (x === null || y === null) return x === y ? a.id - b.id : x === null ? 1 : -1;
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'cs');
        return cmp * (sort.startsWith('-') ? -1 : 1) || a.id - b.id;
      });
      return page(rows, query);
    });
  }

  item(id: number) { return this.run(() => this.find(this.state.items, id)); }

  createItem(unit: number, input: ItemInput) {
    return this.run(async () => {
      await this.validateSeries(unit, input.seriesId, 'part', input.number, null);
      const item: CostumeItem = { id: this.nextId++, unitId: unit, seriesId: input.seriesId, number: text(input.number), variant: text(input.variant),
        size: text(input.size), description: text(input.description), note: text(input.note), condition: input.condition ?? 'ok',
        issuable: input.issuable ?? true, location: input.location ?? 'unknown', locationNote: text(input.locationNote), acquiredOn: text(input.acquiredOn),
        kitId: null, retiredAt: null, retiredBy: null, retireReason: null, version: 1 };
      this.state.items.push(item);
      this.event(item.id, 'created', { ...item });
      return item;
    });
  }

  updateItem(id: number, input: ItemPatch) {
    return this.run(async () => {
      const item = this.find(this.state.items, id);
      this.version(item, input.version);
      if (item.retiredAt) throw new ApiError(422, 'item_retired');
      const { version: _, ...patch } = input;
      const next = { ...item, ...patch };
      if (next.seriesId !== item.seriesId || next.number !== item.number) await this.validateSeries(item.unitId, next.seriesId, 'part', next.number, id);
      for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
        if (item[key] !== next[key]) {
          const events: Record<string, string> = { condition: 'condition_changed', location: 'location_changed', locationNote: 'location_changed', issuable: 'issuable_changed', number: 'number_assigned' };
          this.event(id, events[key] ?? 'details_changed', { field: key, from: item[key], to: next[key] });
        }
      }
      Object.assign(item, patch, { version: item.version + 1 });
      return item;
    });
  }

  retireItem(id: number, input: ItemRetireInput) {
    return this.run(() => {
      const item = this.find(this.state.items, id);
      this.version(item, input.version);
      if (item.retiredAt) throw new ApiError(422, 'item_retired');
      if (!input.reason.trim()) throw invalid('reason');
      Object.assign(item, { retiredAt: new Date().toISOString(), retiredBy: 1, retireReason: input.reason.trim(), version: item.version + 1 });
      this.event(id, 'retired', { reason: input.reason.trim() });
      return item;
    });
  }

  history(id: number, query: PageQuery = {}) {
    return this.run(() => { this.find(this.state.items, id); return page(this.state.events.filter((e) => e.itemId === id).reverse(), query); });
  }

  stocks(unit: number, query: PageQuery = {}) {
    return this.run(() => page(this.state.stocks.filter((s) => s.unitId === unit).map((s) => this.stock(s)), query));
  }

  createStock(unit: number, input: BulkStockInput) {
    return this.run(async () => {
      const type = (await firstValueFrom(this.catalog.partTypes(unit))).find((t) => t.id === input.partTypeId);
      if (!type || type.numbered || type.archived) throw invalid('partTypeId');
      quantity(input.quantityTotal);
      this.uniqueStock(unit, input.partTypeId, text(input.variant));
      const stock: BulkStock = { id: this.nextId++, unitId: unit, partTypeId: input.partTypeId, variant: text(input.variant),
        quantityTotal: input.quantityTotal, quantityInKits: 0, note: text(input.note) };
      this.state.stocks.push(stock);
      return stock;
    });
  }

  updateStock(id: number, input: BulkStockPatch) {
    return this.run(() => {
      const stock = this.find(this.state.stocks, id);
      const next = { ...stock, ...input };
      quantity(next.quantityTotal);
      if (next.quantityTotal < this.stock(stock).quantityInKits) throw new ApiError(422, 'insufficient_stock');
      this.uniqueStock(stock.unitId, stock.partTypeId, text(next.variant), id);
      Object.assign(stock, input, { variant: text(next.variant), note: text(next.note) });
      return this.stock(stock);
    });
  }

  kits(unit: number, query: PageQuery & { series?: number; q?: string } = {}) {
    return this.run(async () => {
      const series = await firstValueFrom(this.catalog.series(unit));
      return page(this.state.kits.filter((k) => k.unitId === unit && !k.retiredAt && (!query.series || k.seriesId === query.series)
        && (!query.q || normalize([series.find((s) => s.id === k.seriesId)?.name, k.number, k.description, k.note].join(' ')).includes(normalize(query.q))))
        .map(({ items: _, bulkLines: __, changes: ___, ...kit }) => kit), query);
    });
  }

  kit(id: number) { return this.run(() => this.detail(this.find(this.state.kits, id))); }

  createKit(unit: number, input: KitInput) {
    return this.run(async () => {
      await this.validateSeries(unit, input.seriesId, 'kit', input.number, null);
      const kit: KitDetail = { id: this.nextId++, unitId: unit, seriesId: input.seriesId, number: text(input.number), description: text(input.description),
        note: text(input.note), compositionState: input.compositionState ?? 'unverified', retiredAt: null, version: 1, items: [], bulkLines: [], changes: [] };
      this.state.kits.push(kit);
      return this.detail(kit);
    });
  }

  updateKit(id: number, input: KitPatch) {
    return this.run(async () => {
      const kit = this.find(this.state.kits, id);
      this.version(kit, input.version);
      const { version: _, ...patch } = input;
      const next = { ...kit, ...patch };
      if (next.seriesId !== kit.seriesId || next.number !== kit.number) await this.validateSeries(kit.unitId, next.seriesId, 'kit', next.number, id);
      Object.assign(kit, patch, { version: kit.version + 1 });
      return this.detail(kit);
    });
  }

  composition(id: number, input: CompositionInput) {
    return this.run(() => {
      const kit = this.find(this.state.kits, id);
      this.version(kit, input.version);
      const target = input.action === 'move' ? this.find(this.state.kits, input.targetKitId) : null;
      if (target) {
        if (target.unitId !== kit.unitId) throw new ApiError(404, 'not_found');
        if (target.id === kit.id) throw invalid('targetKitId');
        this.version(target, input.action === 'move' ? input.targetVersion : 0);
      }
      let qty = 1;
      if ('itemId' in input) {
        const item = this.find(this.state.items, input.itemId);
        if (item.unitId !== kit.unitId) throw new ApiError(404, 'not_found');
        this.version(item, input.itemVersion);
        if (item.retiredAt && input.action !== 'remove') throw new ApiError(422, 'item_retired');
        if (input.action === 'add' ? item.kitId !== null : item.kitId !== kit.id) throw new ApiError(422, 'composition_conflict');
        const nextKit = input.action === 'add' ? kit.id : target?.id ?? null;
        this.event(item.id, 'kit_changed', { from: item.kitId, to: nextKit });
        item.kitId = nextKit;
        item.version++;
      } else {
        const stock = this.find(this.state.stocks, input.bulkStockId);
        if (stock.unitId !== kit.unitId) throw new ApiError(404, 'not_found');
        const line = kit.bulkLines.find((l) => l.bulkStockId === stock.id);
        if (input.action !== 'add' && !line) throw new ApiError(422, 'composition_conflict');
        if (input.action === 'remove') {
          if ((input.requiredQty === undefined) !== (input.presentQty === undefined)) throw invalid('requiredQty');
          const required = input.requiredQty ?? line!.requiredQty, present = input.presentQty ?? line!.presentQty;
          quantity(required, 1); quantity(present);
          if (present > required || required > line!.requiredQty || present > line!.presentQty || line!.presentQty - present > line!.requiredQty - required) throw invalid('requiredQty');
          qty = required;
          line!.requiredQty -= required; line!.presentQty -= present;
          kit.bulkLines = kit.bulkLines.filter((l) => l.requiredQty > 0);
        } else {
          quantity(input.requiredQty, 1); quantity(input.presentQty);
          if (input.presentQty > input.requiredQty) throw invalid('presentQty');
          qty = input.requiredQty;
          if (input.action === 'add') {
            if (this.stock(stock).quantityInKits + input.presentQty > stock.quantityTotal) throw new ApiError(422, 'insufficient_stock');
            this.addLine(kit, stock.id, input.requiredQty, input.presentQty);
          } else {
            if (input.requiredQty > line!.requiredQty || input.presentQty > line!.presentQty || line!.presentQty - input.presentQty > line!.requiredQty - input.requiredQty) throw invalid('requiredQty');
            line!.requiredQty -= input.requiredQty; line!.presentQty -= input.presentQty;
            kit.bulkLines = kit.bulkLines.filter((l) => l.requiredQty > 0);
            this.addLine(target!, stock.id, input.requiredQty, input.presentQty);
          }
        }
      }
      for (const changed of target ? [kit, target] : [kit]) {
        changed.version++;
        if (changed.compositionState !== 'unverified') changed.compositionState = 'pending_check';
        changed.changes.unshift({ id: this.nextId++, kitId: changed.id, itemId: 'itemId' in input ? input.itemId : null,
          bulkStockId: 'bulkStockId' in input ? input.bulkStockId : null, change: input.action === 'add' ? 'added' : input.action === 'remove' ? 'removed' : 'moved',
          qty, at: new Date().toISOString(), by: 1, note: text(input.note) });
      }
      return this.detail(kit);
    });
  }

  workOrders(id: number, query: PageQuery & { status?: WorkOrderStatus } = {}) {
    return this.run(() => { this.find(this.state.items, id); return page(this.state.orders.filter((w) => w.itemId === id && (!query.status || w.status === query.status)).slice().reverse(), query); });
  }

  createWorkOrder(id: number, input: WorkOrderInput) {
    return this.run(() => {
      const item = this.find(this.state.items, id);
      if (item.retiredAt) throw new ApiError(422, 'item_retired');
      if (!input.description.trim()) throw invalid('description');
      const order: WorkOrder = { id: this.nextId++, itemId: id, unitId: item.unitId, type: input.type, description: input.description.trim(),
        assignee: text(input.assignee), dueOn: text(input.dueOn), status: 'open' };
      this.state.orders.push(order);
      this.event(id, 'work_order_created', { ...order });
      return order;
    });
  }

  updateWorkOrder(id: number, input: WorkOrderPatch) {
    return this.run(() => {
      const order = this.find(this.state.orders, id);
      const before = { ...order };
      Object.assign(order, input);
      this.event(order.itemId, 'work_order_changed', { from: before, to: { ...order } });
      return order;
    });
  }

  private async validateSeries(unit: number, id: number, kind: Series['kind'], number: string | null, except: number | null) {
    const series = (await firstValueFrom(this.catalog.series(unit))).find((s) => s.id === id);
    if (!series || series.archived || series.kind !== kind) throw invalid('seriesId');
    const regionIds = [series.regionId];
    if (kind === 'part') {
      const type = (await firstValueFrom(this.catalog.partTypes(unit))).find((t) => t.id === series.partTypeId);
      if (!type || !type.numbered || type.archived) throw invalid('seriesId');
      regionIds.push(type.regionId);
    }
    const regions = await firstValueFrom(this.catalog.regions(unit));
    for (let regionId of regionIds) {
      while (regionId !== null) {
        const region = regions.find((r) => r.id === regionId);
        if (!region || region.archived) throw invalid('seriesId');
        regionId = region.parentId;
      }
    }
    const rows = kind === 'part' ? this.state.items : this.state.kits;
    if (text(number) !== null && rows.some((r) => r.id !== except && r.seriesId === id && r.number === text(number) && (!r.retiredAt || !series.allowNumberReuse))) {
      throw new ApiError(422, 'number_already_used');
    }
  }

  private stock(stock: BulkStock): BulkStock {
    return { ...stock, quantityInKits: this.state.kits.flatMap((k) => k.bulkLines).filter((l) => l.bulkStockId === stock.id).reduce((sum, l) => sum + l.presentQty, 0) };
  }

  private uniqueStock(unit: number, type: number, variant: string | null, except?: number) {
    if (this.state.stocks.some((s) => s.id !== except && s.unitId === unit && s.partTypeId === type && (s.variant ?? '').toLowerCase() === (variant ?? '').toLowerCase())) throw new ApiError(422, 'duplicate_stock');
  }

  private addLine(kit: KitDetail, stock: number, required: number, present: number) {
    let line = kit.bulkLines.find((l) => l.bulkStockId === stock);
    const nextRequired = (line?.requiredQty ?? 0) + required, nextPresent = (line?.presentQty ?? 0) + present;
    quantity(nextRequired, 1); quantity(nextPresent);
    if (!line) { line = { id: this.nextId++, bulkStockId: stock, requiredQty: 0, presentQty: 0 }; kit.bulkLines.push(line); }
    line.requiredQty = nextRequired; line.presentQty = nextPresent;
  }

  private detail(kit: KitDetail): KitDetail { return { ...kit, items: this.state.items.filter((i) => i.kitId === kit.id) }; }
  private find<T extends { id: number }>(rows: T[], id: number): T { const row = rows.find((r) => r.id === id); if (!row) throw new ApiError(404, 'not_found'); return row; }
  private version(row: { version: number }, version: number) { if (row.version !== version) throw new ApiError(409, 'version_conflict', { version: row.version }); }
  private event(id: number, event: string, data: Record<string, unknown>) { this.state.events.push({ id: this.nextId++, itemId: id, at: new Date().toISOString(), by: 1, event, data }); }

  private run<T>(work: () => T | Promise<T>): Observable<T> {
    return defer(() => {
      const task = this.queue.then(async () => {
        const before = structuredClone(this.state);
        try { return structuredClone(await work()); } catch (error) { this.state = before; throw error; }
      });
      this.queue = task.catch(() => undefined);
      return from(task);
    });
  }
}

function page<T>(rows: T[], query: PageQuery): Page<T> { const offset = query.offset ?? 0; return { total: rows.length, items: rows.slice(offset, offset + (query.limit ?? 50)) }; }
function text(value?: string | null): string | null { return value?.trim() || null; }
function normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function invalid(field: string) { return new ApiError(422, 'validation_failed', { field, reason: 'invalid' }); }
function quantity(value: number, minimum = 0) { if (!Number.isInteger(value) || value < minimum || value > 2147483647) throw invalid('quantity'); }
