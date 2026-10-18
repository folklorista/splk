import { Member } from '../../../core/models/member.model';
import {
  Borrower,
  CostumeItem,
  CostumeLoan,
  CostumeSeries,
  CostumeState,
  CostumeWorkOrder,
  ExternalPerson,
} from '../models/costume.model';

// Odvozené pohledy na krojový fond – čisté funkce bez stavu, aby šly testovat
// a aby je mohla stejně použít mock i budoucí HTTP implementace.

// --- Popisky klasifikace ---

export function genderLabel(state: CostumeState, genderId: string | undefined): string {
  return state.classification.genders.find((g) => g.id === genderId)?.label ?? '';
}

export function regionLabel(state: CostumeState, regionId: string | undefined): string {
  return state.classification.regions.find((r) => r.id === regionId)?.label ?? '';
}

export function variantLabel(state: CostumeState, variantId: string | undefined): string {
  return state.classification.variants.find((v) => v.id === variantId)?.label ?? '';
}

export function partTypeName(state: CostumeState, partTypeId: number | undefined): string {
  return state.partTypes.find((t) => t.id === partTypeId)?.name ?? '';
}

// Varianty, které dávají smysl pro daný druh součástky
export function variantsForPartType(state: CostumeState, partTypeId: number) {
  return state.classification.variants.filter((v) => v.partTypeIds.includes(partTypeId));
}

export function findSeries(state: CostumeState, seriesId: number | undefined): CostumeSeries | undefined {
  return state.series.find((s) => s.id === seriesId);
}

// „Mužské / Horňácko / Košile“, s variantou v klíči řady „Mužské / Slovensko / Gatě modré“
export function seriesLabel(state: CostumeState, series: CostumeSeries | undefined): string {
  if (!series) return 'Neznámá řada';
  const part = partTypeName(state, series.partTypeId);
  const variant = series.variantId ? ` ${variantLabel(state, series.variantId)}` : '';
  return `${genderLabel(state, series.genderId)} / ${regionLabel(state, series.regionId)} / ${part}${variant}`;
}

// „č. 7“ – samotné číslo není globálně unikátní, vždy se zobrazuje s řadou
export function itemNumberLabel(item: CostumeItem): string {
  return item.number !== undefined ? `č. ${item.number}` : 'bez čísla';
}

// „Mužské / Horňácko / Košile č. 7“ (+ varianta jako atribut kusu)
export function itemLabel(state: CostumeState, item: CostumeItem): string {
  const variant = item.variantId ? ` (${variantLabel(state, item.variantId)})` : '';
  return `${seriesLabel(state, findSeries(state, item.seriesId))} ${itemNumberLabel(item)}${variant}`;
}

// Druh součástky s variantou bez řady – pro seskupené pohledy („Gatě (modré)“)
export function itemPartLabel(state: CostumeState, item: CostumeItem): string {
  const series = findSeries(state, item.seriesId);
  const variantId = series?.variantId ?? item.variantId;
  const variant = variantId ? ` (${variantLabel(state, variantId)})` : '';
  return `${partTypeName(state, series?.partTypeId)}${variant}`;
}

// Klasifikace kusu odvozená z řady (+ varianta atributem)
export function itemClassification(state: CostumeState, item: CostumeItem) {
  const series = findSeries(state, item.seriesId);
  return {
    genderId: series?.genderId,
    regionId: series?.regionId,
    partTypeId: series?.partTypeId,
    variantId: series?.variantId ?? item.variantId,
  };
}

// --- Držitelé ---

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

// --- Výchozí kroj osoby (docs/06 kap. 5.1a) ---

// Pohlaví kroje kusu je dané jeho evidenční řadou
export function itemGenderId(state: CostumeState, item: CostumeItem): string | undefined {
  return findSeries(state, item.seriesId)?.genderId;
}

export function defaultCostumeOf(state: CostumeState, borrower: Borrower | undefined): string | undefined {
  return borrower ? state.defaultCostumes?.[borrowerKey(borrower)] : undefined;
}

// Neurčený výchozí kroj = odpovídá vše. Jde jen o řazení nabídky, nikdy o zákaz.
export function matchesDefaultCostume(state: CostumeState, item: CostumeItem, genderId: string | undefined): boolean {
  return !genderId || itemGenderId(state, item) === genderId;
}

// Převažující pohlaví držených kusů (odhad pro demo data); při shodě neurčeno
export function inferDefaultCostume(state: CostumeState, borrower: Borrower): string | undefined {
  const counts = new Map<string, number>();
  for (const { item } of holdingsOf(state, borrower)) {
    const genderId = itemGenderId(state, item);
    if (genderId) counts.set(genderId, (counts.get(genderId) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : undefined;
}

// Krojařky potřebují jednoznačně identifikovat držitele – u členů přezdívka i jméno
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

export function memberName(members: Member[], memberId: number | undefined): string {
  if (memberId === undefined) return '';
  return members.find((m) => m.id === memberId)?.nickname ?? `#${memberId}`;
}

// --- Zápůjčky ---

export function isLoanOpen(loan: CostumeLoan): boolean {
  return !loan.endedAt;
}

export function openLoans(state: CostumeState): CostumeLoan[] {
  return state.loans.filter(isLoanOpen);
}

// Aktuální zápůjčka kusu – kus smí mít nejvýš jednu
export function openLoanFor(state: CostumeState, itemId: number): CostumeLoan | undefined {
  return state.loans.find((loan) => loan.itemId === itemId && isLoanOpen(loan));
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isLoanOverdue(loan: CostumeLoan, now = new Date()): boolean {
  if (!loan.dueAt || !isLoanOpen(loan)) return false;
  return startOfDay(new Date(loan.dueAt)) < startOfDay(now);
}

export interface Holding {
  loan: CostumeLoan;
  item: CostumeItem;
}

// Co má držitel podle evidence u sebe – jednotlivé konkrétní kusy
export function holdingsOf(state: CostumeState, borrower: Borrower): Holding[] {
  return openLoans(state)
    .filter((loan) => sameBorrower(loan.borrower, borrower))
    .map((loan) => ({ loan, item: state.items.find((i) => i.id === loan.itemId)! }))
    .filter((h) => !!h.item);
}

export function borrowersWithHoldings(state: CostumeState): Borrower[] {
  const seen = new Map<string, Borrower>();
  for (const loan of openLoans(state)) seen.set(borrowerKey(loan.borrower), loan.borrower);
  return [...seen.values()];
}

// --- Dostupnost kusu ---

export type ItemAvailability = 'available' | 'on-loan' | 'away' | 'not-issuable' | 'retired';

export const AVAILABILITY_LABELS: Record<ItemAvailability, string> = {
  available: 'K vydání',
  'on-loan': 'Zapůjčeno',
  away: 'Mimo sklad',
  'not-issuable': 'Nevydatelné',
  retired: 'Vyřazeno',
};

export function itemAvailability(state: CostumeState, item: CostumeItem): ItemAvailability {
  if (item.retired) return 'retired';
  if (openLoanFor(state, item.id)) return 'on-loan';
  if (item.location !== 'store') return 'away';
  return item.issuable ? 'available' : 'not-issuable';
}

// Důvod, proč kus nelze vydat (undefined = lze)
export function issueBlocker(state: CostumeState, item: CostumeItem): string | undefined {
  switch (itemAvailability(state, item)) {
    case 'retired':
      return 'je vyřazený';
    case 'on-loan':
      return 'je už zapůjčený';
    case 'away':
      return 'není fyzicky ve skladu';
    case 'not-issuable':
      return 'je označený jako nevydatelný';
    default:
      return undefined;
  }
}

// --- Pracovní úkoly ---

export function isWorkOrderOpen(order: CostumeWorkOrder): boolean {
  return order.status === 'open' || order.status === 'in-progress';
}

export function openWorkOrdersFor(state: CostumeState, itemId: number): CostumeWorkOrder[] {
  return state.workOrders.filter((o) => o.itemId === itemId && isWorkOrderOpen(o));
}

// --- Číselné řady ---

// Bez výslovného pravidla řady se čísla vyřazených kusů nerecyklují
export function isNumberTaken(state: CostumeState, seriesId: number, number: number, exceptItemId?: number): boolean {
  const reuse = !!findSeries(state, seriesId)?.allowNumberReuse;
  return state.items.some(
    (item) =>
      item.seriesId === seriesId && item.number === number && item.id !== exceptItemId && (!item.retired || !reuse),
  );
}

// Návrh čísla pro nový kus: bez recyklace za nejvyšším použitým, s recyklací nejnižší volné
export function nextFreeNumber(state: CostumeState, seriesId: number): number {
  if (findSeries(state, seriesId)?.allowNumberReuse) {
    let candidate = 1;
    while (isNumberTaken(state, seriesId, candidate)) candidate++;
    return candidate;
  }
  const numbers = state.items.filter((i) => i.seriesId === seriesId && i.number !== undefined).map((i) => i.number!);
  return Math.max(0, ...numbers) + 1;
}

export interface SeriesStats {
  active: number;
  retired: number;
  maxNumber: number;
  // Čísla 1..max, která nikdy žádný kus neměl – mezera je validní, ne chybějící kus
  unusedNumbers: number[];
  retiredNumbers: number[];
}

export function seriesStats(state: CostumeState, seriesId: number): SeriesStats {
  const items = state.items.filter((i) => i.seriesId === seriesId);
  const used = new Set(items.filter((i) => i.number !== undefined).map((i) => i.number!));
  const maxNumber = Math.max(0, ...used);
  const unusedNumbers: number[] = [];
  for (let n = 1; n <= maxNumber; n++) if (!used.has(n)) unusedNumbers.push(n);
  const activeNumbers = new Set(items.filter((i) => !i.retired && i.number !== undefined).map((i) => i.number!));
  return {
    active: items.filter((i) => !i.retired).length,
    retired: items.filter((i) => !!i.retired).length,
    maxNumber,
    unusedNumbers,
    retiredNumbers: [...new Set(items.filter((i) => i.retired && i.number !== undefined && !activeNumbers.has(i.number)).map((i) => i.number!))].sort((a, b) => a - b),
  };
}

export function sortItems(state: CostumeState, items: CostumeItem[]): CostumeItem[] {
  return [...items].sort(
    (a, b) =>
      seriesLabel(state, findSeries(state, a.seriesId)).localeCompare(seriesLabel(state, findSeries(state, b.seriesId)), 'cs') ||
      (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) ||
      a.id - b.id,
  );
}

// --- Krojová karta držitele ---

export interface CardGroup {
  key: string;
  // „Horňácko – mužský kroj“ (jen pro čitelnost, není to komplet)
  title: string;
  holdings: Holding[];
  // Šablony kompletů pro tento kroj a druhy součástek, které v kartě chybí
  missing: { templateName: string; partTypes: string[] }[];
}

export function cardGroups(state: CostumeState, holdings: Holding[]): CardGroup[] {
  const groups = new Map<string, CardGroup & { genderId?: string; regionId?: string }>();
  for (const holding of holdings) {
    const cls = itemClassification(state, holding.item);
    const key = `${cls.regionId}|${cls.genderId}`;
    if (!groups.has(key)) {
      const gender = genderLabel(state, cls.genderId).toLocaleLowerCase('cs').replace(/é$/, 'ý');
      groups.set(key, { key, title: `${regionLabel(state, cls.regionId)} – ${gender} kroj`, holdings: [], missing: [], genderId: cls.genderId, regionId: cls.regionId });
    }
    groups.get(key)!.holdings.push(holding);
  }
  return [...groups.values()]
    .map(({ genderId, regionId, ...group }) => {
      const held = new Set(group.holdings.map((h) => findSeries(state, h.item.seriesId)?.partTypeId));
      const missing = state.kitTemplates
        .filter((t) => t.genderId === genderId && t.regionId === regionId)
        .map((t) => ({ templateName: t.name, partTypes: t.partTypeIds.filter((id) => !held.has(id)).map((id) => partTypeName(state, id)) }))
        .filter((m) => m.partTypes.length > 0);
      const holdingsSorted = [...group.holdings].sort(
        (a, b) => itemPartLabel(state, a.item).localeCompare(itemPartLabel(state, b.item), 'cs') || (a.item.number ?? 0) - (b.item.number ?? 0),
      );
      return { ...group, holdings: holdingsSorted, missing };
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'cs'));
}

// --- Kdy byl kus naposledy fyzicky viděn ---

export interface LastSeen {
  at: string;
  source: 'inventory' | 'returned' | 'issued';
  inventoryId?: number;
}

// Napříč inventurami a pohyby (vrácení/vydání = kus prošel rukama krojařky)
export function lastSeen(state: CostumeState, itemId: number): LastSeen | undefined {
  const candidates: LastSeen[] = [
    ...state.inventoryChecks
      .filter((c) => c.itemId === itemId && c.presented && !c.revokedAt)
      .map((c): LastSeen => ({ at: c.at, source: 'inventory', inventoryId: c.inventoryId })),
    ...state.loans.filter((l) => l.itemId === itemId).map((l): LastSeen => ({ at: l.issuedAt, source: 'issued' })),
    ...state.loans
      .filter((l) => l.itemId === itemId && l.endedAt && l.endReason !== 'settled')
      .map((l): LastSeen => ({ at: l.endedAt!, source: 'returned' })),
  ];
  return candidates.sort((a, b) => b.at.localeCompare(a.at))[0];
}

// --- Moje kroje ---

export interface MyCostumeRow {
  loanId: number;
  itemId: number;
  label: string;
  part: string;
  number: string;
  series: string;
  issuedAt: string;
  dueAt?: string;
  overdue: boolean;
}

export function myCostumeRows(state: CostumeState, memberId: number, now = new Date()): MyCostumeRow[] {
  return holdingsOf(state, { kind: 'member', memberId })
    .map(({ loan, item }): MyCostumeRow => ({
      loanId: loan.id,
      itemId: item.id,
      label: itemLabel(state, item),
      part: itemPartLabel(state, item),
      number: itemNumberLabel(item),
      series: seriesLabel(state, findSeries(state, item.seriesId)),
      issuedAt: loan.issuedAt,
      dueAt: loan.dueAt,
      overdue: isLoanOverdue(loan, now),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
}

// --- Přehled skladu ---

export interface CostumeStockSummary {
  items: number;
  available: number;
  onLoan: number;
  away: number;
  notIssuable: number;
  needsAttention: number;
  withoutNumber: number;
  overdueLoans: number;
  openWorkOrders: number;
  openInventories: number;
}

export function stockSummary(state: CostumeState, now = new Date()): CostumeStockSummary {
  const active = state.items.filter((i) => !i.retired);
  const availability = active.map((i) => itemAvailability(state, i));
  const count = (a: ItemAvailability) => availability.filter((x) => x === a).length;
  return {
    items: active.length,
    available: count('available'),
    onLoan: count('on-loan'),
    away: count('away'),
    notIssuable: count('not-issuable'),
    needsAttention: active.filter((i) => i.condition !== 'ok').length,
    withoutNumber: active.filter((i) => i.number === undefined).length,
    overdueLoans: openLoans(state).filter((l) => isLoanOverdue(l, now)).length,
    openWorkOrders: state.workOrders.filter(isWorkOrderOpen).length,
    openInventories: state.inventories.filter((i) => !i.closure).length,
  };
}

// --- Hledání a datumy ---

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('cs').trim();
}

export function matchesSearch(label: string, search: string): boolean {
  const query = normalizeSearch(search);
  return !query || normalizeSearch(label).includes(query);
}

export function todayInputValue(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// „2026-10-17“ z <input type="date"> → ISO (poledne, aby nevadilo časové pásmo)
export function dateInputToIso(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

// „2026-10-17T16:30“ z <input type="datetime-local"> → ISO
export function dateTimeInputToIso(value: string): string | undefined {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
}
