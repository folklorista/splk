import type { BulkStock, ItemCondition, ItemLocation, PageQuery } from './inventory';

/** Handovers are facts, independently of intended kit membership (API v1 chap. 4.5). */
export type LoanHolder = { personId: number; unitId?: never } | { unitId: number; personId?: never };
export type LoanCloseType = 'returned' | 'exchanged' | 'settled';
export interface LoanLine {
  id: number;
  itemId: number | null;
  bulkStockId: number | null;
  qty: number;
  returnedQty: number;
  closedAt: string | null;
  closedBy: number | null;
  closeType: LoanCloseType | null;
  closeNote: string | null;
}
export interface LoanReturn {
  lostQty: number;
  id: number;
  lineId: number;
  qty: number;
  closeType: LoanCloseType;
  note: string | null;
  at: string;
  by: number;
}
export interface CostumeLoan {
  id: number;
  unitId: number;
  holder: LoanHolder;
  kitId: number | null;
  issuedAt: string;
  issuedBy: number;
  /** ISO 8601 timestamp; null means long-term. */
  dueAt: string | null;
  note: string | null;
  replacesLoanId: number | null;
  lines: LoanLine[];
  returns: LoanReturn[];
}
export type LoanCreate = {
  holder: LoanHolder;
  dueAt?: string | null;
  note?: string | null;
} & (
  | { items?: number[]; bulk?: { stockId: number; qty: number }[]; kitId?: never }
  | { kitId: number; omitItemIds?: number[]; items?: never; bulk?: never }
);
export interface LoanIssueResult extends CostumeLoan {
  omittedItemIds: number[];
}
export interface LoanReturnInput {
  lines: {
    lineId: number;
    /** Quantity physically handed back now. settled writes off the remaining loss and requires a note. */
    returnedQty: number;
    closeType: LoanCloseType;
    note?: string | null;
    condition?: ItemCondition;
    issuable?: boolean;
    location?: ItemLocation;
  }[];
}
export interface LoanExchangeInput {
  lineId: number;
  itemId: number;
  note?: string | null;
  condition?: ItemCondition;
  issuable?: boolean;
  location?: ItemLocation;
}
export type LoanPatch = Partial<Pick<CostumeLoan, 'dueAt' | 'note'>>;
export interface LoanQuery extends PageQuery {
  open?: boolean;
  overdue?: boolean;
  holderType?: 'external';
  person?: number;
}
export interface MovementQuery extends PageQuery {
  person?: number;
  item?: number;
  kit?: number;
  from?: string;
  to?: string;
}
export interface LoanMovement {
  lostQty: number;
  id: number;
  loanId: number;
  lineId: number;
  type: 'issued' | LoanCloseType;
  at: string;
  by: number;
  itemId: number | null;
  bulkStockId: number | null;
  qty: number;
  holder: LoanHolder;
  kitId: number | null;
  note: string | null;
}

/** Stock response enriched with actual handovers; overlap is counted once (D-61). */
export interface LoanAwareBulkStock extends BulkStock {
  quantityReserved: number;
  quantityAvailable: number;
}
