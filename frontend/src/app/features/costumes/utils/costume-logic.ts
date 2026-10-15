import { Member } from '../../../core/models/member.model';
import {
  Borrower,
  CostumeItem,
  CostumeKit,
  CostumeState,
  ExternalPerson,
  Inventory,
  InventoryLine,
  KitBulkLine,
  Loan,
  LoanLine,
} from '../models/costume.model';

// Odvozené pohledy na krojovou evidenci – čisté funkce bez stavu, aby šly testovat
// a aby je mohla stejně použít mock i budoucí HTTP implementace.

export interface OpenLine {
  loan: Loan;
  line: LoanLine;
}

export function returnedCount(line: LoanLine): number {
  return line.returns.reduce((sum, r) => sum + r.count, 0);
}

// Kolik kusů řádku je stále u vypůjčitele
export function lineRemaining(line: LoanLine): number {
  return line.settled ? 0 : Math.max(0, line.count - returnedCount(line));
}

export function isLoanOpen(loan: Loan): boolean {
  return loan.lines.some((line) => lineRemaining(line) > 0);
}

export function openLines(state: CostumeState): OpenLine[] {
  return state.loans.flatMap((loan) =>
    loan.lines.filter((line) => lineRemaining(line) > 0).map((line) => ({ loan, line })),
  );
}

// Otevřená zápůjčka číslované součásti (oficiální držitel), pokud existuje
export function openLineForItem(state: CostumeState, itemId: number): OpenLine | undefined {
  return openLines(state).find(({ line }) => line.itemId === itemId);
}

export type ItemStatus = 'available' | 'not-ready' | 'on-loan' | 'retired';

export function itemStatus(state: CostumeState, item: CostumeItem): ItemStatus {
  if (item.retired) return 'retired';
  if (openLineForItem(state, item.id)) return 'on-loan';
  return item.ready ? 'available' : 'not-ready';
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  available: 'Ve skladu',
  'not-ready': 'Nepřipraveno',
  'on-loan': 'Zapůjčeno',
  retired: 'Vyřazeno',
};

export function seriesName(state: CostumeState, seriesId: number | undefined): string {
  return state.series.find((s) => s.id === seriesId)?.name ?? '';
}

export function partTypeName(state: CostumeState, partTypeId: number | undefined): string {
  return state.partTypes.find((t) => t.id === partTypeId)?.name ?? '';
}

// „Horňácká černá 1“ – číslo platí jen v rámci řady
export function itemCode(state: CostumeState, item: CostumeItem): string {
  const series = seriesName(state, item.seriesId);
  return item.number !== undefined ? `${series} ${item.number}` : `${series} (bez čísla)`;
}

// „Košile – horňácká černá 1“
export function itemLabel(state: CostumeState, item: CostumeItem): string {
  return `${partTypeName(state, item.partTypeId)} – ${itemCode(state, item).toLocaleLowerCase('cs')}`;
}

export function kitLabel(state: CostumeState, kitId: number | undefined): string {
  return state.kits.find((k) => k.id === kitId)?.label ?? '';
}

export function sameBorrower(a: Borrower, b: Borrower): boolean {
  if (a.kind === 'member' && b.kind === 'member') return a.memberId === b.memberId;
  if (a.kind === 'external' && b.kind === 'external') return a.externalId === b.externalId;
  return false;
}

export function borrowerKey(borrower: Borrower): string {
  return borrower.kind === 'member' ? `member-${borrower.memberId}` : `external-${borrower.externalId}`;
}

export function parseBorrowerKey(key: string): Borrower | undefined {
  const match = /^(member|external)-(\d+)$/.exec(key);
  if (!match) return undefined;
  const id = Number(match[2]);
  return match[1] === 'member' ? { kind: 'member', memberId: id } : { kind: 'external', externalId: id };
}

// Krojárky potřebují jednoznačně identifikovat vypůjčitele – u členů přezdívka i jméno
export function borrowerLabel(borrower: Borrower, members: Member[], externals: ExternalPerson[]): string {
  if (borrower.kind === 'member') {
    const member = members.find((m) => m.id === borrower.memberId);
    if (!member) return `Člen #${borrower.memberId}`;
    const fullName = `${member.firstName} ${member.lastName}`.trim();
    const name = fullName && fullName !== member.nickname ? `${member.nickname} (${fullName})` : member.nickname;
    return member.isActive ? name : `${name} – bývalý člen`;
  }
  const external = externals.find((e) => e.id === borrower.externalId);
  return external ? `${external.name} – externista` : `Externista #${borrower.externalId}`;
}

export interface BorrowerHolding {
  loan: Loan;
  line: LoanLine;
  remaining: number;
}

// Co má osoba podle oficiální evidence u sebe
export function holdingsOf(state: CostumeState, borrower: Borrower): BorrowerHolding[] {
  return openLines(state)
    .filter(({ loan }) => sameBorrower(loan.borrower, borrower))
    .map(({ loan, line }) => ({ loan, line, remaining: lineRemaining(line) }));
}

// Všichni, kdo mají něco zapůjčeno (pro přehled vypůjčitelů)
export function borrowersWithHoldings(state: CostumeState): Borrower[] {
  const seen = new Map<string, Borrower>();
  for (const { loan } of openLines(state)) seen.set(borrowerKey(loan.borrower), loan.borrower);
  return [...seen.values()];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Po termínu: krátkodobá otevřená zápůjčka, jejíž termín vrácení už uplynul
export function isLoanOverdue(loan: Loan, now = new Date()): boolean {
  if (!loan.dueAt || loan.longTerm || !isLoanOpen(loan)) return false;
  return startOfDay(new Date(loan.dueAt)) < startOfDay(now);
}

// --- Komplety ---

export interface KitItemView {
  item: CostumeItem;
  // Zapůjčeno spolu s kompletem (stejná zápůjčka jako komplet)
  withKitLoan: boolean;
  // Samostatně zapůjčeno jinde – v kompletu chybí
  separateLoan?: OpenLine;
  status: ItemStatus;
}

export interface KitBulkView {
  line: KitBulkLine;
  loanedWithKit: number;
  loanedSeparately: number;
  // Kusy, o kterých evidence neví, kde jsou (chybí, neověřeno)
  missing: number;
}

export type KitCompleteness = 'complete' | 'incomplete' | 'needs-check';

export const KIT_COMPLETENESS_LABELS: Record<KitCompleteness, string> = {
  complete: 'Úplný',
  incomplete: 'Neúplný',
  'needs-check': 'Čeká na kontrolu',
};

export interface KitView {
  kit: CostumeKit;
  items: KitItemView[];
  bulk: KitBulkView[];
  // Otevřená zápůjčka celého kompletu (komu je komplet svěřen)
  kitLoan?: Loan;
  completeness: KitCompleteness;
}

export function openKitLoan(state: CostumeState, kitId: number): Loan | undefined {
  return state.loans.find((loan) => loan.kitId === kitId && isLoanOpen(loan));
}

export function kitView(state: CostumeState, kit: CostumeKit): KitView {
  const kitLoan = openKitLoan(state, kit.id);
  const items = state.items
    .filter((item) => item.kitId === kit.id && !item.retired)
    .map((item): KitItemView => {
      const open = openLineForItem(state, item.id);
      const withKitLoan = !!open && !!kitLoan && open.loan.id === kitLoan.id;
      return {
        item,
        withKitLoan,
        separateLoan: open && !withKitLoan ? open : undefined,
        status: itemStatus(state, item),
      };
    });

  const bulk = kit.bulk.map((line): KitBulkView => {
    let loanedWithKit = 0;
    let loanedSeparately = 0;
    for (const open of openLines(state)) {
      if (open.line.fromKitId !== kit.id || open.line.partTypeId !== line.partTypeId || open.line.itemId) continue;
      const remaining = lineRemaining(open.line);
      if (kitLoan && open.loan.id === kitLoan.id) loanedWithKit += remaining;
      else loanedSeparately += remaining;
    }
    return {
      line,
      loanedWithKit,
      loanedSeparately,
      missing: Math.max(0, line.required - line.present - loanedWithKit - loanedSeparately),
    };
  });

  const incomplete =
    items.some((i) => i.separateLoan) || bulk.some((b) => b.missing > 0 || b.loanedSeparately > 0);
  const completeness: KitCompleteness = kit.needsCheck ? 'needs-check' : incomplete ? 'incomplete' : 'complete';
  return { kit, items, bulk, kitLoan, completeness };
}

// Co lze z kompletu právě teď předat jedním krokem (ve skladu a připravené)
export interface KitIssueCandidates {
  items: CostumeItem[];
  bulk: { partTypeId: number; count: number }[];
  // Patří do kompletu, ale předat nejdou – aplikace na ně upozorní
  exceptions: { label: string; reason: string }[];
}

export function kitIssueCandidates(state: CostumeState, kit: CostumeKit, members: Member[] = []): KitIssueCandidates {
  const view = kitView(state, kit);
  const items: CostumeItem[] = [];
  const exceptions: KitIssueCandidates['exceptions'] = [];
  for (const entry of view.items) {
    const label = itemLabel(state, entry.item);
    if (entry.status === 'available') items.push(entry.item);
    else if (entry.status === 'on-loan' && entry.separateLoan) {
      exceptions.push({
        label,
        reason: `zapůjčeno: ${borrowerLabel(entry.separateLoan.loan.borrower, members, state.externals)}`,
      });
    } else if (entry.status === 'on-loan') exceptions.push({ label, reason: 'zapůjčeno s kompletem' });
    else if (entry.status === 'not-ready') exceptions.push({ label, reason: 'nepřipraveno k zapůjčení' });
  }
  const bulk = view.bulk.filter((b) => b.line.present > 0).map((b) => ({ partTypeId: b.line.partTypeId, count: b.line.present }));
  for (const b of view.bulk) {
    const shortBy = b.line.required - b.line.present;
    if (shortBy > 0) {
      exceptions.push({
        label: partTypeName(state, b.line.partTypeId),
        reason: `v kompletu ${b.line.present} z ${b.line.required}`,
      });
    }
  }
  return { items, bulk, exceptions };
}

// --- Číselné řady ---

export function isNumberTaken(state: CostumeState, seriesId: number, number: number, exceptItemId?: number): boolean {
  return state.items.some(
    (item) => item.seriesId === seriesId && item.number === number && !item.retired && item.id !== exceptItemId,
  );
}

// Nejnižší volné číslo v řadě (čísla vyřazených součástí jsou znovu volná)
export function nextFreeNumber(state: CostumeState, seriesId: number): number {
  let candidate = 1;
  while (isNumberTaken(state, seriesId, candidate)) candidate++;
  return candidate;
}

// --- Inventura ---

// Očekávaný stav se zachytí při zahájení inventury; pozdější změny zápůjček ho nepřepisují
export function buildInventoryLines(state: CostumeState, seriesId?: number): InventoryLine[] {
  const lines: InventoryLine[] = [];
  const items = state.items.filter((item) => !item.retired && (seriesId === undefined || item.seriesId === seriesId));
  for (const item of items) {
    const open = openLineForItem(state, item.id);
    lines.push({ key: `item-${item.id}`, itemId: item.id, kitId: item.kitId, expectedCount: 1, holder: open?.loan.borrower });
  }
  const kits = state.kits.filter((kit) => seriesId === undefined || kit.seriesId === seriesId);
  for (const kit of kits) {
    for (const line of kit.bulk) {
      lines.push({ key: `bulk-${kit.id}-${line.partTypeId}`, kitId: kit.id, partTypeId: line.partTypeId, expectedCount: line.present });
    }
    // Neočíslované kusy u vypůjčitelů se ověřují zvlášť u každé osoby
    for (const open of openLines(state)) {
      if (open.line.itemId || open.line.fromKitId !== kit.id) continue;
      lines.push({
        key: `bulk-loan-${open.loan.id}-${open.line.id}`,
        kitId: kit.id,
        partTypeId: open.line.partTypeId,
        expectedCount: lineRemaining(open.line),
        holder: open.loan.borrower,
      });
    }
  }
  return lines;
}

export interface InventoryProgress {
  total: number;
  checked: number;
  unchecked: number;
  ok: number;
  problem: number;
  missing: number;
  // Podle evidence mimo sklad (u členů a externistů)
  outside: number;
  outsideUnchecked: number;
}

export function inventoryProgress(inventory: Inventory): InventoryProgress {
  const lines = inventory.lines;
  const count = (predicate: (line: InventoryLine) => boolean) => lines.filter(predicate).length;
  return {
    total: lines.length,
    checked: count((l) => !!l.result),
    unchecked: count((l) => !l.result),
    ok: count((l) => l.result === 'ok'),
    problem: count((l) => l.result === 'problem'),
    missing: count((l) => l.result === 'missing'),
    outside: count((l) => !!l.holder),
    outsideUnchecked: count((l) => !!l.holder && !l.result),
  };
}

export const INVENTORY_RESULT_LABELS = {
  ok: 'Zkontrolováno',
  problem: 'Nesrovnalost',
  missing: 'Chybí',
} as const;
