import {
  Borrower,
  CostumeEvent,
  CostumeItem,
  CostumeLoan,
  CostumeState,
  ItemCondition,
  LoanEndReason,
} from '../models/costume.model';
import { CheckMode, Inventory, InventoryCheck } from '../models/inventory.model';
import { CONDITION_LABELS } from '../models/costume.model';
import { isInTarget } from './inventory-logic';
import { issueBlocker, itemLabel } from './costume-logic';

// Doménové operace nad (pracovní kopií) stavu. Používá je běžná práce krojárny i inventura –
// výdej, vrácení a výměna mají jedinou implementaci. Porušení pravidel = CostumeRuleError.

export class CostumeRuleError extends Error {}

export interface OpContext {
  now: string;
  actorId: number;
  ensembleId: number;
}

export const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1;
export const clean = (text: string | undefined) => text?.trim() || undefined;

export function findItem(state: CostumeState, id: number): CostumeItem {
  const item = state.items.find((i) => i.id === id);
  if (!item) throw new CostumeRuleError('Součástka nebyla nalezena.');
  return item;
}

export function findLoan(state: CostumeState, id: number): CostumeLoan {
  const loan = state.loans.find((l) => l.id === id);
  if (!loan) throw new CostumeRuleError('Zápůjčka nebyla nalezena.');
  return loan;
}

export function findOpenInventory(state: CostumeState, id: number): Inventory {
  const inventory = state.inventories.find((i) => i.id === id);
  if (!inventory) throw new CostumeRuleError('Inventura nebyla nalezena.');
  if (inventory.closure) throw new CostumeRuleError('Inventura je uzavřená.');
  return inventory;
}

export function addEvent(state: CostumeState, ctx: OpContext, event: Omit<CostumeEvent, 'id' | 'at' | 'byMemberId'>): CostumeEvent {
  const entry: CostumeEvent = { ...event, note: clean(event.note), id: nextId(state.events), at: ctx.now, byMemberId: ctx.actorId };
  state.events.push(entry);
  return entry;
}

export interface IssueOp {
  itemId: number;
  borrower: Borrower;
  dueAt?: string;
  note?: string;
  replacesLoanId?: number;
  inventoryId?: number;
  visitId?: number;
}

// Vydání konkrétního kusu. Jeden kus nikdy nesmí být zapůjčen dvěma lidem.
export function issueItem(state: CostumeState, ctx: OpContext, op: IssueOp): CostumeLoan {
  const item = findItem(state, op.itemId);
  const blocker = issueBlocker(state, item);
  if (blocker) throw new CostumeRuleError(`${itemLabel(state, item)} ${blocker}.`);
  const loan: CostumeLoan = {
    id: nextId(state.loans),
    ensembleId: ctx.ensembleId,
    itemId: item.id,
    borrower: op.borrower,
    issuedAt: ctx.now,
    issuedByMemberId: ctx.actorId,
    dueAt: op.dueAt || undefined,
    note: clean(op.note),
    replacesLoanId: op.replacesLoanId,
    inventoryId: op.inventoryId,
    visitId: op.visitId,
  };
  state.loans.push(loan);
  item.location = 'holder';
  item.locationNote = undefined;
  addEvent(state, ctx, {
    kind: 'issued',
    itemId: item.id,
    loanId: loan.id,
    inventoryId: op.inventoryId,
    visitId: op.visitId,
    text: op.replacesLoanId ? 'Vydáno jako náhrada při výměně' : 'Vydáno',
    note: op.note,
  });
  return loan;
}

export interface ReturnOp {
  note?: string;
  condition?: ItemCondition;
  issuable?: boolean;
  reason?: LoanEndReason;
  inventoryId?: number;
  visitId?: number;
}

// Vrácení kusu do skladu. Předchozí držení zůstává v historii zápůjčky.
export function returnLoan(state: CostumeState, ctx: OpContext, loanId: number, op: ReturnOp = {}): CostumeLoan {
  const loan = findLoan(state, loanId);
  if (loan.endedAt) throw new CostumeRuleError('Zápůjčka je už ukončená.');
  const item = findItem(state, loan.itemId);
  Object.assign(loan, { endedAt: ctx.now, endedByMemberId: ctx.actorId, endReason: op.reason ?? 'returned', endNote: clean(op.note) });
  item.location = 'store';
  item.locationNote = undefined;
  if (op.condition) item.condition = op.condition;
  if (op.issuable !== undefined) item.issuable = op.issuable;
  addEvent(state, ctx, {
    kind: op.reason === 'exchanged' ? 'exchanged' : 'returned',
    itemId: item.id,
    loanId: loan.id,
    inventoryId: op.inventoryId,
    visitId: op.visitId,
    text: op.reason === 'exchanged' ? 'Vráceno při výměně' : 'Vráceno do skladu',
    note: op.note,
  });
  return loan;
}

export interface ExchangeOp {
  loanId: number;
  // Původní kus byl skutečně předložen a vrácen
  originalReturned: boolean;
  newItemId: number;
  note?: string;
  inventoryId?: number;
  visitId?: number;
}

// Výměna = (vrácení původního kusu, jen pokud byl opravdu předložen) + vydání existujícího dostupného kusu.
// Nepředložený původní kus se neoznačí jako vrácený ani ověřený – zůstává u držitele otevřený.
export function exchangeItem(state: CostumeState, ctx: OpContext, op: ExchangeOp): { returned?: CostumeLoan; issued: CostumeLoan } {
  const original = findLoan(state, op.loanId);
  if (original.endedAt) throw new CostumeRuleError('Původní zápůjčka je už ukončená.');
  if (original.itemId === op.newItemId) throw new CostumeRuleError('Vyberte jiný kus, než který se vyměňuje.');
  const context = { inventoryId: op.inventoryId, visitId: op.visitId };
  const returned = op.originalReturned ? returnLoan(state, ctx, original.id, { reason: 'exchanged', note: op.note, ...context }) : undefined;
  const issued = issueItem(state, ctx, { itemId: op.newItemId, borrower: original.borrower, dueAt: original.dueAt, note: op.note, replacesLoanId: original.id, ...context });
  if (!returned) {
    addEvent(state, ctx, {
      kind: 'exchanged',
      itemId: original.itemId,
      loanId: original.id,
      ...context,
      text: 'Výměna bez vrácení – původní kus nepředložen, zůstává u držitele',
      note: op.note,
    });
  }
  return { returned, issued };
}

export interface CheckOp {
  inventoryId: number;
  itemId: number;
  presented: boolean;
  condition?: ItemCondition;
  note?: string;
  mode: CheckMode;
  visitId?: number;
}

// Kontrola kusu v inventuře. Kus mimo rozsah se nikdy nepřidá potichu.
export function recordCheck(state: CostumeState, ctx: OpContext, op: CheckOp): InventoryCheck {
  const inventory = findOpenInventory(state, op.inventoryId);
  const item = findItem(state, op.itemId);
  if (!isInTarget(inventory, item.id)) {
    throw new CostumeRuleError(`${itemLabel(state, item)} nepatří do rozsahu inventury – přidejte ho výslovně.`);
  }
  if (!op.presented && op.condition) throw new CostumeRuleError('Stav lze posoudit jen u předloženého kusu.');
  const check: InventoryCheck = {
    id: nextId(state.inventoryChecks),
    inventoryId: inventory.id,
    itemId: item.id,
    at: ctx.now,
    byMemberId: ctx.actorId,
    mode: op.mode,
    presented: op.presented,
    condition: op.presented ? op.condition : undefined,
    note: clean(op.note),
    visitId: op.visitId,
  };
  state.inventoryChecks.push(check);
  if (op.presented && op.condition && op.condition !== item.condition) {
    addEvent(state, ctx, {
      kind: 'condition',
      itemId: item.id,
      inventoryId: inventory.id,
      visitId: op.visitId,
      text: `Stav: ${CONDITION_LABELS[item.condition]} → ${CONDITION_LABELS[op.condition]}`,
      note: op.note,
    });
    item.condition = op.condition;
  }
  return check;
}

