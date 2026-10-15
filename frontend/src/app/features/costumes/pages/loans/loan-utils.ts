import { Member } from '../../../../core/models/member.model';
import { formatDate } from '../../../../shared/export/export.utils';
import { Borrower, CostumeState, Loan, LoanLine } from '../../models/costume.model';
import { ReturnLineInput } from '../../costumes.service';
import {
  OpenLine,
  borrowerKey,
  borrowerLabel,
  isLoanOpen,
  isLoanOverdue,
  itemLabel,
  kitLabel,
  lineRemaining,
  partTypeName,
} from '../../utils/costume-logic';

// Pomocné čisté funkce pro stránky zápůjček a vypůjčitelů (filtry, export, formulář vrácení)

export type LoanFilter = 'open' | 'overdue' | 'all';

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('cs').trim();
}

export function matchesSearch(label: string, search: string): boolean {
  const query = normalizeSearch(search);
  return !query || normalizeSearch(label).includes(query);
}

// Zápůjčky podle záložky a hledání podle vypůjčitele; nejnovější nahoře
export function filterLoans(
  loans: Loan[],
  filter: LoanFilter,
  search: string,
  labelOf: (borrower: Borrower) => string,
  now = new Date(),
): Loan[] {
  return loans
    .filter((loan) => {
      if (filter === 'open' && !isLoanOpen(loan)) return false;
      if (filter === 'overdue' && !isLoanOverdue(loan, now)) return false;
      return matchesSearch(labelOf(loan.borrower), search);
    })
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id - a.id);
}

// Kolik kusů je stále u vypůjčitele z celkově předaných
export function loanPieces(loan: Loan): { held: number; total: number } {
  return loan.lines.reduce(
    (acc, line) => ({ held: acc.held + lineRemaining(line), total: acc.total + line.count }),
    { held: 0, total: 0 },
  );
}

// „Košile – horňácká černá 1“ nebo „Úzká mašle do vlasů – 2 ks“
export function lineLabel(state: CostumeState, line: LoanLine): string {
  if (line.itemId !== undefined) {
    const item = state.items.find((i) => i.id === line.itemId);
    return item ? itemLabel(state, item) : `Součást #${line.itemId}`;
  }
  return `${partTypeName(state, line.partTypeId)} – ${line.count} ks`;
}

export const OPEN_LINES_CSV_HEADER = ['Vypůjčitel', 'Komplet', 'Součást', 'Počet u vypůjčitele', 'Vydáno', 'Vrátit do', 'Dlouhodobě', 'Poznámka'];

// Report nevrácených věcí – jeden řádek za každý otevřený řádek zápůjčky
export function openLinesCsvRows(state: CostumeState, members: Member[], lines: OpenLine[]): string[][] {
  const rows = lines.map(({ loan, line }) => [
    borrowerLabel(loan.borrower, members, state.externals),
    kitLabel(state, loan.kitId ?? line.fromKitId),
    line.itemId !== undefined ? lineLabel(state, line) : partTypeName(state, line.partTypeId),
    String(lineRemaining(line)),
    formatDate(loan.issuedAt),
    formatDate(loan.dueAt),
    loan.longTerm ? 'ano' : 'ne',
    loan.note ?? '',
  ]);
  return [OPEN_LINES_CSV_HEADER, ...rows];
}

// --- Formulář vrácení ---

export interface ReturnFormRow {
  lineId: number;
  remaining: number;
  // Číslovaná součást: zaškrtnuto = vráceno; neočíslované kusy: počet vrácených
  returned: boolean;
  count: number;
  note: string;
  ready: boolean;
}

// Výchozí stav: vše otevřené se vrací a je připravené k další zápůjčce
export function initialReturnRows(loan: Loan): ReturnFormRow[] {
  return loan.lines
    .filter((line) => lineRemaining(line) > 0)
    .map((line) => {
      const remaining = lineRemaining(line);
      return { lineId: line.id, remaining, returned: true, count: remaining, note: '', ready: true };
    });
}

export function toReturnInputs(rows: ReturnFormRow[]): ReturnLineInput[] {
  return rows
    .map((row) => ({ row, count: row.returned ? Math.min(Math.max(0, Math.floor(row.count || 0)), row.remaining) : 0 }))
    .filter(({ count }) => count > 0)
    .map(({ row, count }) => ({ lineId: row.lineId, count, note: row.note.trim() || undefined, ready: row.ready }));
}

// Kolik kusů zůstane po vrácení u vypůjčitele
export function remainingAfterReturn(rows: ReturnFormRow[]): number {
  const returned = new Map(toReturnInputs(rows).map((r) => [r.lineId, r.count]));
  return rows.reduce((sum, row) => sum + row.remaining - (returned.get(row.lineId) ?? 0), 0);
}

// --- Vypůjčitelé ---

export type BorrowerGroup = 'member' | 'former' | 'external';

export interface BorrowerOption {
  key: string;
  borrower: Borrower;
  label: string;
  group: BorrowerGroup;
}

// Všichni možní vypůjčitelé: aktivní členové, bývalí členové, externisté (v tomto pořadí)
export function borrowerOptions(state: CostumeState, members: Member[]): BorrowerOption[] {
  const order: Record<BorrowerGroup, number> = { member: 0, former: 1, external: 2 };
  const options: BorrowerOption[] = [
    ...members.map((m): BorrowerOption => {
      const borrower: Borrower = { kind: 'member', memberId: m.id };
      return { key: borrowerKey(borrower), borrower, label: borrowerLabel(borrower, members, state.externals), group: m.isActive ? 'member' : 'former' };
    }),
    ...state.externals.map((e): BorrowerOption => {
      const borrower: Borrower = { kind: 'external', externalId: e.id };
      return { key: borrowerKey(borrower), borrower, label: borrowerLabel(borrower, members, state.externals), group: 'external' };
    }),
  ];
  return options.sort((a, b) => order[a.group] - order[b.group] || a.label.localeCompare(b.label, 'cs'));
}

export function borrowerGroup(borrower: Borrower, members: Member[]): BorrowerGroup {
  if (borrower.kind === 'external') return 'external';
  const member = members.find((m) => m.id === borrower.memberId);
  return member && !member.isActive ? 'former' : 'member';
}

export type BorrowerFilter = 'all' | BorrowerGroup;

export function filterBorrowers(borrowers: Borrower[], filter: BorrowerFilter, members: Member[]): Borrower[] {
  return filter === 'all' ? borrowers : borrowers.filter((b) => borrowerGroup(b, members) === filter);
}

// --- Data ---

export function todayInputValue(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Datum z <input type="date"> jako ISO (poledne místního času, aby se den neposunul)
export function dateInputToIso(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}
