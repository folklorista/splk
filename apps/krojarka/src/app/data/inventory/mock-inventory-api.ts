import type { CostumeLoan, LoanCreate, LoanIssueResult, LoanReturnInput, LoanExchangeInput, LoanPatch, LoanQuery, LoanMovement, MovementQuery } from '@splk/api-contracts';
import type * as Inv from '@splk/api-contracts';
import { inject, Injectable } from '@angular/core';
import { defer, firstValueFrom, from, Observable } from 'rxjs';
import {
  BulkStock, BulkStockInput, BulkStockPatch, CompositionInput, CostumeItem, CostumeKit, ItemEvent,
  ItemInput, ItemPatch, ItemQuery, ItemRetireInput, KitDetail, KitInput, KitPatch, Page, PageQuery, Series,
  WorkOrder, WorkOrderInput, WorkOrderPatch, WorkOrderStatus,
} from '@splk/api-contracts';
import { ApiError } from '../api-error';
import { CatalogApi } from '../catalog/catalog-api';
import { OrganizationApi } from '../organization/organization-api';
import { InventoryApi } from './inventory-api';
import { MockInventories, MockInventoryState, inventoryPage } from './mock-inventories';

interface State extends MockInventoryState {
  events: ItemEvent[];
}

/** Session-only synthetic inventory. Serialized operations roll back together, like server transactions. */
@Injectable()
export class MockInventoryApi extends InventoryApi {
  private readonly catalog = inject(CatalogApi);
  private readonly organization = inject(OrganizationApi, { optional: true });
  private state: State = { items: [], stocks: [], kits: [], events: [], orders: [], loans: [], inventories: [], targets: [], checks: [], slots: [], visits: [] };
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();

  inventories(unit: number, query: PageQuery = {}) { return this.run(() => inventoryPage(this.state.inventories.filter((i) => i.unitId === unit).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.id - a.id), query)); }
  inventory(id: number) { return this.run(() => this.inventoryEngine().detail(id)); }
  inventoryPreview(unit: number, scope: Inv.InventoryScope) { return this.run(async () => (await this.inventoryScopeEngine(unit)).preview(unit, scope)); }
  createInventory(unit: number, input: Inv.InventoryCreate) { return this.run(async () => (await this.inventoryScopeEngine(unit)).create(unit, input)); }
  inventoryCollection<K extends keyof Inv.InventoryCollections>(id: number, kind: K, query: PageQuery = {}) { return this.run(() => inventoryPage(this.inventoryEngine().collection(id, kind), query)); }
  addInventoryTarget(id: number, input: Inv.InventoryTargetAdd) { return this.run(async () => (await this.inventoryScopeEngine(this.inventoryEngine().header(id).unitId)).add(id, input)); }
  checkInventory(id: number, input: Inv.InventoryCheckBatch) { return this.run(async () => (await this.inventoryScopeEngine(this.inventoryEngine().header(id).unitId)).check(id, input)); }
  cancelInventoryCheck(id: number, version: number) { return this.run(() => this.inventoryEngine().cancel(id, version)); }
  createInventorySlot(id: number, input: Inv.InventorySlotInput) { return this.run(() => this.inventoryEngine().slot(id, null, input)); }
  updateInventorySlot(id: number, slot: number, input: Inv.InventorySlotPatch) { return this.run(() => this.inventoryEngine().slot(id, slot, input)); }
  createInventoryVisit(id: number, input: Inv.InventoryVisitInput) { return this.run(() => this.inventoryEngine().visit(id, null, input)); }
  updateInventoryVisit(id: number, visit: number, input: Inv.InventoryVisitPatch) { return this.run(() => this.inventoryEngine().visit(id, visit, input)); }
  closeInventory(id: number, input: Inv.InventoryClose) { return this.run(() => this.inventoryEngine().close(id, input)); }

  private inventoryEngine() { return new MockInventories(this.state, () => this.nextId++, this.event.bind(this)); }
  private async inventoryScopeEngine(unit: number) {
    const [series, types, regions, groups, units] = await Promise.all([firstValueFrom(this.catalog.series(unit)), firstValueFrom(this.catalog.partTypes(unit)), firstValueFrom(this.catalog.regions(unit)),
      this.organization ? firstValueFrom(this.organization.groups()) : Promise.resolve([]), this.organization ? firstValueFrom(this.organization.units()) : Promise.resolve([])]);
    return new MockInventories(this.state, () => this.nextId++, this.event.bind(this), { series, types, regions, groups, units });
  }

  items(unit: number, query: ItemQuery = {}) {
    return this.run(async () => {
      const series = await firstValueFrom(this.catalog.series(unit));
      let rows = this.state.items.filter((i) => i.unitId === unit && !!i.retiredAt === (query.retired ?? false));
      rows = rows.filter((i) => (query.available === undefined || i.available === query.available) && (!query.holder || i.holder && 'personId' in i.holder && i.holder.personId === query.holder) && (!query.series || i.seriesId === query.series) && (!query.condition || i.condition === query.condition)
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
        available: input.issuable ?? true, holder: null, loanId: null, loanKitId: null, kitId: null, retiredAt: null, retiredBy: null, retireReason: null, version: 1 };
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
        quantityTotal: input.quantityTotal, quantityInKits: 0, quantityReserved: 0, quantityAvailable: input.quantityTotal, note: text(input.note) };
      this.state.stocks.push(stock);
      return stock;
    });
  }

  updateStock(id: number, input: BulkStockPatch) {
    return this.run(() => {
      const stock = this.find(this.state.stocks, id);
      const next = { ...stock, ...input };
      quantity(next.quantityTotal);
      if (next.quantityTotal < this.stock(stock).quantityReserved) throw new ApiError(422, 'insufficient_stock');
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
      const kit: KitDetail = { holder: null, loanId: null, id: this.nextId++, unitId: unit, seriesId: input.seriesId, number: text(input.number), description: text(input.description),
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

  createWorkOrder(id: number, input: Inv.WorkOrderCreate) {
    return this.run(() => {
      const item = this.find(this.state.items, id);
      const inventory = this.inventoryEngine().link(item.unitId, input);
      if (item.retiredAt) throw new ApiError(422, 'item_retired');
      if (!input.description.trim()) throw invalid('description');
      const order: WorkOrder = { id: this.nextId++, itemId: id, unitId: item.unitId, type: input.type, description: input.description.trim(),
        assignee: text(input.assignee), dueOn: text(input.dueOn), status: 'open', inventoryId: inventory?.id ?? null };
      this.state.orders.push(order);
      this.event(id, 'work_order_created', { ...order });
      if (inventory) inventory.version++;
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

  loans(unit: number, query: LoanQuery = {}) {
    return this.run(() => page(this.state.loans.filter((loan) => {
      const open = loan.lines.some((l) => !l.closedAt);
      const overdue = open && loan.dueAt !== null && Date.parse(loan.dueAt) < Date.now();
      return loan.unitId === unit && (query.open === undefined || query.open === open) && (query.overdue === undefined || query.overdue === overdue)
        && (!query.kit || loan.kitId === query.kit) && (!query.person || 'personId' in loan.holder && loan.holder.personId === query.person) && (!query.holderType || 'personId' in loan.holder);
    }).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id - a.id), query));
  }
  loan(id: number) { return this.run(() => this.find(this.state.loans, id)); }
  issue(unit: number, input: LoanCreate) { return this.run(async () => {
    const inventory = this.inventoryEngine().link(unit, input), loan = await this.handover(unit, input);
    for (const line of loan.lines) line.inventoryId = inventory?.id ?? null;
    if (inventory) inventory.version++; return loan;
  }); }
  returnLoan(id: number, input: LoanReturnInput) { return this.run(() => {
    const loan = this.find(this.state.loans, id), inventory = this.inventoryEngine().link(loan.unitId, input);
    const result = this.receive(loan, input, false, inventory?.id ?? null); if (inventory) inventory.version++; return result;
  }); }
  exchange(id: number, input: LoanExchangeInput) {
    return this.run(async () => {
      const old = this.find(this.state.loans, id), line = old.lines.find((l) => l.id === input.lineId);
      const inventory = this.inventoryEngine().link(old.unitId, input);
      if (!line?.itemId || line.closedAt || line.itemId === input.itemId) throw invalid('lineId');
      const { itemId, inventoryId: _, inventoryVersion: __, ...values } = input;
      this.receive(old, { lines: [{ ...values, returnedQty: 1, closeType: 'exchanged' }] }, true, inventory?.id ?? null);
      const next = await this.handover(old.unitId, { holder: old.holder, items: [itemId], dueAt: old.dueAt, note: input.note });
      next.replacesLoanId = old.id;
      this.find(this.state.loans, next.id).replacesLoanId = old.id;
      for (const line of next.lines) line.inventoryId = inventory?.id ?? null;
      if (inventory) inventory.version++;
      return next;
    });
  }
  updateLoan(id: number, input: LoanPatch) {
    return this.run(() => { const loan = this.find(this.state.loans, id); if (input.dueAt !== undefined) this.dateTime(input.dueAt); Object.assign(loan, input); return loan; });
  }
  movements(unit: number, query: MovementQuery = {}) {
    return this.run(() => {
      return page(this.inventoryEngine().movements(unit).filter((r) => (!query.kit || r.kitId === query.kit) && (!query.person || 'personId' in r.holder && r.holder.personId === query.person)
        && (!query.item || r.itemId === query.item) && (!query.inventoryId || r.inventoryId === query.inventoryId) && (!query.from || Date.parse(r.at) >= Date.parse(query.from)) && (!query.to || Date.parse(r.at) <= Date.parse(query.to))), query);
    });
  }

  private async handover(unit: number, input: LoanCreate): Promise<LoanIssueResult> {
    if (!this.organization) throw new ApiError(500, 'internal_error');
    const holder = input.holder;
    if ('personId' in holder) {
      if (!(await firstValueFrom(this.organization.persons())).some((p) => p.id === holder.personId)) throw invalid('holder');
    } else if (holder.unitId === unit || !(await firstValueFrom(this.organization.units())).some((u) => u.id === holder.unitId && !u.archived)) throw invalid('holder');
    this.dateTime(input.dueAt ?? null);
    const kit = input.kitId ? this.find(this.state.kits, input.kitId) : null;
    if (kit && 'kitVersion' in input && input.kitVersion !== undefined) this.version(kit, input.kitVersion);
    if (kit && kit.unitId !== unit) throw new ApiError(404, 'not_found');
    if (kit && (kit.retiredAt || this.state.loans.some((l) => l.kitId === kit.id && l.lines.some((line) => !line.closedAt)))) throw new ApiError(422, 'kit_unavailable');
    const ids = kit ? this.state.items.filter((i) => i.kitId === kit.id).map((i) => i.id) : input.items ?? [];
    if (new Set(ids).size !== ids.length) throw invalid('items');
    const omit = 'omitItemIds' in input ? input.omitItemIds ?? [] : [];
    if (omit.some((id) => !ids.includes(id))) throw invalid('omitItemIds');
    const omittedItemIds: number[] = [], actual: number[] = [];
    for (const id of ids) {
      const item = this.find(this.state.items, id);
      if (item.unitId !== unit) throw new ApiError(404, 'not_found');
      if (omit.includes(id) || !item.issuable || item.retiredAt || this.openItem(id)) {
        if (!kit) throw new ApiError(422, 'item_unavailable');
        omittedItemIds.push(id);
      } else actual.push(id);
    }
    if (kit && (omittedItemIds.length || kit.compositionState === 'incomplete' || kit.bulkLines.some((l) => l.presentQty < l.requiredQty)) && !text(input.note)) throw invalid('note');
    let bulk = kit ? kit.bulkLines.filter((l) => l.presentQty > 0).map((l) => ({ stockId: l.bulkStockId, qty: l.presentQty })) : input.bulk ?? [];
    if (kit && 'kitBulk' in input && input.kitBulk !== undefined) {
      const present = new Map(bulk.map((l) => [l.stockId, l.qty]));
      for (const line of input.kitBulk) { quantity(line.qty); if (!present.has(line.stockId) || line.qty > present.get(line.stockId)!) throw invalid('kitBulk'); }
      if (input.kitBulk.reduce((sum, l) => sum + l.qty, 0) < bulk.reduce((sum, l) => sum + l.qty, 0) && !text(input.note)) throw invalid('note');
      bulk = input.kitBulk.filter((l) => l.qty > 0);
    }
    if (new Set(bulk.map((l) => l.stockId)).size !== bulk.length) throw invalid('bulk');
    for (const line of bulk) {
      quantity(line.qty, 1);
      const stock = this.find(this.state.stocks, line.stockId);
      if (stock.unitId !== unit) throw new ApiError(404, 'not_found');
      if (!kit && this.stock(stock).quantityAvailable < line.qty) throw new ApiError(422, 'insufficient_stock');
    }
    if (!actual.length && !bulk.length) throw invalid('items');
    const [series, types, regions] = await Promise.all([firstValueFrom(this.catalog.series(unit)), firstValueFrom(this.catalog.partTypes(unit)), firstValueFrom(this.catalog.regions(unit))]);
    const classification = (seriesId: number | null, partTypeId: number | null) => { const s = series.find((s) => s.id === seriesId), t = types.find((t) => t.id === (partTypeId ?? s?.partTypeId)), region = regions.find((r) => r.id === (s?.regionId ?? t?.regionId)); return { region: region ? [regions.find((r) => r.id === region.parentId)?.name, region.name].filter(Boolean).join(' · ') : null, gender: s?.gender ?? t?.gender ?? null }; };
    const loan: CostumeLoan = { id: this.nextId++, unitId: unit, holder: structuredClone(holder), kitId: kit?.id ?? null,
      issuedAt: new Date().toISOString(), issuedBy: 1, dueAt: input.dueAt ?? null, note: text(input.note), replacesLoanId: null, lines: [], returns: [] };
    for (const itemId of actual) {
      const item = this.find(this.state.items, itemId);
      loan.lines.push({ ...classification(item.seriesId, null), id: this.nextId++, label: `${series.find((s) => s.id === item.seriesId)?.name ?? 'Součástka'} ${item.number ?? '(bez čísla)'}`, itemId, bulkStockId: null, qty: 1, returnedQty: 0, closedAt: null, closedBy: null, closeType: null, closeNote: null });
      this.event(itemId, 'issued', { loanId: loan.id, holder });
    }
    for (const line of bulk) loan.lines.push({ ...classification(null, this.find(this.state.stocks, line.stockId).partTypeId), id: this.nextId++, label: `${types.find((t) => t.id === this.find(this.state.stocks, line.stockId).partTypeId)?.name ?? 'Zásoba'} ${this.find(this.state.stocks, line.stockId).variant ?? ''}`.trim(), itemId: null, bulkStockId: line.stockId, qty: line.qty, returnedQty: 0, closedAt: null, closedBy: null, closeType: null, closeNote: null });
    this.state.loans.push(loan);
    return { ...loan, omittedItemIds };
  }

  private receive(loan: CostumeLoan, input: LoanReturnInput, exchange = false, inventory: number | null = null): CostumeLoan {
    if (!input.lines.length || new Set(input.lines.map((l) => l.lineId)).size !== input.lines.length) throw invalid('lines');
    for (const values of input.lines) {
      const line = loan.lines.find((l) => l.id === values.lineId);
      if (!line) throw new ApiError(404, 'not_found');
      if (values.closeType === 'exchanged' && !exchange) throw invalid('closeType');
      quantity(values.returnedQty, values.closeType === 'settled' ? 0 : 1);
      const remaining = line.qty - line.returnedQty;
      if (line.closedAt || values.returnedQty > remaining) throw new ApiError(422, 'loan_line_closed');
      const lostQty = values.closeType === 'settled' ? remaining - values.returnedQty : 0;
      if (values.closeType === 'settled' && (!text(values.note) || lostQty <= 0)) throw invalid('note');
      const patch = { ...(values.condition !== undefined ? { condition: values.condition } : {}), ...(values.issuable !== undefined ? { issuable: values.issuable } : {}), ...(values.location !== undefined ? { location: values.location } : {}) };
      if (Object.keys(patch).length && (!line.itemId || lostQty)) throw invalid('condition');
      line.returnedQty += values.returnedQty;
      if (lostQty || line.returnedQty === line.qty) Object.assign(line, { closedAt: new Date().toISOString(), closedBy: 1, closeType: values.closeType, closeNote: text(values.note) });
      loan.returns.push({ id: this.nextId++, lineId: line.id, qty: values.returnedQty, lostQty, closeType: values.closeType, note: text(values.note), at: new Date().toISOString(), by: 1, inventoryId: inventory });
      if (line.itemId) {
        const item = this.find(this.state.items, line.itemId);
        for (const [field, to] of Object.entries(patch)) if (item[field as keyof CostumeItem] !== to) this.event(item.id, `${field}_changed`, { to, loanId: loan.id });
        if (Object.keys(patch).length) Object.assign(item, patch, { version: item.version + 1 });
        if (lostQty && !item.retiredAt) { Object.assign(item, { retiredAt: new Date().toISOString(), retiredBy: 1, retireReason: text(values.note), version: item.version + 1 }); this.event(item.id, 'retired', { reason: values.note, loanId: loan.id }); }
        this.event(item.id, values.closeType, { loanId: loan.id, note: values.note });
      } else if (lostQty) {
        this.find(this.state.stocks, line.bulkStockId!).quantityTotal -= lostQty;
        if (loan.kitId) {
          const kit = this.find(this.state.kits, loan.kitId), allocation = kit.bulkLines.find((l) => l.bulkStockId === line.bulkStockId);
          if (allocation) { const removed = Math.min(lostQty, allocation.presentQty); allocation.presentQty -= removed; if (removed) kit.changes.push({ id: this.nextId++, kitId: kit.id, itemId: null, bulkStockId: line.bulkStockId, change: 'removed', qty: removed, at: new Date().toISOString(), by: 1, note: text(values.note) }); }
        }
      }
      if (lostQty && loan.kitId) { const kit = this.find(this.state.kits, loan.kitId); kit.version++; if (kit.compositionState !== 'unverified') kit.compositionState = 'pending_check'; }
    }
    return loan;
  }

  private openItem(id: number) { return this.state.loans.find((l) => l.lines.some((line) => line.itemId === id && !line.closedAt)); }
  private dateTime(value: string | null) { if (value !== null && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) throw invalid('dueAt'); }
  private refresh() {
    for (const item of this.state.items) { const loan = this.openItem(item.id); item.available = !item.retiredAt && item.issuable && !loan; item.holder = loan?.holder ?? null; item.loanId = loan?.id ?? null; item.loanKitId = loan?.kitId ?? null; }
    for (const kit of this.state.kits) { const loan = this.state.loans.find((l) => l.kitId === kit.id && l.lines.some((line) => !line.closedAt)); kit.loanId = loan?.id ?? null; kit.holder = loan?.holder ?? null; }
    for (const stock of this.state.stocks) { Object.assign(stock, this.stock(stock)); if (stock.quantityAvailable < 0 || stock.quantityTotal < 0) throw new ApiError(422, 'insufficient_stock'); }
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
    const allocations = new Map<number, number>();
    for (const kit of this.state.kits) for (const line of kit.bulkLines) if (line.bulkStockId === stock.id) allocations.set(kit.id, line.presentQty);
    const quantityInKits = [...allocations.values()].reduce((sum, qty) => sum + qty, 0);
    const handed = new Map<number, number>();
    let direct = 0;
    for (const loan of this.state.loans) for (const line of loan.lines) if (line.bulkStockId === stock.id && !line.closedAt) {
      const qty = line.qty - line.returnedQty;
      if (loan.kitId === null) direct += qty; else handed.set(loan.kitId, (handed.get(loan.kitId) ?? 0) + qty);
    }
    for (const [kit, qty] of handed) allocations.set(kit, Math.max(qty, allocations.get(kit) ?? 0));
    const quantityReserved = direct + [...allocations.values()].reduce((sum, qty) => sum + qty, 0);
    return { ...stock, quantityInKits, quantityReserved, quantityAvailable: stock.quantityTotal - quantityReserved };
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
        try { this.refresh(); const result = await work(); this.refresh(); return structuredClone(result); } catch (error) { this.state = before; throw error; }
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
