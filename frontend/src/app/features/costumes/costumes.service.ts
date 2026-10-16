import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  Borrower,
  CostumeItem,
  CostumeKit,
  CostumeLogEntry,
  CostumeState,
  ExternalPerson,
  Inventory,
  InventoryResult,
  Loan,
  LoanLine,
} from './models/costume.model';
import { seedCostumeState } from './data/mock-costumes';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import {
  buildInventoryLines,
  isNumberTaken,
  itemLabel,
  lineRemaining,
  openKitLoan,
  openLineForItem,
  partTypeName,
} from './utils/costume-logic';

// Chyba porušující pravidla evidence (obsazené číslo, předání zapůjčené věci…) – text je pro uživatele
export class CostumeRuleError extends Error {}

export interface ItemInput {
  seriesId: number;
  number?: number;
  partTypeId: number;
  description?: string;
  size?: string;
  note?: string;
  kitId?: number;
}

export interface IssueLoanInput {
  borrower: Borrower;
  kitId?: number;
  itemIds: number[];
  // Neočíslované kusy z kompletu
  bulk: { kitId: number; partTypeId: number; count: number }[];
  issuedAt: string;
  dueAt?: string;
  longTerm: boolean;
  note?: string;
}

export interface ReturnLineInput {
  lineId: number;
  count: number;
  note?: string;
  ready: boolean;
}

const MOCK_DELAY = 150;

const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1;
const clean = (text: string | undefined) => text?.trim() || undefined;

// Mock implementace krojové evidence. Zapisovat smí jen pověřené krojárky (Správa krojů) –
// služba to ověřuje stejně, jako to bude dělat server; skrytá tlačítka nestačí.
@Injectable({ providedIn: 'root' })
export class CostumesService {
  private stateSubject = new BehaviorSubject<CostumeState>(loadDemoData('costumes', seedCostumeState));

  readonly state$ = this.stateSubject.asObservable();

  constructor(private access: AccessService) {
    this.stateSubject.subscribe((state) => saveDemoData('costumes', state));
  }

  getState(): Observable<CostumeState> {
    return this.state$;
  }

  get snapshot(): CostumeState {
    return this.stateSubject.value;
  }

  // --- Součásti ---

  createItem(input: ItemInput): Observable<CostumeItem> {
    return this.mutate((state) => {
      this.assertNumberFree(state, input.seriesId, input.number);
      const item: CostumeItem = {
        id: nextId(state.items),
        seriesId: input.seriesId,
        number: input.number,
        partTypeId: input.partTypeId,
        description: clean(input.description),
        size: clean(input.size),
        note: clean(input.note),
        kitId: input.kitId,
        ready: true,
        createdAt: this.now(),
      };
      state.items.push(item);
      this.log(state, { kind: 'item-created', itemId: item.id, kitId: item.kitId, text: `Založeno: ${itemLabel(state, item)}` });
      return item;
    });
  }

  // Úprava údajů součásti (bez změny kompletu – ta má vlastní historii, viz moveItemToKit)
  updateItem(id: number, patch: Omit<ItemInput, 'kitId'>): Observable<CostumeItem> {
    return this.mutate((state) => {
      const item = this.findItem(state, id);
      if (item.retired) throw new CostumeRuleError('Vyřazenou součást nelze upravovat.');
      this.assertNumberFree(state, patch.seriesId, patch.number, id);
      const before = itemLabel(state, item);
      Object.assign(item, {
        seriesId: patch.seriesId,
        number: patch.number,
        partTypeId: patch.partTypeId,
        description: clean(patch.description),
        size: clean(patch.size),
        note: clean(patch.note),
      });
      const after = itemLabel(state, item);
      this.log(state, { kind: 'item-updated', itemId: id, text: before === after ? 'Upraveny údaje' : `Změněno označení: ${before} → ${after}` });
      return item;
    });
  }

  setItemReady(id: number, ready: boolean, note?: string): Observable<CostumeItem> {
    return this.mutate((state) => {
      const item = this.findItem(state, id);
      item.ready = ready;
      this.log(state, {
        kind: 'item-ready',
        itemId: id,
        text: ready ? 'Připraveno k zapůjčení' : 'Nepřipraveno k zapůjčení',
        note: clean(note),
      });
      return item;
    });
  }

  // Vyřazení uvolní číslo v řadě. Zapůjčenou věc lze vyřadit jen s výslovným vypořádáním zápůjčky.
  retireItem(id: number, reason: string | undefined, settleOpenLoan = false): Observable<CostumeItem> {
    return this.mutate((state) => {
      const item = this.findItem(state, id);
      if (item.retired) throw new CostumeRuleError('Součást už je vyřazená.');
      const open = openLineForItem(state, id);
      if (open && !settleOpenLoan) {
        throw new CostumeRuleError('Součást je podle evidence zapůjčená – nejdřív vyjasněte její vypořádání.');
      }
      if (open) {
        open.line.settled = { at: this.now(), byUserId: this.actorId(), note: `Vypořádáno vyřazením${reason ? `: ${reason}` : ''}` };
      }
      item.retired = { at: this.now(), byUserId: this.actorId(), reason: clean(reason) };
      this.log(state, { kind: 'item-retired', itemId: id, kitId: item.kitId, text: `Vyřazeno: ${itemLabel(state, item)}`, note: clean(reason) });
      return item;
    });
  }

  // --- Komplety ---

  createKit(label: string, seriesId?: number, note?: string): Observable<CostumeKit> {
    return this.mutate((state) => {
      if (!label.trim()) throw new CostumeRuleError('Vyplňte označení kompletu.');
      const kit: CostumeKit = { id: nextId(state.kits), label: label.trim(), seriesId, note: clean(note), bulk: [], createdAt: this.now() };
      state.kits.push(kit);
      this.log(state, { kind: 'kit-created', kitId: kit.id, text: `Založen komplet ${kit.label}` });
      return kit;
    });
  }

  updateKit(id: number, patch: { label: string; seriesId?: number; note?: string; needsCheck?: boolean }): Observable<CostumeKit> {
    return this.mutate((state) => {
      const kit = this.findKit(state, id);
      if (!patch.label.trim()) throw new CostumeRuleError('Vyplňte označení kompletu.');
      Object.assign(kit, { label: patch.label.trim(), seriesId: patch.seriesId, note: clean(patch.note), needsCheck: patch.needsCheck || undefined });
      this.log(state, { kind: 'kit-updated', kitId: id, text: 'Upraveny údaje kompletu' });
      return kit;
    });
  }

  // Trvalá změna složení: zařazení, přesun do jiného kompletu (kitId) nebo odebrání (undefined).
  // Dřívější zápůjčky a inventury se tím nemění.
  moveItemToKit(itemId: number, kitId: number | undefined, note?: string): Observable<CostumeItem> {
    return this.mutate((state) => {
      const item = this.findItem(state, itemId);
      if (item.retired) throw new CostumeRuleError('Vyřazenou součást nelze zařadit do kompletu.');
      const fromKitId = item.kitId;
      if (fromKitId === kitId) return item;
      if (kitId !== undefined) this.findKit(state, kitId);
      item.kitId = kitId;
      const label = itemLabel(state, item);
      if (fromKitId !== undefined) {
        this.log(state, { kind: 'kit-remove', kitId: fromKitId, itemId, text: kitId !== undefined ? `Přesunuto do jiného kompletu: ${label}` : `Odebráno ze složení: ${label}`, note: clean(note) });
      }
      if (kitId !== undefined) {
        this.log(state, { kind: 'kit-add', kitId, itemId, fromKitId, text: `Přidáno do složení: ${label}`, note: clean(note) });
      }
      return item;
    });
  }

  // Neočíslované doplňky: požadovaný počet (0 = odebrat ze složení) a aktuálně přítomný počet
  setKitBulk(kitId: number, partTypeId: number, required: number, present: number, note?: string): Observable<CostumeKit> {
    return this.mutate((state) => {
      const kit = this.findKit(state, kitId);
      if (required < 0 || present < 0) throw new CostumeRuleError('Počet nemůže být záporný.');
      const name = partTypeName(state, partTypeId);
      const existing = kit.bulk.find((b) => b.partTypeId === partTypeId);
      if (required === 0 && present === 0) {
        kit.bulk = kit.bulk.filter((b) => b.partTypeId !== partTypeId);
        this.log(state, { kind: 'kit-bulk', kitId, partTypeId, text: `Odebráno ze složení: ${name}`, note: clean(note) });
        return kit;
      }
      if (existing) {
        const text = `${name}: požadováno ${existing.required} → ${required}, v kompletu ${existing.present} → ${present}`;
        Object.assign(existing, { required, present, note: clean(note) });
        this.log(state, { kind: 'kit-bulk', kitId, partTypeId, text, note: clean(note) });
      } else {
        kit.bulk.push({ partTypeId, required, present, note: clean(note) });
        this.log(state, { kind: 'kit-bulk', kitId, partTypeId, text: `Přidáno do složení: ${name} (${present} z ${required})`, note: clean(note) });
      }
      return kit;
    });
  }

  // --- Vypůjčitelé mimo soubor ---

  createExternal(input: { name: string; contact?: string; note?: string }): Observable<ExternalPerson> {
    return this.mutate((state) => {
      if (!input.name.trim()) throw new CostumeRuleError('Vyplňte jméno.');
      const person: ExternalPerson = { id: nextId(state.externals), name: input.name.trim(), contact: clean(input.contact), note: clean(input.note), createdAt: this.now() };
      state.externals.push(person);
      return person;
    });
  }

  updateExternal(id: number, input: { name: string; contact?: string; note?: string }): Observable<ExternalPerson> {
    return this.mutate((state) => {
      const person = state.externals.find((e) => e.id === id);
      if (!person) throw new CostumeRuleError('Osoba nebyla nalezena.');
      if (!input.name.trim()) throw new CostumeRuleError('Vyplňte jméno.');
      Object.assign(person, { name: input.name.trim(), contact: clean(input.contact), note: clean(input.note) });
      return person;
    });
  }

  // --- Zápůjčky ---

  // Předání: jednotlivé součásti, neočíslované kusy i celý komplet. Řádky zachytí přesně to,
  // co bylo předáno v okamžiku předání.
  issueLoan(input: IssueLoanInput): Observable<Loan> {
    return this.mutate((state) => {
      if (!input.itemIds.length && !input.bulk.some((b) => b.count > 0)) {
        throw new CostumeRuleError('Vyberte alespoň jednu součást k předání.');
      }
      if (input.kitId !== undefined && openKitLoan(state, input.kitId)) {
        throw new CostumeRuleError('Komplet je už zapůjčený – nejdřív zapište jeho vrácení.');
      }
      const lines: LoanLine[] = [];
      let lineId = 1;
      for (const itemId of input.itemIds) {
        const item = this.findItem(state, itemId);
        const label = itemLabel(state, item);
        if (item.retired) throw new CostumeRuleError(`${label} je vyřazená.`);
        if (openLineForItem(state, itemId)) throw new CostumeRuleError(`${label} je už zapůjčená.`);
        if (!item.ready) throw new CostumeRuleError(`${label} není připravená k zapůjčení.`);
        lines.push({ id: lineId++, itemId, count: 1, fromKitId: item.kitId, returns: [] });
      }
      for (const bulk of input.bulk.filter((b) => b.count > 0)) {
        const kit = this.findKit(state, bulk.kitId);
        const line = kit.bulk.find((b) => b.partTypeId === bulk.partTypeId);
        if (!line || line.present < bulk.count) {
          throw new CostumeRuleError(`V kompletu ${kit.label} není dost kusů: ${partTypeName(state, bulk.partTypeId)}.`);
        }
        line.present -= bulk.count;
        lines.push({ id: lineId++, partTypeId: bulk.partTypeId, count: bulk.count, fromKitId: kit.id, returns: [] });
      }
      const loan: Loan = {
        id: nextId(state.loans),
        borrower: input.borrower,
        kitId: input.kitId,
        issuedAt: input.issuedAt,
        dueAt: input.longTerm ? undefined : input.dueAt || undefined,
        longTerm: input.longTerm,
        note: clean(input.note),
        issuedByUserId: this.actorId(),
        lines,
      };
      state.loans.push(loan);
      return loan;
    });
  }

  // Vrácení (i částečné). Každý řádek má vlastní historickou poznámku a připravenost.
  returnLoan(loanId: number, returns: ReturnLineInput[], at = this.now()): Observable<Loan> {
    return this.mutate((state) => {
      const loan = this.findLoan(state, loanId);
      for (const input of returns.filter((r) => r.count > 0)) {
        const line = loan.lines.find((l) => l.id === input.lineId);
        if (!line) throw new CostumeRuleError('Řádek zápůjčky nebyl nalezen.');
        if (input.count > lineRemaining(line)) throw new CostumeRuleError('Vrací se víc kusů, než je zapůjčeno.');
        line.returns.push({ at, count: input.count, note: clean(input.note), ready: input.ready, byUserId: this.actorId() });
        if (line.itemId !== undefined) {
          this.findItem(state, line.itemId).ready = input.ready;
        } else if (line.fromKitId !== undefined) {
          const bulk = state.kits.find((k) => k.id === line.fromKitId)?.bulk.find((b) => b.partTypeId === line.partTypeId);
          if (bulk) bulk.present += input.count;
        }
      }
      return loan;
    });
  }

  // Jiné oficiální vypořádání řádku (ztráta, odkoupení…) – zbylé kusy se přestanou evidovat u vypůjčitele
  settleLine(loanId: number, lineId: number, note: string): Observable<Loan> {
    return this.mutate((state) => {
      const loan = this.findLoan(state, loanId);
      const line = loan.lines.find((l) => l.id === lineId);
      if (!line) throw new CostumeRuleError('Řádek zápůjčky nebyl nalezen.');
      if (!note.trim()) throw new CostumeRuleError('Popište, jak bylo vypořádáno.');
      if (lineRemaining(line) === 0) throw new CostumeRuleError('Řádek je už vrácený nebo vypořádaný.');
      line.settled = { at: this.now(), byUserId: this.actorId(), note: note.trim() };
      return loan;
    });
  }

  // --- Inventura ---

  startInventory(name: string, seriesId?: number): Observable<Inventory> {
    return this.mutate((state) => {
      const inventory: Inventory = {
        id: nextId(state.inventories),
        name: name.trim() || `Inventura ${new Date().toLocaleDateString('cs-CZ')}`,
        seriesId,
        startedAt: this.now(),
        startedByUserId: this.actorId(),
        lines: buildInventoryLines(state, seriesId),
      };
      state.inventories.push(inventory);
      return inventory;
    });
  }

  // result undefined = vrátit řádek mezi nezkontrolované
  recordInventoryCheck(
    inventoryId: number,
    key: string,
    check: { result?: InventoryResult; foundCount?: number; note?: string },
  ): Observable<Inventory> {
    return this.mutate((state) => {
      const inventory = this.findInventory(state, inventoryId);
      if (inventory.closedAt) throw new CostumeRuleError('Uzavřenou inventuru nelze měnit.');
      const line = inventory.lines.find((l) => l.key === key);
      if (!line) throw new CostumeRuleError('Položka inventury nebyla nalezena.');
      Object.assign(line, {
        result: check.result,
        foundCount: check.result ? check.foundCount : undefined,
        note: clean(check.note),
        checkedAt: check.result ? this.now() : undefined,
        checkedByUserId: check.result ? this.actorId() : undefined,
      });
      return inventory;
    });
  }

  closeInventory(inventoryId: number): Observable<Inventory> {
    return this.mutate((state) => {
      const inventory = this.findInventory(state, inventoryId);
      if (inventory.closedAt) throw new CostumeRuleError('Inventura už je uzavřená.');
      inventory.closedAt = this.now();
      return inventory;
    });
  }

  // --- interní ---

  protected now(): string {
    return new Date().toISOString();
  }

  private actorId(): number {
    return this.access.memberId() ?? 0;
  }

  // Změny se provádějí na hluboké kopii – při chybě zůstane původní stav beze změny
  private mutate<T>(change: (state: CostumeState) => T): Observable<T> {
    if (!this.access.canManageCostumes()) {
      return throwError(() => new AccessDeniedError('Krojovou evidenci mění jen pověřené krojárky.'));
    }
    const draft: CostumeState = structuredClone(this.stateSubject.value);
    try {
      const result = change(draft);
      this.stateSubject.next(draft);
      return of(structuredClone(result)).pipe(delay(MOCK_DELAY));
    } catch (error) {
      return throwError(() => error);
    }
  }

  private log(state: CostumeState, entry: Omit<CostumeLogEntry, 'id' | 'at' | 'byUserId'>): void {
    state.log.push({ ...entry, id: nextId(state.log), at: this.now(), byUserId: this.actorId() });
  }

  private assertNumberFree(state: CostumeState, seriesId: number, number: number | undefined, exceptItemId?: number): void {
    if (number === undefined) return;
    if (!Number.isInteger(number) || number < 1) throw new CostumeRuleError('Evidenční číslo musí být kladné celé číslo.');
    if (isNumberTaken(state, seriesId, number, exceptItemId)) {
      const series = state.series.find((s) => s.id === seriesId)?.name ?? '';
      throw new CostumeRuleError(`Číslo ${number} v řadě „${series}“ už má jiná součást.`);
    }
  }

  private findItem(state: CostumeState, id: number): CostumeItem {
    const item = state.items.find((i) => i.id === id);
    if (!item) throw new CostumeRuleError('Součást nebyla nalezena.');
    return item;
  }

  private findKit(state: CostumeState, id: number): CostumeKit {
    const kit = state.kits.find((k) => k.id === id);
    if (!kit) throw new CostumeRuleError('Komplet nebyl nalezen.');
    return kit;
  }

  private findLoan(state: CostumeState, id: number): Loan {
    const loan = state.loans.find((l) => l.id === id);
    if (!loan) throw new CostumeRuleError('Zápůjčka nebyla nalezena.');
    return loan;
  }

  private findInventory(state: CostumeState, id: number): Inventory {
    const inventory = state.inventories.find((i) => i.id === id);
    if (!inventory) throw new CostumeRuleError('Inventura nebyla nalezena.');
    return inventory;
  }
}
