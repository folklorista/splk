import type { Page } from './inventory';

export type PaperMigrationEntry = ({ itemId: number; seriesId?: never; number?: never } | { seriesId: number; number: string; itemId?: never }) & { originalIssuedOn?: string | null };
export type PaperFindingCode = 'not_found' | 'ambiguous' | 'conflict' | 'item_retired';
export interface PaperMigrationRequest { entries: PaperMigrationEntry[]; note?: string | null; sourceAttachmentId?: string | null }
export interface PaperMigrationResult { id: number; results: { status: 'migrated' | 'already_recorded' | PaperFindingCode; label: string; itemId?: number | null; loanId?: number | null; findingId?: number }[] }
/** Historical finding during conversion, separate from physical inventory observations. */
export interface PaperMigrationFinding {
  id: number; unitId: number; personId: number; sourceAttachmentId: string | null; label: string; input: PaperMigrationEntry;
  code: PaperFindingCode; loanId: number | null; note: string | null; at: string; by: number;
}
export type PaperMigrationFindings = Page<PaperMigrationFinding>;
