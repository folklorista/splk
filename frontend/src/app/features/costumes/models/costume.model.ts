// Krojový sklad – viz docs/06-specifikace-krojoveho-skladu.md

// Číselná řada podle konkrétního druhu kroje („horňácká černá“, „kopaničká“…).
// Identifikaci součásti tvoří řada + číslo.
export interface CostumeSeries {
  id: number;
  name: string;
}

// Druh součásti (košile, kordulka, šátek, úzká mašle…).
// `numbered: false` = zaměnitelný doplněk evidovaný jen podle počtu kusů v kompletu.
export interface CostumePartType {
  id: number;
  name: string;
  numbered: boolean;
}

// Vyřazení: číslo se v řadě uvolní, historie zůstává u původní součásti (podle id)
export interface CostumeRetirement {
  at: string;
  byUserId: number;
  reason?: string;
}

// Jedinečná součást s vlastní identitou. Bez čísla = číslo jí zatím chybí a má ho dostat.
export interface CostumeItem {
  id: number;
  seriesId: number;
  number?: number;
  partTypeId: number;
  description?: string;
  size?: string;
  // Dlouhodobá poznámka k součásti („povolený šev“, „chybí knoflík“)
  note?: string;
  // Určené složení: komplet, do kterého součást patří
  kitId?: number;
  // Převzatá věc nemusí být připravená k další zápůjčce (praní, oprava)
  ready: boolean;
  retired?: CostumeRetirement;
  createdAt: string;
}

// Neočíslované zaměnitelné doplňky v kompletu – požadovaný a aktuálně přítomný počet
export interface KitBulkLine {
  partTypeId: number;
  required: number;
  // Kusy fyzicky v kompletu (ne zapůjčené, ne chybějící)
  present: number;
  note?: string;
}

export interface CostumeKit {
  id: number;
  label: string;
  seriesId?: number;
  note?: string;
  bulk: KitBulkLine[];
  // Komplet čeká na kontrolu (např. po nalezení nesrovnalosti)
  needsCheck?: boolean;
  createdAt: string;
}

// Osoba mimo soubor evidovaná kvůli zápůjčce – bez účtu a bez skupin
export interface ExternalPerson {
  id: number;
  name: string;
  contact?: string;
  note?: string;
  createdAt: string;
}

export type Borrower =
  | { kind: 'member'; memberId: number }
  | { kind: 'external'; externalId: number };

// Historický záznam o vrácení (části) řádku zápůjčky – poznámka se nikdy nepřepisuje
export interface LoanReturn {
  at: string;
  count: number;
  note?: string;
  // Byla vrácená věc při převzetí připravená k další zápůjčce
  ready: boolean;
  byUserId: number;
}

// Řádek zápůjčky: číslovaná součást (count = 1) nebo druh a počet neočíslovaných kusů
export interface LoanLine {
  id: number;
  itemId?: number;
  partTypeId?: number;
  count: number;
  // Komplet, ze kterého byl kus vydán (neočíslované kusy se do něj vrací)
  fromKitId?: number;
  returns: LoanReturn[];
  // Jinak oficiálně vypořádáno (vyřazení, ztráta…) – zbývající kusy už se nevrací
  settled?: { at: string; byUserId: number; note: string };
}

export interface Loan {
  id: number;
  borrower: Borrower;
  // Zápůjčka celého kompletu (seznam řádků je stav v okamžiku předání)
  kitId?: number;
  issuedAt: string;
  dueAt?: string;
  longTerm: boolean;
  note?: string;
  issuedByUserId: number;
  lines: LoanLine[];
}

export type CostumeLogKind =
  | 'item-created'
  | 'item-updated'
  | 'item-retired'
  | 'item-ready'
  | 'kit-created'
  | 'kit-updated'
  | 'kit-add'
  | 'kit-remove'
  | 'kit-bulk';

// Auditní stopa změn evidence (kdo, kdy, co); zápůjčky a inventury mají historii samy v sobě
export interface CostumeLogEntry {
  id: number;
  at: string;
  byUserId: number;
  kind: CostumeLogKind;
  itemId?: number;
  kitId?: number;
  // U přesunu mezi komplety
  fromKitId?: number;
  partTypeId?: number;
  text: string;
  note?: string;
}

export type InventoryResult = 'ok' | 'problem' | 'missing';

// Řádek inventury – očekávaný stav je zachycen při zahájení, pozdější zápůjčky ho nemění
export interface InventoryLine {
  key: string;
  itemId?: number;
  kitId?: number;
  partTypeId?: number;
  expectedCount: number;
  // Podle evidence u vypůjčitele (mimo sklad) – ověřuje se osobní kontrolou krojárky
  holder?: Borrower;
  result?: InventoryResult;
  foundCount?: number;
  note?: string;
  checkedAt?: string;
  checkedByUserId?: number;
}

export interface Inventory {
  id: number;
  name: string;
  seriesId?: number;
  startedAt: string;
  startedByUserId: number;
  closedAt?: string;
  lines: InventoryLine[];
}

export interface CostumeState {
  series: CostumeSeries[];
  partTypes: CostumePartType[];
  items: CostumeItem[];
  kits: CostumeKit[];
  externals: ExternalPerson[];
  loans: Loan[];
  log: CostumeLogEntry[];
  inventories: Inventory[];
}
