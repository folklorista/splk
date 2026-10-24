import type { ItemCondition, Page } from './inventory';

/** Inventory scope is evaluated once at start; combinations are intersections (docs/06 chap. 7.1). */
export interface InventoryScope {
  regionId?: number;
  gender?: 'male' | 'female';
  partTypeId?: number;
  variant?: string;
  seriesId?: number;
  groupId?: number;
  affiliationUnitId?: number;
}
export type InventoryMode = 'people' | 'store' | 'kit';
export type InventoryResult = 'presented' | 'not_presented' | 'found' | 'not_found';
export interface CostumeInventory {
  id: number;
  unitId: number;
  name: string;
  scope: InventoryScope;
  status: 'open' | 'closed';
  startedAt: string;
  startedBy: number;
  closedAt: string | null;
  closedBy: number | null;
  closedWithIssues: boolean;
  closeReason: string | null;
  /** Frozen at closure; subsequent movements never recalculate these results. */
  resultSnapshot: Record<string, unknown> | null;
  version: number;
}
export interface InventoryTarget {
  id: number;
  inventoryId: number;
  itemId: number | null;
  kitId: number | null;
  bulkStockId: number | null;
  holderPersonId: number | null;
  holderUnitId: number | null;
  /** Disjoint bulk allocation context; a whole-kit handover never duplicates quantities (D-61). */
  contextKitId: number | null;
  loanLineId: number | null;
  expectedQty: number;
  snapshot: Record<string, unknown>;
  addedExplicitly: boolean;
  note: string | null;
}
export interface InventoryCheck {
  id: number;
  inventoryId: number;
  targetId: number;
  mode: InventoryMode;
  result: InventoryResult;
  condition: ItemCondition | null;
  checkedQty: number | null;
  note: string | null;
  by: number;
  at: string;
  cancelledAt: string | null;
  cancelledBy: number | null;
}
export interface InventorySlot {
  id: number;
  inventoryId: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
}
export interface InventoryVisit {
  id: number;
  inventoryId: number;
  personId: number;
  slotId: number | null;
  status: 'booked' | 'in_progress' | 'completed' | 'cancelled';
  completedAt: string | null;
}
export interface InventoryCreate { name: string; scope: InventoryScope }
export interface InventoryClose { version: number; closedWithIssues: boolean; reason?: string }
export type InventoryTargetAdd = { version: number; note: string } & (
  | { itemId: number; kitId?: never; bulkStockId?: never }
  | { kitId: number; itemId?: never; bulkStockId?: never }
  | { bulkStockId: number; itemId?: never; kitId?: never }
);
export type InventorySlotInput = Pick<InventorySlot, 'startsAt' | 'endsAt' | 'capacity'> & { version: number };
export type InventoryVisitInput = Pick<InventoryVisit, 'personId'> & Partial<Pick<InventoryVisit, 'slotId' | 'status'>> & { version: number };
export type InventoryTargetPage = Page<InventoryTarget>;

export interface InventoryIssue {
  targetId: number;
  kind: 'unverified' | 'not_presented' | 'not_found' | 'quantity_mismatch' | 'bulk_not_counted' | 'damaged' | 'needs_adjustment' | 'open_work_order';
  checkId?: number;
  workOrderId?: number;
  expectedQty?: number;
  verifiedQty?: number;
  checkedQty?: number | null;
  note?: string | null;
}
export interface InventoryProgress {
  allTargetCount: number;
  /** Numbered items and kit containers; bulk stocks are reported separately (D-64). */
  targetCount: number;
  verifiedTargetCount: number;
  /** Numbered physical components only; the kit container never doubles its contents. */
  expectedQuantity: number;
  verifiedQuantity: number;
  kitCount: number;
  verifiedKitCount: number;
  bulkTargetCount: number;
  comparedBulkTargetCount: number;
  peopleCount: number;
  visitedPeopleCount: number;
  openIssueCount: number;
  canCloseCleanly: boolean;
  issues: InventoryIssue[];
}
export interface InventoryDetail extends CostumeInventory { progress: InventoryProgress }
export interface InventoryPreview { scope: InventoryScope; progress: InventoryProgress; unloanedItemCount: number }
