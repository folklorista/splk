import type { PageQuery } from './inventory';
/** Exact decimal units, up to fourteen integer and four fractional digits; never binary floating point. */
export type CostAmount = string;
export type CostTargetKind = 'item' | 'bulk_stock' | 'kit';
export interface CostLinkInput { kind: CostTargetKind; targetId: number; qty: number }
/** Current physical description only: costs.view does not disclose holders, personal cards or loan histories. */
export interface CostLinkedObject {
  id: number; label: string; number: string | null; description: string | null; variant: string | null;
  condition?: string; size?: string | null; acquiredOn?: string | null; retiredAt?: string | null;
  quantityTotal?: number; compositionState?: string;
}
export interface CostLink extends CostLinkInput { id: number; object: CostLinkedObject }
export interface CostumeCost {
  id: number; unitId: number; spentOn: string; amount: CostAmount; currency: string;
  supplier: string | null; documentRef: string | null; description: string; purpose: string | null;
  links: CostLink[]; createdAt: string; createdBy: number; updatedAt: string; updatedBy: number; version: number;
}
export interface CostInput {
  spentOn: string; amount: CostAmount; currency: string; supplier?: string | null; documentRef?: string | null;
  description: string; purpose?: string | null; links?: CostLinkInput[];
}
export type CostPatch = Partial<CostInput> & { version: number };
export interface CostQuery extends PageQuery { unitId?: number; from?: string; to?: string; currency?: string; q?: string }
export interface CostTotal { currency: string; amount: CostAmount; count: number }
export interface CostPage { items: CostumeCost[]; total: number; totals: CostTotal[] }
