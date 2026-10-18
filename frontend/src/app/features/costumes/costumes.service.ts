import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Borrower,
  CostumeItem,
  CostumeKitTemplate,
  CostumeLoan,
  CostumePartType,
  CostumeSeries,
  CostumeState,
  CostumeWorkOrder,
  ExternalPerson,
  ItemCondition,
  ItemLocation,
  LOCATION_LABELS,
  CONDITION_LABELS,
  WORK_ORDER_KIND_LABELS,
  WORK_ORDER_STATUS_LABELS,
  WorkOrderKind,
  WorkOrderStatus,
} from './models/costume.model';
import { CostumeStoreService } from './costume-store.service';
import {
  CostumeRuleError,
  ExchangeOp,
  ReturnOp,
  addEvent,
  clean,
  exchangeItem,
  findItem,
  findLoan,
  issueItem,
  nextId,
  returnLoan,
} from './utils/costume-ops';
import { findSeries, isNumberTaken, isWorkOrderOpen, itemLabel, openLoanFor, seriesLabel } from './utils/costume-logic';

export { CostumeRuleError } from './utils/costume-ops';

export interface ItemInput {
  seriesId: number;
  number?: number;
  variantId?: string;
  size?: string;
  description?: string;
  note?: string;
}

export interface IssueInput {
  borrower: Borrower;
  itemIds: number[];
  dueAt?: string;
  note?: string;
  inventoryId?: number;
  visitId?: number;
}

export interface WorkOrderInput {
  itemId: number;
  kind: WorkOrderKind;
  description: string;
  assignee?: string;
  dueAt?: string;
  inventoryId?: number;
  visitId?: number;
}

export interface SeriesInput {
  genderId: string;
  regionId: string;
  partTypeId: number;
  variantId?: string;
  allowNumberReuse?: boolean;
  note?: string;
}

// Krojový fond: součástky, zápůjčky, pracovní úkoly a nastavení klasifikace (mock implementace).
// Výdej, vrácení a výměna se stejně volají z krojové karty i z inventurní návštěvy.
@Injectable({ providedIn: 'root' })
export class CostumesService {
  constructor(private store: CostumeStoreService) {}

  get state$(): Observable<CostumeState> {
    return this.store.state$;
  }

  get snapshot(): CostumeState {
    return this.store.snapshot;
  }

  getState(): Observable<CostumeState> {
    return this.store.state$;
  }

  // --- Součástky ---

  createItem(input: ItemInput): Observable<CostumeItem> {
    return this.store.mutate((state, ctx) => {
      this.assertItemInput(state, input);
      const item: CostumeItem = {
        id: nextId(state.items),
        ensembleId: ctx.ensembleId,
        seriesId: input.seriesId,
        number: input.number,
        variantId: input.variantId || undefined,
        size: clean(input.size),
        description: clean(input.description),
        note: clean(input.note),
        condition: 'ok',
        issuable: true,
        location: 'store',
        createdAt: ctx.now,
      };
      state.items.push(item);
      addEvent(state, ctx, { kind: 'item-created', itemId: item.id, text: `Založeno: ${itemLabel(state, item)}` });
      return item;
    });
  }

  updateItem(id: number, input: ItemInput): Observable<CostumeItem> {
    return this.store.mutate((state, ctx) => {
      const item = findItem(state, id);
      if (item.retired) throw new CostumeRuleError('Vyřazenou součástku nelze upravovat.');
      this.assertItemInput(state, input, id);
      const before = itemLabel(state, item);
      Object.assign(item, {
        seriesId: input.seriesId,
        number: input.number,
        variantId: input.variantId || undefined,
        size: clean(input.size),
        description: clean(input.description),
        note: clean(input.note),
      });
      const after = itemLabel(state, item);
      addEvent(state, ctx, { kind: 'item-updated', itemId: id, text: before === after ? 'Upraveny údaje' : `Změněno označení: ${before} → ${after}` });
      return item;
    });
  }

  // Stav součástky a vydatelnost – nezávisle na umístění a zápůjčce
  setCondition(id: number, condition: ItemCondition, issuable: boolean, note?: string): Observable<CostumeItem> {
    return this.store.mutate((state, ctx) => {
      const item = findItem(state, id);
      const changes = [
        item.condition !== condition ? `${CONDITION_LABELS[item.condition]} → ${CONDITION_LABELS[condition]}` : '',
        item.issuable !== issuable ? (issuable ? 'vydatelné' : 'nevydatelné') : '',
      ].filter(Boolean);
      Object.assign(item, { condition, issuable });
      addEvent(state, ctx, { kind: 'condition', itemId: id, text: `Stav: ${changes.join(', ') || 'beze změny'}`, note });
      return item;
    });
  }

  // Fyzické umístění (sklad, švadlena, oprava, neznámé). „U držitele“ vzniká jen výdejem.
  setLocation(id: number, location: ItemLocation, note?: string): Observable<CostumeItem> {
    return this.store.mutate((state, ctx) => {
      const item = findItem(state, id);
      if (item.retired) throw new CostumeRuleError('Vyřazená součástka nemá umístění.');
      if (location === 'holder') throw new CostumeRuleError('Kus se k držiteli dostane jen výdejem.');
      if (openLoanFor(state, id) && location !== 'unknown') {
        throw new CostumeRuleError('Kus je zapůjčený – nejdřív zapište jeho vrácení.');
      }
      const from = LOCATION_LABELS[item.location];
      Object.assign(item, { location, locationNote: clean(note) });
      addEvent(state, ctx, { kind: 'location', itemId: id, text: `Umístění: ${from} → ${LOCATION_LABELS[location]}`, note });
      return item;
    });
  }

  // Vyřazený kus zůstává v evidenci i historii; číslo se bez pravidla řady znovu nepoužije
  retireItem(id: number, reason: string, settleOpenLoan = false): Observable<CostumeItem> {
    return this.store.mutate((state, ctx) => {
      const item = findItem(state, id);
      if (item.retired) throw new CostumeRuleError('Součástka už je vyřazená.');
      if (!reason.trim()) throw new CostumeRuleError('Uveďte důvod vyřazení.');
      const loan = openLoanFor(state, id);
      if (loan && !settleOpenLoan) throw new CostumeRuleError('Součástka je zapůjčená – nejdřív vyjasněte, jak se zápůjčka vypořádá.');
      if (loan) Object.assign(loan, { endedAt: ctx.now, endedByMemberId: ctx.actorId, endReason: 'settled', endNote: `Vypořádáno vyřazením: ${reason.trim()}` });
      item.retired = { at: ctx.now, byMemberId: ctx.actorId, reason: reason.trim() };
      addEvent(state, ctx, { kind: 'item-retired', itemId: id, loanId: loan?.id, text: `Vyřazeno: ${itemLabel(state, item)}`, note: reason });
      return item;
    });
  }

  // --- Zápůjčky ---

  issueItems(input: IssueInput): Observable<CostumeLoan[]> {
    return this.store.mutate((state, ctx) => {
      if (!input.itemIds.length) throw new CostumeRuleError('Vyberte alespoň jeden kus.');
      if (new Set(input.itemIds).size !== input.itemIds.length) throw new CostumeRuleError('Kus je ve výběru dvakrát.');
      return input.itemIds.map((itemId) =>
        issueItem(state, ctx, { itemId, borrower: input.borrower, dueAt: input.dueAt, note: input.note, inventoryId: input.inventoryId, visitId: input.visitId }),
      );
    });
  }

  returnLoan(loanId: number, op: ReturnOp = {}): Observable<CostumeLoan> {
    return this.store.mutate((state, ctx) => returnLoan(state, ctx, loanId, op));
  }

  exchangeItem(op: ExchangeOp): Observable<{ returned?: CostumeLoan; issued: CostumeLoan }> {
    return this.store.mutate((state, ctx) => exchangeItem(state, ctx, op));
  }

  setLoanDue(loanId: number, dueAt: string | undefined): Observable<CostumeLoan> {
    return this.store.mutate((state) => {
      const loan = findLoan(state, loanId);
      if (loan.endedAt) throw new CostumeRuleError('Zápůjčka je už ukončená.');
      loan.dueAt = dueAt || undefined;
      return loan;
    });
  }

  // --- Pracovní úkoly ---

  createWorkOrder(input: WorkOrderInput): Observable<CostumeWorkOrder> {
    return this.store.mutate((state, ctx) => {
      const item = findItem(state, input.itemId);
      if (item.retired) throw new CostumeRuleError('Na vyřazenou součástku nelze zadat úkol.');
      if (!input.description.trim()) throw new CostumeRuleError('Popište, co je potřeba udělat.');
      const order: CostumeWorkOrder = {
        id: nextId(state.workOrders),
        ensembleId: ctx.ensembleId,
        itemId: item.id,
        kind: input.kind,
        description: input.description.trim(),
        status: 'open',
        assignee: clean(input.assignee),
        dueAt: input.dueAt || undefined,
        createdAt: ctx.now,
        createdByMemberId: ctx.actorId,
        inventoryId: input.inventoryId,
      };
      state.workOrders.push(order);
      addEvent(state, ctx, {
        kind: 'work-order',
        itemId: item.id,
        workOrderId: order.id,
        inventoryId: input.inventoryId,
        visitId: input.visitId,
        text: `Nový úkol: ${WORK_ORDER_KIND_LABELS[order.kind]} – ${order.description}`,
      });
      return order;
    });
  }

  updateWorkOrder(id: number, status: WorkOrderStatus, resolution?: string, assignee?: string): Observable<CostumeWorkOrder> {
    return this.store.mutate((state, ctx) => {
      const order = state.workOrders.find((o) => o.id === id);
      if (!order) throw new CostumeRuleError('Úkol nebyl nalezen.');
      const wasOpen = isWorkOrderOpen(order);
      Object.assign(order, {
        status,
        assignee: assignee !== undefined ? clean(assignee) : order.assignee,
        resolution: clean(resolution) ?? order.resolution,
        closedAt: isWorkOrderOpen({ ...order, status }) ? undefined : wasOpen ? ctx.now : order.closedAt,
      });
      addEvent(state, ctx, { kind: 'work-order', itemId: order.itemId, workOrderId: id, text: `Úkol ${WORK_ORDER_KIND_LABELS[order.kind].toLocaleLowerCase('cs')}: ${WORK_ORDER_STATUS_LABELS[status]}`, note: resolution });
      return order;
    });
  }

  // --- Držitelé mimo soubor ---

  createExternal(input: { name: string; contact?: string; note?: string }): Observable<ExternalPerson> {
    return this.store.mutate((state, ctx) => {
      if (!input.name.trim()) throw new CostumeRuleError('Vyplňte jméno.');
      const person: ExternalPerson = { id: nextId(state.externals), name: input.name.trim(), contact: clean(input.contact), note: clean(input.note), createdAt: ctx.now };
      state.externals.push(person);
      return person;
    });
  }

  updateExternal(id: number, input: { name: string; contact?: string; note?: string }): Observable<ExternalPerson> {
    return this.store.mutate((state) => {
      const person = state.externals.find((e) => e.id === id);
      if (!person) throw new CostumeRuleError('Osoba nebyla nalezena.');
      if (!input.name.trim()) throw new CostumeRuleError('Vyplňte jméno.');
      Object.assign(person, { name: input.name.trim(), contact: clean(input.contact), note: clean(input.note) });
      return person;
    });
  }

  // --- Nastavení fondu ---

  createSeries(input: SeriesInput): Observable<CostumeSeries> {
    return this.store.mutate((state, ctx) => {
      const duplicate = state.series.find(
        (s) => s.genderId === input.genderId && s.regionId === input.regionId && s.partTypeId === input.partTypeId && (s.variantId ?? '') === (input.variantId ?? ''),
      );
      if (duplicate) throw new CostumeRuleError(`Řada ${seriesLabel(state, duplicate)} už existuje.`);
      const series: CostumeSeries = {
        id: nextId(state.series),
        ensembleId: ctx.ensembleId,
        genderId: input.genderId,
        regionId: input.regionId,
        partTypeId: input.partTypeId,
        variantId: input.variantId || undefined,
        allowNumberReuse: input.allowNumberReuse || undefined,
        note: clean(input.note),
      };
      state.series.push(series);
      return series;
    });
  }

  // Pravidlo recyklace čísel je výslovné nastavení řady
  setSeriesNumberReuse(seriesId: number, allow: boolean): Observable<CostumeSeries> {
    return this.store.mutate((state) => {
      const series = findSeries(state, seriesId);
      if (!series) throw new CostumeRuleError('Řada nebyla nalezena.');
      series.allowNumberReuse = allow || undefined;
      return series;
    });
  }

  createPartType(name: string, genderId?: string): Observable<CostumePartType> {
    return this.store.mutate((state) => {
      if (!name.trim()) throw new CostumeRuleError('Vyplňte název druhu součástky.');
      if (state.partTypes.some((t) => t.name.toLocaleLowerCase('cs') === name.trim().toLocaleLowerCase('cs') && t.genderId === (genderId || undefined))) {
        throw new CostumeRuleError('Takový druh součástky už existuje.');
      }
      const type: CostumePartType = { id: nextId(state.partTypes), name: name.trim(), genderId: genderId || undefined };
      state.partTypes.push(type);
      return type;
    });
  }

  addRegion(label: string): Observable<CostumeState['classification']> {
    return this.store.mutate((state) => {
      const id = this.optionId(label, state.classification.regions);
      state.classification.regions.push({ id, label: label.trim() });
      return state.classification;
    });
  }

  saveVariant(input: { id?: string; label: string; partTypeIds: number[] }): Observable<CostumeState['classification']> {
    return this.store.mutate((state) => {
      if (!input.partTypeIds.length) throw new CostumeRuleError('Vyberte, u kterých druhů součástek varianta platí.');
      const existing = state.classification.variants.find((v) => v.id === input.id);
      if (existing) {
        if (!input.label.trim()) throw new CostumeRuleError('Vyplňte název varianty.');
        Object.assign(existing, { label: input.label.trim(), partTypeIds: [...input.partTypeIds] });
      } else {
        const id = this.optionId(input.label, state.classification.variants);
        state.classification.variants.push({ id, label: input.label.trim(), partTypeIds: [...input.partTypeIds] });
      }
      return state.classification;
    });
  }

  saveKitTemplate(input: Omit<CostumeKitTemplate, 'id' | 'ensembleId'> & { id?: number }): Observable<CostumeKitTemplate> {
    return this.store.mutate((state, ctx) => {
      if (!input.name.trim()) throw new CostumeRuleError('Vyplňte název kompletu.');
      if (!input.partTypeIds.length) throw new CostumeRuleError('Vyberte alespoň jeden druh součástky.');
      const data = { name: input.name.trim(), genderId: input.genderId, regionId: input.regionId, partTypeIds: [...input.partTypeIds], note: clean(input.note) };
      const existing = state.kitTemplates.find((t) => t.id === input.id);
      if (existing) return Object.assign(existing, data);
      const template: CostumeKitTemplate = { id: nextId(state.kitTemplates), ensembleId: ctx.ensembleId, ...data };
      state.kitTemplates.push(template);
      return template;
    });
  }

  deleteKitTemplate(id: number): Observable<void> {
    return this.store.mutate((state) => {
      state.kitTemplates = state.kitTemplates.filter((t) => t.id !== id);
    });
  }

  setDefaultSlotCapacity(capacity: number): Observable<number> {
    return this.store.mutate((state) => {
      if (!Number.isInteger(capacity) || capacity < 1) throw new CostumeRuleError('Kapacita musí být kladné celé číslo.');
      state.defaultSlotCapacity = capacity;
      return capacity;
    });
  }

  // --- interní ---

  private optionId(label: string, existing: { id: string; label: string }[]): string {
    if (!label.trim()) throw new CostumeRuleError('Vyplňte název.');
    if (existing.some((o) => o.label.toLocaleLowerCase('cs') === label.trim().toLocaleLowerCase('cs'))) throw new CostumeRuleError('Taková možnost už existuje.');
    const base = label.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'moznost';
    let id = base;
    for (let i = 2; existing.some((o) => o.id === id); i++) id = `${base}-${i}`;
    return id;
  }

  private assertItemInput(state: CostumeState, input: ItemInput, exceptItemId?: number): void {
    const series = findSeries(state, input.seriesId);
    if (!series) throw new CostumeRuleError('Vyberte evidenční řadu.');
    if (input.variantId && series.variantId) throw new CostumeRuleError('Varianta je už součástí řady.');
    if (input.number === undefined) return;
    if (!Number.isInteger(input.number) || input.number < 1) throw new CostumeRuleError('Evidenční číslo musí být kladné celé číslo.');
    if (isNumberTaken(state, input.seriesId, input.number, exceptItemId)) {
      const retired = state.items.some((i) => i.seriesId === input.seriesId && i.number === input.number && i.retired && i.id !== exceptItemId);
      throw new CostumeRuleError(
        retired && !series.allowNumberReuse
          ? `Číslo ${input.number} měl v řadě ${seriesLabel(state, series)} vyřazený kus – řada nepovoluje opětovné použití čísel.`
          : `Číslo ${input.number} v řadě ${seriesLabel(state, series)} už má jiný kus.`,
      );
    }
  }
}
