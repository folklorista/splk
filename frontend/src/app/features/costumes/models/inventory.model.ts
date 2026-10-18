import type { Borrower, ItemCondition } from './costume.model';

// Inventura = jedna akce nad celým fondem nebo výslovně vymezenou podmnožinou fyzických kusů.
// Dva pracovní režimy (podle lidí / ve skladu) pracují nad stejným snapshotem a stejnými kontrolami.

// Filtry rozsahu – prázdné pole = bez omezení v dané dimenzi. Kombinace filtrů = průnik podmínek.
export interface InventoryScope {
  genderIds: string[];
  regionIds: string[];
  partTypeIds: number[];
  variantIds: string[];
  // Skupiny členů: zahrnou se jen kusy zapůjčené jejich členům (ne skladové zásoby)
  groupIds: number[];
}

// Kus výslovně přidaný do rozsahu až po zahájení – vždy s auditní poznámkou
export interface InventoryAddition {
  itemId: number;
  at: string;
  byMemberId: number;
  note: string;
}

export interface InventoryClosure {
  at: string;
  byMemberId: number;
  // true = uzavřeno administrativně s nevyřešenými nesrovnalostmi
  withDiscrepancies: boolean;
  reason?: string;
  // Rekapitulace v okamžiku uzavření (aby se neměnila se zpětnými úpravami evidence)
  verified: number;
  total: number;
  notPresented: number;
  unchecked: number;
}

export interface Inventory {
  id: number;
  ensembleId: number;
  name: string;
  scope: InventoryScope;
  // Lidsky čitelný popis filtrů zachycený při zahájení
  scopeLabel: string;
  startedAt: string;
  startedByMemberId: number;
  // Snapshot cílových kusů – pozdější výměna, nová zápůjčka ani změna skupiny rozsah nemění
  targetItemIds: number[];
  // Snapshot dotčených držitelů v okamžiku zahájení (pro plán návštěv)
  holders: Borrower[];
  additions: InventoryAddition[];
  slotCapacity: number;
  closure?: InventoryClosure;
}

// Termín inventurních návštěv
export interface InventorySlot {
  id: number;
  inventoryId: number;
  startsAt: string;
  endsAt?: string;
  capacity: number;
  place?: string;
}

export type VisitStatus = 'booked' | 'in-progress' | 'completed' | 'cancelled';

// Rezervace termínu a zároveň záznam o návštěvě. Dokončená návštěva ≠ všechny kusy ověřené.
export interface InventoryVisit {
  id: number;
  inventoryId: number;
  borrower: Borrower;
  // Chybí = návštěva bez rezervace (krojařka odbavila člověka, který přišel bez termínu)
  slotId?: number;
  status: VisitStatus;
  bookedAt: string;
  bookedByMemberId: number;
  completedAt?: string;
  completedByMemberId?: number;
  note?: string;
}

export type CheckMode = 'person' | 'stock';

// Jedna kontrola kusu v inventuře. Opakované kontroly se uchovávají jako historie;
// do pokrytí se kus započítá jen jednou. Zrušená kontrola (`revokedAt`) zůstává v historii.
export interface InventoryCheck {
  id: number;
  inventoryId: number;
  itemId: number;
  at: string;
  byMemberId: number;
  mode: CheckMode;
  // Fyzické předložení / nalezení – jediné, co se počítá jako fyzické ověření
  presented: boolean;
  // Posouzený stav (jen u předloženého kusu; rychlé zadání čísel stav neposuzuje)
  condition?: ItemCondition;
  note?: string;
  visitId?: number;
  revokedAt?: string;
  revokedByMemberId?: number;
}

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  booked: 'Objednán',
  'in-progress': 'Probíhá',
  completed: 'Odbaven',
  cancelled: 'Zrušeno',
};

export function emptyScope(): InventoryScope {
  return { genderIds: [], regionIds: [], partTypeIds: [], variantIds: [], groupIds: [] };
}
