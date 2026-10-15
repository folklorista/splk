import { Member } from '../../../../core/models/member.model';
import { CostumeState, InventoryLine, InventoryResult } from '../../models/costume.model';
import { borrowerLabel, INVENTORY_RESULT_LABELS, itemLabel, kitLabel, partTypeName } from '../../utils/costume-logic';

// Pomocné funkce pro obrazovku inventury – čisté funkce kvůli testům

export type InventoryTab = 'unchecked' | 'outside' | 'problems' | 'checked' | 'all';

export const INVENTORY_TABS: { id: InventoryTab; label: string }[] = [
  { id: 'unchecked', label: 'Nezkontrolované' },
  { id: 'outside', label: 'Mimo sklad' },
  { id: 'problems', label: 'Problémové' },
  { id: 'checked', label: 'Zkontrolované' },
  { id: 'all', label: 'Vše' },
];

export const NO_KIT_TITLE = 'Bez kompletu';

export interface InventoryLineView {
  line: InventoryLine;
  label: string;
  kitName: string;
  isBulk: boolean;
  holderLabel?: string;
  // „Ve skladu“ nebo „u <vypůjčitel>“
  location: string;
}

export interface InventoryKitGroup {
  kitId?: number;
  title: string;
  lines: InventoryLineView[];
}

export function inventoryLineView(state: CostumeState, line: InventoryLine, members: Member[]): InventoryLineView {
  const item = line.itemId !== undefined ? state.items.find((i) => i.id === line.itemId) : undefined;
  const isBulk = line.itemId === undefined;
  const label = item
    ? itemLabel(state, item)
    : isBulk
      ? `${partTypeName(state, line.partTypeId)} – ${line.expectedCount} ks`
      : `Součást #${line.itemId}`;
  const holderLabel = line.holder ? borrowerLabel(line.holder, members, state.externals) : undefined;
  return {
    line,
    label,
    kitName: kitLabel(state, line.kitId),
    isBulk,
    holderLabel,
    location: holderLabel ? `u ${holderLabel}` : 'Ve skladu',
  };
}

export function matchesTab(line: InventoryLine, tab: InventoryTab): boolean {
  switch (tab) {
    case 'unchecked':
      return !line.result;
    case 'outside':
      return !!line.holder;
    case 'problems':
      return line.result === 'problem' || line.result === 'missing';
    case 'checked':
      return !!line.result;
    default:
      return true;
  }
}

export function matchesSearch(view: InventoryLineView, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('cs');
  if (!needle) return true;
  return [view.label, view.kitName, view.holderLabel ?? '', view.line.note ?? '']
    .some((text) => text.toLocaleLowerCase('cs').includes(needle));
}

export function filterLineViews(views: InventoryLineView[], tab: InventoryTab, query: string): InventoryLineView[] {
  return views.filter((v) => matchesTab(v.line, tab) && matchesSearch(v, query));
}

// Seskupení podle kompletu (abecedně), součásti bez kompletu na konci
export function groupByKit(views: InventoryLineView[]): InventoryKitGroup[] {
  const groups = new Map<number | undefined, InventoryKitGroup>();
  for (const view of views) {
    const kitId = view.line.kitId;
    let group = groups.get(kitId);
    if (!group) {
      group = { kitId, title: kitId === undefined ? NO_KIT_TITLE : view.kitName || `Komplet #${kitId}`, lines: [] };
      groups.set(kitId, group);
    }
    group.lines.push(view);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.kitId === undefined) return b.kitId === undefined ? 0 : 1;
    if (b.kitId === undefined) return -1;
    return a.title.localeCompare(b.title, 'cs', { numeric: true });
  });
}

export function resultLabel(line: InventoryLine): string {
  if (line.result) return INVENTORY_RESULT_LABELS[line.result];
  return line.holder ? 'Mimo sklad – neověřeno' : 'Nezkontrolováno';
}

// Návrh výsledku podle nalezeného počtu neočíslovaných kusů
export function suggestBulkResult(expected: number, found: number): InventoryResult {
  if (found >= expected) return 'ok';
  return found <= 0 ? 'missing' : 'problem';
}

function formatDateTime(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleString('cs-CZ') : '';
}

export const INVENTORY_CSV_HEADER = [
  'Komplet',
  'Položka',
  'Očekáváno',
  'Umístění podle evidence',
  'Výsledek',
  'Nalezeno',
  'Poznámka',
  'Zkontrolováno kdy',
  'Kdo',
];

export function inventoryCsvRows(
  groups: InventoryKitGroup[],
  userName: (userId: number) => string,
): (string | number | undefined)[][] {
  const rows: (string | number | undefined)[][] = [INVENTORY_CSV_HEADER];
  for (const group of groups) {
    for (const view of group.lines) {
      const line = view.line;
      rows.push([
        group.title,
        view.label,
        line.expectedCount,
        view.location,
        resultLabel(line),
        line.foundCount,
        line.note,
        formatDateTime(line.checkedAt),
        line.checkedByUserId !== undefined ? userName(line.checkedByUserId) : '',
      ]);
    }
  }
  return rows;
}

// Kdo zahájil / zkontroloval – uživatel podle navázaného člena
export function userNameFromMembers(members: Member[], userId: number): string {
  return members.find((m) => m.userId === userId)?.nickname ?? `Uživatel #${userId}`;
}
