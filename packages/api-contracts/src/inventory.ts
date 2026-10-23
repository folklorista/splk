/** Physical inventory (API v1 chap. 3.3 and 4.4). No loan or physical-check assertions in step 4. */
export type ItemCondition = 'ok' | 'needs_adjustment' | 'damaged';
export type ItemLocation = 'store' | 'holder' | 'seamstress' | 'repair' | 'unknown';
export type CompositionState = 'unverified' | 'complete' | 'incomplete' | 'pending_check';
export type WorkOrderType = 'adjustment' | 'repair' | 'resewing';
export type WorkOrderStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export interface Page<T> {
  items: T[];
  total: number;
}

export interface PageQuery {
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface ItemInput {
  seriesId: number;
  number: string | null;
  variant?: string | null;
  size?: string | null;
  description?: string | null;
  note?: string | null;
  condition?: ItemCondition;
  issuable?: boolean;
  location?: ItemLocation;
  locationNote?: string | null;
  acquiredOn?: string | null;
}

export interface CostumeItem extends Required<ItemInput> {
  id: number;
  unitId: number;
  /** Intended membership only; presence and physical checks are separate facts. */
  kitId: number | null;
  retiredAt: string | null;
  retiredBy: number | null;
  retireReason: string | null;
  version: number;
}

/** Composition changes go through /kits/{id}/composition. */
export type ItemPatch = Partial<ItemInput> & { version: number };
export interface ItemRetireInput { version: number; reason: string }
export type ItemSort = 'series' | '-series' | 'number' | '-number' | 'acquiredOn' | '-acquiredOn' | 'id' | '-id';

/** Defaults: active items, limit 50 (maximum 200), offset 0, sort by series then textual number. */
export interface ItemQuery extends PageQuery {
  sort?: ItemSort;
  series?: number;
  q?: string;
  condition?: ItemCondition;
  location?: ItemLocation;
  acquiredFrom?: string;
  acquiredTo?: string;
  retired?: boolean;
}

export interface BulkStockInput {
  partTypeId: number;
  variant?: string | null;
  quantityTotal: number;
  note?: string | null;
}
export interface BulkStock extends Required<BulkStockInput> {
  id: number;
  unitId: number;
  /** Recorded allocations; does not certify that the stock was physically checked. */
  quantityInKits: number;
}
export type BulkStockPatch = Partial<Pick<BulkStockInput, 'variant' | 'quantityTotal' | 'note'>>;

export interface KitInput {
  seriesId: number;
  number: string | null;
  description?: string | null;
  note?: string | null;
  /** Omitted means unverified. Copying a label never verifies composition. */
  compositionState?: CompositionState;
}
export interface CostumeKit extends Required<KitInput> {
  id: number;
  unitId: number;
  retiredAt: string | null;
  version: number;
}
export type KitPatch = Partial<KitInput> & { version: number };
export interface KitBulkLine {
  id: number;
  bulkStockId: number;
  requiredQty: number;
  /** Recorded allocation, not an inventory check. Defaults to zero for copied labels. */
  presentQty: number;
}
export interface KitDetail extends CostumeKit {
  items: CostumeItem[];
  bulkLines: KitBulkLine[];
  changes: KitChange[];
}

/** A move must carry the versions of both kits; an item operation also carries its version. */
export type CompositionInput = {
  version: number;
  note?: string;
} & (
  | { action: 'add' | 'remove'; itemId: number; itemVersion: number }
  | { action: 'move'; itemId: number; itemVersion: number; targetKitId: number; targetVersion: number }
  | { action: 'add'; bulkStockId: number; requiredQty: number; presentQty: number }
  | { action: 'remove'; bulkStockId: number }
  | { action: 'move'; bulkStockId: number; requiredQty: number; presentQty: number; targetKitId: number; targetVersion: number }
);

export interface ItemEvent {
  id: number;
  itemId: number;
  at: string;
  by: number;
  event: string;
  data: Record<string, unknown>;
}
export interface KitChange {
  id: number;
  kitId: number;
  itemId: number | null;
  bulkStockId: number | null;
  change: 'added' | 'removed' | 'moved';
  qty: number;
  at: string;
  by: number;
  note: string | null;
}
export interface WorkOrderInput {
  type: WorkOrderType;
  description: string;
  assignee?: string | null;
  dueOn?: string | null;
}
export interface WorkOrder extends Required<WorkOrderInput> {
  id: number;
  unitId: number;
  itemId: number;
  status: WorkOrderStatus;
}
export type WorkOrderPatch = Partial<WorkOrderInput & { status: WorkOrderStatus }>;
