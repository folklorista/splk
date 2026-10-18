import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Borrower, CostumeState } from './models/costume.model';
import { Inventory, InventoryCheck, InventoryScope, InventorySlot, InventoryVisit } from './models/inventory.model';
import { CostumeStoreService } from './costume-store.service';
import { CheckOp, CostumeRuleError, addEvent, clean, findItem, findOpenInventory, nextId, recordCheck } from './utils/costume-ops';
import {
  QuickEntryResult,
  canCloseCleanly,
  classifyQuickEntry,
  currentVisit,
  inventoryProgress,
  isEligibleForBooking,
  isInTarget,
  parseNumberInput,
  resolveScope,
  slotFree,
} from './utils/inventory-logic';
import { Member } from '../../core/models/member.model';
import { itemLabel } from './utils/costume-logic';

export interface CreateInventoryInput {
  name: string;
  scope: InventoryScope;
  scopeLabel: string;
  slotCapacity?: number;
}

export interface QuickEntryResponse {
  results: QuickEntryResult[];
  errors: string[];
}

// Inventury krojového fondu (mock implementace): rozsah se snapshotem, termíny návštěv,
// kontrola podle lidí i ve skladu nad společnými kontrolami, uzavření s rekapitulací.
@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private store: CostumeStoreService) {}

  get state$(): Observable<CostumeState> {
    return this.store.state$;
  }

  // Zahájení: rozsah se vyhodnotí nad aktuálními daty a zmrazí (kusy + dotčení držitelé)
  createInventory(input: CreateInventoryInput, members: Member[]): Observable<Inventory> {
    return this.store.mutate((state, ctx) => {
      const resolved = resolveScope(state, input.scope, members);
      if (!resolved.itemIds.length) throw new CostumeRuleError('Rozsah inventury je prázdný – upravte filtry.');
      const inventory: Inventory = {
        id: nextId(state.inventories),
        ensembleId: ctx.ensembleId,
        name: input.name.trim() || `Inventura ${new Date(ctx.now).toLocaleDateString('cs-CZ')}`,
        scope: structuredClone(input.scope),
        scopeLabel: input.scopeLabel,
        startedAt: ctx.now,
        startedByMemberId: ctx.actorId,
        targetItemIds: resolved.itemIds,
        holders: resolved.holders,
        additions: [],
        slotCapacity: input.slotCapacity ?? state.defaultSlotCapacity,
      };
      state.inventories.push(inventory);
      return inventory;
    });
  }

  // Výslovné pozdější přidání kusu do rozsahu – vždy s auditní poznámkou
  addItem(inventoryId: number, itemId: number, note: string): Observable<Inventory> {
    return this.store.mutate((state, ctx) => {
      const inventory = findOpenInventory(state, inventoryId);
      const item = findItem(state, itemId);
      if (item.retired) throw new CostumeRuleError('Vyřazený kus nelze přidat do inventury.');
      if (isInTarget(inventory, itemId)) throw new CostumeRuleError('Kus už do inventury patří.');
      if (!note.trim()) throw new CostumeRuleError('Uveďte, proč se kus do rozsahu přidává.');
      inventory.additions.push({ itemId, at: ctx.now, byMemberId: ctx.actorId, note: note.trim() });
      addEvent(state, ctx, { kind: 'inventory-added', itemId, inventoryId, text: `Přidáno do inventury ${inventory.name}`, note });
      return inventory;
    });
  }

  // --- Termíny ---

  addSlot(inventoryId: number, input: { startsAt: string; endsAt?: string; capacity?: number; place?: string }): Observable<InventorySlot> {
    return this.store.mutate((state) => {
      const inventory = findOpenInventory(state, inventoryId);
      const capacity = input.capacity ?? inventory.slotCapacity;
      if (!input.startsAt) throw new CostumeRuleError('Vyplňte začátek termínu.');
      if (!Number.isInteger(capacity) || capacity < 1) throw new CostumeRuleError('Kapacita musí být kladné celé číslo.');
      if (input.endsAt && input.endsAt <= input.startsAt) throw new CostumeRuleError('Konec termínu musí být po začátku.');
      const slot: InventorySlot = { id: nextId(state.inventorySlots), inventoryId, startsAt: input.startsAt, endsAt: input.endsAt || undefined, capacity, place: clean(input.place) };
      state.inventorySlots.push(slot);
      return slot;
    });
  }

  removeSlot(slotId: number): Observable<void> {
    return this.store.mutate((state) => {
      if (state.inventoryVisits.some((v) => v.slotId === slotId && v.status !== 'cancelled')) {
        throw new CostumeRuleError('Na termín jsou přihlášení lidé – nejdřív jim rezervaci zrušte.');
      }
      state.inventorySlots = state.inventorySlots.filter((s) => s.id !== slotId);
    });
  }

  // Rezervace termínu. Člen za sebe (bez pověření), krojařka za kohokoli dotčeného.
  bookSlot(inventoryId: number, slotId: number, borrower?: Borrower): Observable<InventoryVisit> {
    const self = !borrower;
    return this.store.mutate(
      (state, ctx) => {
        const target: Borrower = borrower ?? { kind: 'member', memberId: ctx.actorId };
        const inventory = findOpenInventory(state, inventoryId);
        const slot = state.inventorySlots.find((s) => s.id === slotId && s.inventoryId === inventoryId);
        if (!slot) throw new CostumeRuleError('Termín nebyl nalezen.');
        if (target.kind === 'member' && !isEligibleForBooking(state, inventory, target.memberId)) {
          throw new CostumeRuleError('Tato inventura se vás netýká – nemáte zapůjčený žádný kus z jejího rozsahu.');
        }
        const existing = currentVisit(state, inventoryId, target);
        if (existing?.status === 'in-progress') throw new CostumeRuleError('Návštěva právě probíhá.');
        if (existing?.slotId === slotId && existing.status === 'booked') throw new CostumeRuleError('Na tento termín už jste přihlášeni.');
        if (slotFree(state, slot) < 1) throw new CostumeRuleError('Termín je už plně obsazený – vyberte jiný.');
        // Přeobjednání zruší původní rezervaci; dokončená návštěva zůstává v historii
        if (existing?.status === 'booked') existing.status = 'cancelled';
        const visit: InventoryVisit = { id: nextId(state.inventoryVisits), inventoryId, borrower: target, slotId, status: 'booked', bookedAt: ctx.now, bookedByMemberId: ctx.actorId };
        state.inventoryVisits.push(visit);
        return visit;
      },
      { self },
    );
  }

  cancelBooking(visitId: number): Observable<InventoryVisit> {
    const ownVisit = this.store.snapshot.inventoryVisits.find((v) => v.id === visitId);
    const memberId = this.store.currentMemberId();
    const self = !this.store.canManage() && !!ownVisit && ownVisit.borrower.kind === 'member' && ownVisit.borrower.memberId === memberId;
    return this.store.mutate(
      (state) => {
        const visit = state.inventoryVisits.find((v) => v.id === visitId);
        if (!visit) throw new CostumeRuleError('Rezervace nebyla nalezena.');
        findOpenInventory(state, visit.inventoryId);
        if (visit.status !== 'booked') throw new CostumeRuleError('Zrušit lze jen rezervaci, která ještě neproběhla.');
        visit.status = 'cancelled';
        return visit;
      },
      { self },
    );
  }

  // Otevření návštěvy (na termín i bez něj)
  startVisit(inventoryId: number, borrower: Borrower): Observable<InventoryVisit> {
    return this.store.mutate((state, ctx) => {
      findOpenInventory(state, inventoryId);
      const existing = currentVisit(state, inventoryId, borrower);
      if (existing && (existing.status === 'booked' || existing.status === 'in-progress')) {
        existing.status = 'in-progress';
        return existing;
      }
      const visit: InventoryVisit = { id: nextId(state.inventoryVisits), inventoryId, borrower, status: 'in-progress', bookedAt: ctx.now, bookedByMemberId: ctx.actorId };
      state.inventoryVisits.push(visit);
      return visit;
    });
  }

  // Dokončení návštěvy – i s nevyřešenými položkami (ty zůstávají v inventuře otevřené)
  completeVisit(visitId: number, note?: string): Observable<InventoryVisit> {
    return this.store.mutate((state, ctx) => {
      const visit = state.inventoryVisits.find((v) => v.id === visitId);
      if (!visit) throw new CostumeRuleError('Návštěva nebyla nalezena.');
      findOpenInventory(state, visit.inventoryId);
      if (visit.status === 'completed') throw new CostumeRuleError('Návštěva už je dokončená.');
      if (visit.status === 'cancelled') throw new CostumeRuleError('Návštěva byla zrušena.');
      Object.assign(visit, { status: 'completed', completedAt: ctx.now, completedByMemberId: ctx.actorId, note: clean(note) });
      return visit;
    });
  }

  // --- Kontroly ---

  recordCheck(op: CheckOp): Observable<InventoryCheck> {
    return this.store.mutate((state, ctx) => recordCheck(state, ctx, op));
  }

  // Oprava omylu: kontrola zůstane v historii jako zrušená
  revokeCheck(checkId: number): Observable<InventoryCheck> {
    return this.store.mutate((state, ctx) => {
      const check = state.inventoryChecks.find((c) => c.id === checkId);
      if (!check) throw new CostumeRuleError('Kontrola nebyla nalezena.');
      findOpenInventory(state, check.inventoryId);
      if (check.revokedAt) throw new CostumeRuleError('Kontrola už je zrušená.');
      Object.assign(check, { revokedAt: ctx.now, revokedByMemberId: ctx.actorId });
      return check;
    });
  }

  // Rychlé zadání čísel v řadě: potvrdí se jen bezproblémové kusy, ostatní se vrátí s důvodem
  quickEntry(inventoryId: number, seriesId: number, text: string): Observable<QuickEntryResponse> {
    return this.store.mutate((state, ctx) => {
      const inventory = findOpenInventory(state, inventoryId);
      const parsed = parseNumberInput(text);
      const results = classifyQuickEntry(state, inventory, seriesId, parsed.numbers);
      for (const result of results.filter((r) => r.outcome === 'verified')) {
        recordCheck(state, ctx, { inventoryId, itemId: result.itemId!, presented: true, mode: 'stock' });
      }
      return { results, errors: parsed.errors };
    });
  }

  // Kus, který je podle evidence mimo sklad (oprava, švadlena, neznámé), je fyzicky tady:
  // výslovně se ověří a vrátí do skladu
  confirmFoundInStore(inventoryId: number, itemId: number, note?: string): Observable<InventoryCheck> {
    return this.store.mutate((state, ctx) => {
      const item = findItem(state, itemId);
      if (state.loans.some((l) => l.itemId === itemId && !l.endedAt)) {
        throw new CostumeRuleError(`${itemLabel(state, item)} je zapůjčený – nejdřív zapište vrácení.`);
      }
      const check = recordCheck(state, ctx, { inventoryId, itemId, presented: true, mode: 'stock', note });
      if (item.location !== 'store') {
        addEvent(state, ctx, { kind: 'location', itemId, inventoryId, text: 'Nalezeno při inventuře ve skladu – umístění: Ve skladu', note });
        item.location = 'store';
        item.locationNote = undefined;
      }
      return check;
    });
  }

  // --- Uzavření ---

  // Bez výhrad jen při úplném fyzickém ověření; jinak výslovně s důvodem
  closeInventory(inventoryId: number, input: { acceptDiscrepancies: boolean; reason?: string }): Observable<Inventory> {
    return this.store.mutate((state, ctx) => {
      const inventory = findOpenInventory(state, inventoryId);
      const progress = inventoryProgress(state, inventory);
      const complete = canCloseCleanly(progress);
      if (!complete && !input.acceptDiscrepancies) {
        throw new CostumeRuleError('Inventura má nevyřešené nesrovnalosti – lze ji uzavřít jen výslovně s uvedením důvodu.');
      }
      if (!complete && !input.reason?.trim()) throw new CostumeRuleError('Uveďte důvod uzavření s nesrovnalostmi.');
      inventory.closure = {
        at: ctx.now,
        byMemberId: ctx.actorId,
        withDiscrepancies: !complete,
        reason: clean(input.reason),
        verified: progress.verified,
        total: progress.total,
        notPresented: progress.notPresented,
        unchecked: progress.unchecked,
      };
      // Rezervace, které se neuskutečnily, se zruší
      for (const visit of state.inventoryVisits.filter((v) => v.inventoryId === inventoryId && v.status === 'booked')) visit.status = 'cancelled';
      return inventory;
    });
  }

}

