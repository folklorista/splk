// Krojový fond – viz docs/zadani-pro-robota-krojarna-inventury.md (nahrazuje fyzické komplety z docs/06).
// Doménové entity jsou záměrně oddělené: fyzické umístění, stav součástky, zápůjčka a pracovní úkol
// se nemíchají do jednoho stavového enumu.

import type { Inventory, InventoryCheck, InventorySlot, InventoryVisit } from './inventory.model';

// Jedna možnost klasifikace (pohlaví kroje, region, varianta). `id` je stabilní textový klíč.
export interface ClassificationOption {
  id: string;
  label: string;
}

// Doplňkové rozlišení (nové/staré, modré/bílé…) – platí jen pro vyjmenované druhy součástek
export interface CostumeVariant extends ClassificationOption {
  partTypeIds: number[];
}

// Klasifikace krojového fondu konfigurovatelná pro soubor. Jiný soubor může mít místo regionů
// vesnice nebo rozlišovat sváteční/pracovní – stačí jiné možnosti, ne jiný kód.
export interface CostumeClassification {
  ensembleId: number;
  genders: ClassificationOption[];
  regions: ClassificationOption[];
  variants: CostumeVariant[];
}

// Druh součástky (košile, gatě, rukávce…). `genderId` chybí = používá se v mužském i ženském kroji.
export interface CostumePartType {
  id: number;
  name: string;
  genderId?: string;
}

// Evidenční řada = konkrétní definovaná kombinace klasifikace (např. mužské / Horňácko / košile).
// Varianta může být součástí klíče řady (`variantId`), nebo atributem jednotlivých kusů – podle nastavení souboru.
export interface CostumeSeries {
  id: number;
  ensembleId: number;
  genderId: string;
  regionId: string;
  partTypeId: number;
  variantId?: string;
  // Výslovné pravidlo: číslo vyřazeného kusu smí dostat nový kus. Bez něj se čísla nerecyklují.
  allowNumberReuse?: boolean;
  note?: string;
}

// Stav součástky – nezávislý na umístění a zápůjčce
export type ItemCondition = 'ok' | 'needs-alteration' | 'damaged';

// Fyzické umístění kusu – nezávislé na tom, komu je kus v evidenci zapůjčen
export type ItemLocation = 'store' | 'holder' | 'seamstress' | 'repair' | 'unknown';

export interface CostumeRetirement {
  at: string;
  byMemberId: number;
  reason?: string;
}

// Fyzická součástka – základní entita. Identifikace pro lidi = řada + číslo (číslo platí jen v řadě),
// v kódu stabilní `id`. Čísla mohou mít mezery; vyřazený kus zůstává v evidenci i s číslem.
export interface CostumeItem {
  id: number;
  ensembleId: number;
  seriesId: number;
  // Chybí = kus ještě nedostal fyzické číslo
  number?: number;
  // Varianta jako atribut kusu (jen když není součástí klíče řady)
  variantId?: string;
  size?: string;
  description?: string;
  // Dlouhodobá poznámka („povolený šev“)
  note?: string;
  condition: ItemCondition;
  // Nevydatelné = nesmí se půjčit (praní, zásadní vada…) bez ohledu na stav
  issuable: boolean;
  location: ItemLocation;
  locationNote?: string;
  retired?: CostumeRetirement;
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

export type Borrower = { kind: 'member'; memberId: number } | { kind: 'external'; externalId: number };

export type LoanEndReason = 'returned' | 'exchanged' | 'settled';

// Zápůjčka jednoho konkrétního kusu jednomu držiteli. Uzavřená zápůjčka zůstává v historii.
export interface CostumeLoan {
  id: number;
  ensembleId: number;
  itemId: number;
  borrower: Borrower;
  issuedAt: string;
  issuedByMemberId: number;
  // Chybí = dlouhodobě
  dueAt?: string;
  note?: string;
  // Vydáno jako náhrada za jinou zápůjčku (výměna)
  replacesLoanId?: number;
  // Vydáno během inventurní návštěvy
  inventoryId?: number;
  visitId?: number;
  endedAt?: string;
  endedByMemberId?: number;
  endReason?: LoanEndReason;
  endNote?: string;
}

export type WorkOrderKind = 'alteration' | 'repair' | 'resewing';
export type WorkOrderStatus = 'open' | 'in-progress' | 'done' | 'cancelled';

// Pracovní úkol na konkrétní součástce (úprava, oprava, přešití) – vzniká v inventuře i mimo ni
export interface CostumeWorkOrder {
  id: number;
  ensembleId: number;
  itemId: number;
  kind: WorkOrderKind;
  description: string;
  status: WorkOrderStatus;
  assignee?: string;
  dueAt?: string;
  createdAt: string;
  createdByMemberId: number;
  inventoryId?: number;
  closedAt?: string;
  resolution?: string;
}

// Šablona kompletu: jaké druhy součástek kroj daného pohlaví a regionu potřebuje.
// Není to pevná sada kusů – slouží jen k upozornění, co držiteli chybí.
export interface CostumeKitTemplate {
  id: number;
  ensembleId: number;
  name: string;
  genderId: string;
  regionId: string;
  partTypeIds: number[];
  note?: string;
}

export type CostumeEventKind =
  | 'item-created'
  | 'item-updated'
  | 'item-retired'
  | 'condition'
  | 'location'
  | 'issued'
  | 'returned'
  | 'exchanged'
  | 'work-order'
  | 'inventory-added';

// Historie pohybů a změn kusu (kdo, kdy, co). Kontroly inventur jsou v `inventoryChecks`.
export interface CostumeEvent {
  id: number;
  at: string;
  byMemberId: number;
  kind: CostumeEventKind;
  itemId: number;
  text: string;
  note?: string;
  loanId?: number;
  inventoryId?: number;
  visitId?: number;
  workOrderId?: number;
}

export interface CostumeState {
  classification: CostumeClassification;
  partTypes: CostumePartType[];
  series: CostumeSeries[];
  items: CostumeItem[];
  externals: ExternalPerson[];
  loans: CostumeLoan[];
  workOrders: CostumeWorkOrder[];
  kitTemplates: CostumeKitTemplate[];
  events: CostumeEvent[];
  // Výchozí kapacita inventurního termínu (počet osob)
  defaultSlotCapacity: number;
  inventories: Inventory[];
  inventorySlots: InventorySlot[];
  inventoryVisits: InventoryVisit[];
  inventoryChecks: InventoryCheck[];
}

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  ok: 'V pořádku',
  'needs-alteration': 'Vyžaduje úpravu',
  damaged: 'Poškozeno',
};

export const LOCATION_LABELS: Record<ItemLocation, string> = {
  store: 'Ve skladu',
  holder: 'U držitele',
  seamstress: 'U švadleny',
  repair: 'V opravě',
  unknown: 'Neznámé',
};

export const WORK_ORDER_KIND_LABELS: Record<WorkOrderKind, string> = {
  alteration: 'Úprava',
  repair: 'Oprava',
  resewing: 'Přešití',
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Otevřený',
  'in-progress': 'Rozpracovaný',
  done: 'Hotovo',
  cancelled: 'Zrušeno',
};
