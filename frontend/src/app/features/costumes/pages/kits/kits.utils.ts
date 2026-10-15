import { Member } from '../../../../core/models/member.model';
import { CostumeState } from '../../models/costume.model';
import {
  KIT_COMPLETENESS_LABELS,
  KitBulkView,
  KitItemView,
  KitView,
  borrowerKey,
  borrowerLabel,
  itemCode,
  kitView,
  lineRemaining,
  openLines,
  partTypeName,
  seriesName,
} from '../../utils/costume-logic';

export interface KitRow {
  view: KitView;
  series: string;
  holder?: string;
  holderKey?: string;
  // Číslované součásti + požadované neočíslované kusy
  partCount: number;
  missing: string[];
}

// Stav číslované součásti ve složení kompletu
export interface CompositionStatus {
  text: string;
  holder?: string;
  personKey?: string;
  loanId?: number;
}

export function compositionStatus(state: CostumeState, entry: KitItemView, members: Member[]): CompositionStatus {
  if (entry.separateLoan) {
    const borrower = entry.separateLoan.loan.borrower;
    return {
      text: 'samostatně zapůjčeno – v kompletu chybí',
      holder: borrowerLabel(borrower, members, state.externals),
      personKey: borrowerKey(borrower),
      loanId: entry.separateLoan.loan.id,
    };
  }
  if (entry.withKitLoan) return { text: 'zapůjčeno s kompletem' };
  if (entry.status === 'not-ready') return { text: 'v kompletu, nepřipraveno' };
  return { text: 'v kompletu' };
}

// „přítomno / chybí“ u jednoho kusu, jinak „1 ze 2“ s rozpisem, kde jsou ostatní kusy
export function bulkStatusText(bulk: KitBulkView): string {
  const { line, loanedWithKit, loanedSeparately, missing } = bulk;
  if (line.required === 1 && !loanedWithKit && !loanedSeparately) {
    return line.present >= 1 ? 'přítomno' : 'chybí';
  }
  const parts = [`${line.present} z ${line.required} v kompletu`];
  if (loanedWithKit) parts.push(`${loanedWithKit} zapůjčeno s kompletem`);
  if (loanedSeparately) parts.push(`${loanedSeparately} zapůjčeno samostatně`);
  if (missing) parts.push(`${missing} chybí`);
  return parts.join(', ');
}

// Kdo má samostatně zapůjčené neočíslované kusy z kompletu
export function bulkSeparateHolders(
  state: CostumeState,
  view: KitView,
  partTypeId: number,
  members: Member[],
): { holder: string; personKey: string; loanId: number; count: number }[] {
  return openLines(state)
    .filter(
      ({ loan, line }) =>
        !line.itemId && line.fromKitId === view.kit.id && line.partTypeId === partTypeId && loan.id !== view.kitLoan?.id,
    )
    .map(({ loan, line }) => ({
      holder: borrowerLabel(loan.borrower, members, state.externals),
      personKey: borrowerKey(loan.borrower),
      loanId: loan.id,
      count: lineRemaining(line),
    }));
}

// Co v kompletu chybí: samostatně zapůjčené součásti a chybějící / samostatně zapůjčené kusy
export function kitMissingSummary(state: CostumeState, view: KitView, members: Member[]): string[] {
  const missing: string[] = [];
  for (const entry of view.items) {
    if (!entry.separateLoan) continue;
    const who = borrowerLabel(entry.separateLoan.loan.borrower, members, state.externals);
    missing.push(`${partTypeName(state, entry.item.partTypeId)} ${itemCode(state, entry.item)} (zapůjčeno: ${who})`);
  }
  for (const bulk of view.bulk) {
    const name = partTypeName(state, bulk.line.partTypeId);
    if (bulk.loanedSeparately) missing.push(`${name} ${bulk.loanedSeparately}× (zapůjčeno samostatně)`);
    if (bulk.missing) missing.push(`${name} ${bulk.missing}× (chybí)`);
  }
  return missing;
}

export function buildKitRows(state: CostumeState, members: Member[]): KitRow[] {
  return state.kits
    .map((kit): KitRow => {
      const view = kitView(state, kit);
      return {
        view,
        series: seriesName(state, kit.seriesId),
        holder: view.kitLoan ? borrowerLabel(view.kitLoan.borrower, members, state.externals) : undefined,
        holderKey: view.kitLoan ? borrowerKey(view.kitLoan.borrower) : undefined,
        partCount: view.items.length + view.bulk.reduce((sum, b) => sum + b.line.required, 0),
        missing: kitMissingSummary(state, view, members),
      };
    })
    .sort((a, b) => a.view.kit.label.localeCompare(b.view.kit.label, 'cs', { numeric: true }));
}

export function kitsCsvRows(rows: KitRow[]): (string | number | undefined)[][] {
  return [
    ['Komplet', 'Řada', 'Stav', 'Svěřeno', 'Součástí', 'Chybí'],
    ...rows.map((row) => [
      row.view.kit.label,
      row.series,
      KIT_COMPLETENESS_LABELS[row.view.completeness],
      row.holder,
      row.partCount,
      row.missing.join(', '),
    ]),
  ];
}

// Export složení jednoho kompletu
export function kitCompositionCsvRows(state: CostumeState, view: KitView, members: Member[]): (string | number | undefined)[][] {
  const rows: (string | number | undefined)[][] = [['Součást', 'Kód', 'Stav', 'U koho / poznámka']];
  for (const entry of view.items) {
    const status = compositionStatus(state, entry, members);
    rows.push([
      partTypeName(state, entry.item.partTypeId),
      itemCode(state, entry.item),
      status.text,
      [status.holder, entry.item.note].filter(Boolean).join(' – '),
    ]);
  }
  for (const bulk of view.bulk) {
    const holders = bulkSeparateHolders(state, view, bulk.line.partTypeId, members).map((h) => `${h.holder} (${h.count}×)`);
    rows.push([
      partTypeName(state, bulk.line.partTypeId),
      '',
      bulkStatusText(bulk),
      [...holders, bulk.line.note].filter(Boolean).join(' – '),
    ]);
  }
  return rows;
}
