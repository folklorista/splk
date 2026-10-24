import type * as Inv from '@splk/api-contracts';
import { ApiError } from '../api-error';

/** Mutates the inventory adapter's transaction snapshot; never invokes physical handover. */
export function migratePaper(state: { items: Inv.CostumeItem[]; loans: Inv.CostumeLoan[]; paperFindings: Inv.PaperMigrationFinding[] },
  nextId: () => number, event: (id: number, event: string, data: Record<string, unknown>) => void,
  series: Inv.Series[], unit: number, person: number, input: Inv.PaperMigrationRequest): Inv.PaperMigrationResult {
  const invalid = (field: string) => new ApiError(422, 'validation_failed', { field, reason: 'invalid' });
  if (!input.entries.length || input.entries.length > 200) throw invalid('entries');
  const keys = input.entries.map((e) => e.itemId !== undefined ? `item:${e.itemId}` : `series:${e.seriesId}:${e.number}`);
  if (new Set(keys).size !== keys.length || (input.note?.length ?? 0) > 2000) throw invalid('entries');
  const results: Inv.PaperMigrationResult['results'] = [];
  for (const entry of input.entries) {
    if (entry.originalIssuedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.originalIssuedOn) || !Number.isFinite(Date.parse(entry.originalIssuedOn)) || new Date(entry.originalIssuedOn).toISOString().slice(0, 10) !== entry.originalIssuedOn)) throw invalid('originalIssuedOn');
    const rows = entry.itemId !== undefined ? state.items.filter((i) => i.id === entry.itemId) : state.items.filter((i) => i.unitId === unit && i.seriesId === entry.seriesId && i.number === entry.number);
    if (rows.some((i) => i.unitId !== unit) || entry.seriesId !== undefined && !series.some((s) => s.id === entry.seriesId)) throw new ApiError(404, 'not_found');
    const item = rows.length === 1 ? rows[0] : null, open = item ? state.loans.find((l) => l.lines.some((line) => line.itemId === item.id && !line.closedAt)) : null;
    const label = item ? `${series.find((s) => s.id === item.seriesId)?.name ?? 'Součástka'} ${item.number ?? '(bez čísla)'}` : entry.number ?? `Neznámý kus ${entry.itemId}`;
    const code: Inv.PaperFindingCode | null = !rows.length ? 'not_found' : rows.length > 1 ? 'ambiguous' : open && !('personId' in open.holder && open.holder.personId === person) ? 'conflict' : item?.retiredAt ? 'item_retired' : null;
    if (code) {
      const finding: Inv.PaperMigrationFinding = { id: nextId(), unitId: unit, personId: person, sourceAttachmentId: input.sourceAttachmentId ?? null, label, input: structuredClone(entry), code, loanId: open?.id ?? null, note: input.note?.trim() || null, at: new Date().toISOString(), by: 1 };
      state.paperFindings.push(finding); results.push({ status: code, label, itemId: item?.id, loanId: open?.id, findingId: finding.id }); continue;
    }
    if (open) { results.push({ status: 'already_recorded', label, itemId: item!.id, loanId: open.id }); continue; }
    const loan: Inv.CostumeLoan = { id: nextId(), unitId: unit, holder: { personId: person }, kitId: null, origin: 'paper_migration', issuedAt: null, issuedBy: null, migratedAt: new Date().toISOString(), migratedBy: 1, originalIssuedOn: entry.originalIssuedOn ?? null, dueAt: null, note: input.note?.trim() || null, replacesLoanId: null, returns: [], lines: [{ id: nextId(), itemId: item!.id, bulkStockId: null, label, region: null, gender: null, qty: 1, returnedQty: 0, closedAt: null, closedBy: null, closeType: null, closeNote: null }] };
    state.loans.push(loan); event(item!.id, 'paper_migration', { loanId: loan.id, holder: loan.holder }); results.push({ status: 'migrated', label, itemId: item!.id, loanId: loan.id });
  }
  return { id: person, results };
}
