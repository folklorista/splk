import { Group } from '../../../core/models/group.model';
import { Member } from '../../../core/models/member.model';
import { Borrower, CostumeEvent, CostumeItem, CostumeLoan, CostumeSeries, CostumeState, CostumeWorkOrder } from '../models/costume.model';
import { Inventory, InventoryCheck, InventoryScope, InventorySlot, InventoryVisit } from '../models/inventory.model';
import {
  borrowerKey,
  findSeries,
  genderLabel,
  holdingsOf,
  isWorkOrderOpen,
  itemClassification,
  openLoanFor,
  openLoans,
  partTypeName,
  regionLabel,
  sameBorrower,
  seriesLabel,
  variantLabel,
} from './costume-logic';

// Inventura – čisté funkce nad stavem: rozsah, snapshot, pokrytí, rychlé zadání čísel, rekapitulace.

// --- Rozsah ---

export function matchesClassification(state: CostumeState, item: CostumeItem, scope: InventoryScope): boolean {
  const cls = itemClassification(state, item);
  const ok = <T>(values: T[], value: T | undefined) => values.length === 0 || (value !== undefined && values.includes(value));
  return (
    ok(scope.genderIds, cls.genderId) &&
    ok(scope.regionIds, cls.regionId) &&
    ok(scope.partTypeIds, cls.partTypeId) &&
    ok(scope.variantIds, cls.variantId)
  );
}

export interface ScopeResolution {
  itemIds: number[];
  holders: Borrower[];
  loanedCount: number;
  unloanedCount: number;
}

// Kusy v rozsahu. Bez skupin: zapůjčené i nezapůjčené (sklad, oprava…). Se skupinami: jen kusy
// zapůjčené členům těchto skupin. Člen ve více skupinách ani kus se nezapočítají dvakrát.
export function resolveScope(state: CostumeState, scope: InventoryScope, members: Member[]): ScopeResolution {
  const groupMemberIds = new Set(
    members.filter((m) => m.groupIds.some((g) => scope.groupIds.includes(g))).map((m) => m.id),
  );
  const itemIds: number[] = [];
  const holders = new Map<string, Borrower>();
  let loanedCount = 0;
  for (const item of state.items) {
    if (item.retired || !matchesClassification(state, item, scope)) continue;
    const loan = openLoanFor(state, item.id);
    if (scope.groupIds.length) {
      if (!loan || loan.borrower.kind !== 'member' || !groupMemberIds.has(loan.borrower.memberId)) continue;
    }
    itemIds.push(item.id);
    if (loan) {
      loanedCount++;
      holders.set(borrowerKey(loan.borrower), loan.borrower);
    }
  }
  return { itemIds, holders: [...holders.values()], loanedCount, unloanedCount: itemIds.length - loanedCount };
}

export function scopeLabel(state: CostumeState, scope: InventoryScope, groups: Group[]): string {
  const parts = [
    scope.genderIds.map((id) => genderLabel(state, id)).join(' + '),
    scope.regionIds.map((id) => regionLabel(state, id)).join(' + '),
    scope.partTypeIds.map((id) => partTypeName(state, id)).join(' + '),
    scope.variantIds.map((id) => variantLabel(state, id)).join(' + '),
  ].filter(Boolean);
  const fund = parts.length ? parts.join(' / ') : 'Celý fond';
  if (!scope.groupIds.length) return fund;
  const groupNames = scope.groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? `#${id}`).join(' + ');
  return `${fund} · zapůjčeno skupině ${groupNames}`;
}

export function targetItemIds(inventory: Inventory): number[] {
  return [...new Set([...inventory.targetItemIds, ...inventory.additions.map((a) => a.itemId)])];
}

export function isInTarget(inventory: Inventory, itemId: number): boolean {
  return inventory.targetItemIds.includes(itemId) || inventory.additions.some((a) => a.itemId === itemId);
}

// --- Kontroly a stav ověření ---

export function activeChecks(state: CostumeState, inventoryId: number): InventoryCheck[] {
  return state.inventoryChecks.filter((c) => c.inventoryId === inventoryId && !c.revokedAt);
}

export type ItemCheckState = 'unchecked' | 'verified' | 'not-presented';

export interface ItemInventoryState {
  state: ItemCheckState;
  // Poslední platná kontrola (pro zobrazení stavu a poznámky)
  latest?: InventoryCheck;
  // Kus byl v této inventuře fyzicky viděn – rozhoduje pro pokrytí
  verified: boolean;
}

// Jeden kus má v inventuře právě jeden výsledný stav. Fyzicky viděný kus zůstává ověřený,
// i když se později zapíše nepředložení (to se pak bere jako omyl ke zrušení, ne jako ztráta ověření).
export function itemInventoryState(checks: InventoryCheck[], itemId: number): ItemInventoryState {
  const forItem = checks.filter((c) => c.itemId === itemId).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  const latest = forItem[forItem.length - 1];
  const verified = forItem.some((c) => c.presented);
  return { state: verified ? 'verified' : latest ? 'not-presented' : 'unchecked', latest: verified ? forItem.filter((c) => c.presented).pop() : latest, verified };
}

// --- Lidé a návštěvy ---

// Dotčení držitelé: snapshot při zahájení + aktuální držitelé cílových kusů (např. po výměně)
export function affectedBorrowers(state: CostumeState, inventory: Inventory): Borrower[] {
  const result = new Map<string, Borrower>();
  for (const b of inventory.holders) result.set(borrowerKey(b), b);
  for (const itemId of targetItemIds(inventory)) {
    const loan = openLoanFor(state, itemId);
    if (loan) result.set(borrowerKey(loan.borrower), loan.borrower);
  }
  return [...result.values()];
}

// Na termín se smí přihlásit jen dotčený člen (drží nebo při zahájení držel cílový kus)
export function isEligibleForBooking(state: CostumeState, inventory: Inventory, memberId: number): boolean {
  return affectedBorrowers(state, inventory).some((b) => b.kind === 'member' && b.memberId === memberId);
}

export function visitsOf(state: CostumeState, inventoryId: number, borrower?: Borrower): InventoryVisit[] {
  return state.inventoryVisits
    .filter((v) => v.inventoryId === inventoryId && (!borrower || sameBorrower(v.borrower, borrower)))
    .sort((a, b) => a.bookedAt.localeCompare(b.bookedAt) || a.id - b.id);
}

// Aktuální návštěva osoby (poslední nezrušená)
export function currentVisit(state: CostumeState, inventoryId: number, borrower: Borrower): InventoryVisit | undefined {
  return visitsOf(state, inventoryId, borrower).filter((v) => v.status !== 'cancelled').pop();
}

export function slotBookings(state: CostumeState, slotId: number): InventoryVisit[] {
  return state.inventoryVisits.filter((v) => v.slotId === slotId && v.status !== 'cancelled');
}

export function slotFree(state: CostumeState, slot: InventorySlot): number {
  return Math.max(0, slot.capacity - slotBookings(state, slot.id).length);
}

export function inventorySlots(state: CostumeState, inventoryId: number): InventorySlot[] {
  return state.inventorySlots.filter((s) => s.inventoryId === inventoryId).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Cílové kusy, které má osoba podle aktuální evidence u sebe
export function targetHoldings(state: CostumeState, inventory: Inventory, borrower: Borrower) {
  return holdingsOf(state, borrower).filter((h) => isInTarget(inventory, h.item.id));
}

// Cílové kusy, které osoba během inventury vrátila nebo vyměnila (zůstávají ve výpisu návštěvy)
export function targetLoansEndedDuringInventory(state: CostumeState, inventory: Inventory, borrower: Borrower): CostumeLoan[] {
  return state.loans.filter(
    (l) => sameBorrower(l.borrower, borrower) && l.endedAt && l.endedAt >= inventory.startedAt && isInTarget(inventory, l.itemId),
  );
}

export type PersonInventoryStatus = 'not-booked' | 'booked' | 'in-progress' | 'completed';

export interface PersonInventoryRow {
  borrower: Borrower;
  key: string;
  status: PersonInventoryStatus;
  visit?: InventoryVisit;
  slot?: InventorySlot;
  held: number;
  verified: number;
  notPresented: number;
  unchecked: number;
}

export function personRows(state: CostumeState, inventory: Inventory): PersonInventoryRow[] {
  const checks = activeChecks(state, inventory.id);
  return affectedBorrowers(state, inventory).map((borrower) => {
    const visit = currentVisit(state, inventory.id, borrower);
    const held = targetHoldings(state, inventory, borrower).map((h) => itemInventoryState(checks, h.item.id));
    return {
      borrower,
      key: borrowerKey(borrower),
      status: !visit ? 'not-booked' : visit.status === 'cancelled' ? 'not-booked' : visit.status,
      visit,
      slot: state.inventorySlots.find((s) => s.id === visit?.slotId),
      held: held.length,
      verified: held.filter((s) => s.verified).length,
      notPresented: held.filter((s) => s.state === 'not-presented').length,
      unchecked: held.filter((s) => s.state === 'unchecked').length,
    };
  });
}

// --- Sklad po řadách ---

export interface StockSeriesGroup {
  series: CostumeSeries;
  label: string;
  items: { item: CostumeItem; check: ItemInventoryState }[];
  verified: number;
}

// Nezapůjčené cílové kusy podle evidenčních řad. Kus vrácený během inventury se tu objeví,
// nově vydaný zmizí – kontroly jsou společné oběma režimům.
export function stockGroups(state: CostumeState, inventory: Inventory): StockSeriesGroup[] {
  const checks = activeChecks(state, inventory.id);
  const groups = new Map<number, StockSeriesGroup>();
  for (const itemId of targetItemIds(inventory)) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.retired || openLoanFor(state, item.id)) continue;
    const series = findSeries(state, item.seriesId);
    if (!series) continue;
    if (!groups.has(series.id)) groups.set(series.id, { series, label: seriesLabel(state, series), items: [], verified: 0 });
    const group = groups.get(series.id)!;
    const check = itemInventoryState(checks, item.id);
    group.items.push({ item, check });
    if (check.verified) group.verified++;
  }
  for (const group of groups.values()) group.items.sort((a, b) => (a.item.number ?? 1e9) - (b.item.number ?? 1e9));
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'cs'));
}

// --- Rychlé zadání čísel ---

export const MAX_BATCH_NUMBERS = 200;

export interface ParsedNumbers {
  numbers: number[];
  errors: string[];
}

// „1, 3, 7, 12-15“ (oddělovače čárka, středník, mezera; rozsahy pomlčkou nebo pomlčkou s mezerami)
export function parseNumberInput(text: string): ParsedNumbers {
  const numbers: number[] = [];
  const errors: string[] = [];
  const normalized = text.replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-');
  for (const token of normalized.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(token);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > to) {
        errors.push(`Rozsah „${token}“ je obráceně.`);
        continue;
      }
      if (to - from + 1 + numbers.length > MAX_BATCH_NUMBERS) {
        errors.push(`Rozsah „${token}“ je příliš velký (najednou nejvýš ${MAX_BATCH_NUMBERS} čísel).`);
        continue;
      }
      for (let n = from; n <= to; n++) numbers.push(n);
    } else if (/^\d+$/.test(token)) {
      numbers.push(Number(token));
    } else {
      errors.push(`„${token}“ není číslo.`);
    }
  }
  return { numbers, errors };
}

export type QuickEntryOutcome = 'verified' | 'duplicate' | 'repeated' | 'unknown' | 'retired' | 'out-of-scope' | 'on-loan' | 'away';

export interface QuickEntryResult {
  number: number;
  outcome: QuickEntryOutcome;
  itemId?: number;
  message: string;
}

// Vyhodnocení zadaných čísel v jedné řadě. Nic se nepotvrzuje potichu: potvrdí se jen kus,
// který existuje, patří do inventury, není zapůjčený, je podle evidence ve skladu a ještě nebyl ověřen.
export function classifyQuickEntry(state: CostumeState, inventory: Inventory, seriesId: number, numbers: number[]): QuickEntryResult[] {
  const checks = activeChecks(state, inventory.id);
  const seen = new Set<number>();
  return numbers.map((number): QuickEntryResult => {
    if (seen.has(number)) return { number, outcome: 'repeated', message: 'zadáno v dávce vícekrát' };
    seen.add(number);
    const candidates = state.items.filter((i) => i.seriesId === seriesId && i.number === number);
    const item = candidates.find((i) => !i.retired);
    if (!item) {
      return candidates.length
        ? { number, outcome: 'retired', itemId: candidates[0].id, message: 'kus s tímto číslem je vyřazený' }
        : { number, outcome: 'unknown', message: 'v řadě neexistuje' };
    }
    if (!isInTarget(inventory, item.id)) return { number, outcome: 'out-of-scope', itemId: item.id, message: 'nepatří do rozsahu inventury' };
    if (itemInventoryState(checks, item.id).verified) return { number, outcome: 'duplicate', itemId: item.id, message: 'už ověřeno' };
    if (openLoanFor(state, item.id)) return { number, outcome: 'on-loan', itemId: item.id, message: 'podle evidence je zapůjčený – kontroluje se u držitele' };
    if (item.location !== 'store') return { number, outcome: 'away', itemId: item.id, message: 'podle evidence není ve skladu – potvrďte ručně' };
    return { number, outcome: 'verified', itemId: item.id, message: 'ověřeno' };
  });
}

// --- Pokrytí, nesrovnalosti, rekapitulace ---

export interface InventoryProgress {
  // Průběh návštěv
  people: number;
  booked: number;
  completed: number;
  notBooked: number;
  // Pokrytí unikátních fyzických kusů
  total: number;
  verified: number;
  // Otevřené nesrovnalosti a práce
  notPresented: number;
  unchecked: number;
  damaged: number;
  needsAlteration: number;
  openWorkOrders: number;
}

export function inventoryProgress(state: CostumeState, inventory: Inventory): InventoryProgress {
  const checks = activeChecks(state, inventory.id);
  const targets = targetItemIds(inventory);
  const states = targets.map((id) => itemInventoryState(checks, id));
  const people = personRows(state, inventory);
  const checkedConditions = states.filter((s) => s.verified).map((s) => s.latest?.condition);
  return {
    people: people.length,
    booked: people.filter((p) => p.status === 'booked' || p.status === 'in-progress').length,
    completed: people.filter((p) => p.status === 'completed').length,
    notBooked: people.filter((p) => p.status === 'not-booked').length,
    total: targets.length,
    verified: states.filter((s) => s.verified).length,
    notPresented: states.filter((s) => s.state === 'not-presented').length,
    unchecked: states.filter((s) => s.state === 'unchecked').length,
    damaged: checkedConditions.filter((c) => c === 'damaged').length,
    needsAlteration: checkedConditions.filter((c) => c === 'needs-alteration').length,
    openWorkOrders: state.workOrders.filter((o) => targets.includes(o.itemId) && isWorkOrderOpen(o)).length,
  };
}

// Bez problémů lze uzavřít jen tehdy, když byly všechny cílové kusy skutečně fyzicky ověřeny
export function canCloseCleanly(progress: InventoryProgress): boolean {
  return progress.total > 0 && progress.verified === progress.total;
}

export interface VisitRecap {
  verified: CostumeItem[];
  damaged: CostumeItem[];
  needsAlteration: CostumeItem[];
  notPresented: CostumeItem[];
  unchecked: CostumeItem[];
  movements: CostumeEvent[];
  workOrders: CostumeWorkOrder[];
}

// Rekapitulace návštěvy: kusy osoby v rozsahu (i vrácené/vyměněné během inventury) a pohyby
export function visitRecap(state: CostumeState, inventory: Inventory, borrower: Borrower, visitId?: number): VisitRecap {
  const checks = activeChecks(state, inventory.id);
  const itemIds = new Set([
    ...targetHoldings(state, inventory, borrower).map((h) => h.item.id),
    ...targetLoansEndedDuringInventory(state, inventory, borrower).map((l) => l.itemId),
  ]);
  const items = [...itemIds].map((id) => state.items.find((i) => i.id === id)!).filter(Boolean);
  const stateOf = (item: CostumeItem) => itemInventoryState(checks, item.id);
  return {
    verified: items.filter((i) => stateOf(i).verified),
    damaged: items.filter((i) => stateOf(i).verified && stateOf(i).latest?.condition === 'damaged'),
    needsAlteration: items.filter((i) => stateOf(i).verified && stateOf(i).latest?.condition === 'needs-alteration'),
    notPresented: items.filter((i) => stateOf(i).state === 'not-presented'),
    unchecked: items.filter((i) => stateOf(i).state === 'unchecked'),
    movements: visitId === undefined ? [] : state.events.filter((e) => e.visitId === visitId),
    workOrders: state.workOrders.filter((o) => isWorkOrderOpen(o) && (itemIds.has(o.itemId) || state.events.some((e) => e.visitId === visitId && e.itemId === o.itemId))),
  };
}

// Inventury, kterých se člen týká (otevřené a je mezi dotčenými)
export function invitationsFor(state: CostumeState, memberId: number): Inventory[] {
  return state.inventories.filter((inv) => !inv.closure && isEligibleForBooking(state, inv, memberId));
}

// Pro výběr náhradního kusu: dostupné kusy, nejdřív ze stejné řady, pak stejného druhu
export function exchangeCandidates(state: CostumeState, original: CostumeItem): CostumeItem[] {
  const origSeries = findSeries(state, original.seriesId);
  const loaned = new Set(openLoans(state).map((l) => l.itemId));
  const candidates = state.items.filter(
    (i) => i.id !== original.id && !i.retired && !loaned.has(i.id) && i.location === 'store' && i.issuable,
  );
  const rank = (i: CostumeItem) => {
    const s = findSeries(state, i.seriesId);
    if (s?.id === origSeries?.id) return 0;
    if (s?.partTypeId === origSeries?.partTypeId && s?.genderId === origSeries?.genderId) return 1;
    return 2;
  };
  return candidates
    .filter((i) => rank(i) < 2)
    .sort((a, b) => rank(a) - rank(b) || (a.number ?? 1e9) - (b.number ?? 1e9));
}
