import type { Page, PageQuery } from './inventory';
export type ReportKind = 'items' | 'series' | 'person' | 'item' | 'kit' | 'inventory' | 'loans' | 'work-orders';
export interface ReportQuery { status?: 'active' | 'open' | 'in_progress' | 'done' | 'cancelled'; condition?: 'ok' | 'damaged' | 'needs_adjustment'; location?: 'store' | 'holder' | 'seamstress' | 'repair' | 'unknown'; retired?: boolean; available?: boolean; acquiredFrom?: string; acquiredTo?: string; open?: boolean; overdue?: boolean; holderType?: 'external' }
export interface CostumeReport { unitId: number; generatedAt: string; title: string; notice: string; sections: { title: string; columns: string[]; rows: (string | number | null)[][] }[] }
export interface SearchQuery extends PageQuery { q: string; fund?: number }
export interface SearchResult { kind: 'person' | 'item' | 'kit'; id: number; unitId: number | null; label: string; retired: boolean }
export type SearchPage = Page<SearchResult>;
