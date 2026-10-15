import { Member } from '../../../../core/models/member.model';
import { CostumeItem, CostumeState } from '../../models/costume.model';
import {
  ITEM_STATUS_LABELS,
  ItemStatus,
  borrowerKey,
  borrowerLabel,
  itemCode,
  itemStatus,
  kitLabel,
  openLineForItem,
  partTypeName,
  seriesName,
} from '../../utils/costume-logic';
import { formatDate } from '../../../../shared/export/export.utils';

// Řádek přehledu součástí – předpočítané texty pro výpis, hledání i export
export interface ItemRow {
  item: CostumeItem;
  code: string;
  series: string;
  partType: string;
  kit: string;
  status: ItemStatus;
  holder?: string;
  holderKey?: string;
  loanId?: number;
}

export interface ItemFilter {
  query: string;
  seriesId?: number;
  partTypeId?: number;
  // Prázdný = všechny kromě vyřazených
  status?: ItemStatus;
  // 0 = bez kompletu
  kitId?: number;
}

export function buildItemRows(state: CostumeState, members: Member[]): ItemRow[] {
  return state.items
    .map((item): ItemRow => {
      const open = openLineForItem(state, item.id);
      return {
        item,
        code: itemCode(state, item),
        series: seriesName(state, item.seriesId),
        partType: partTypeName(state, item.partTypeId),
        kit: kitLabel(state, item.kitId),
        status: itemStatus(state, item),
        holder: open ? borrowerLabel(open.loan.borrower, members, state.externals) : undefined,
        holderKey: open ? borrowerKey(open.loan.borrower) : undefined,
        loanId: open?.loan.id,
      };
    })
    .sort(compareItemRows);
}

// Řazení podle řady a čísla; součásti bez čísla na konec řady
export function compareItemRows(a: ItemRow, b: ItemRow): number {
  const bySeries = a.series.localeCompare(b.series, 'cs');
  if (bySeries) return bySeries;
  const numA = a.item.number ?? Number.MAX_SAFE_INTEGER;
  const numB = b.item.number ?? Number.MAX_SAFE_INTEGER;
  if (numA !== numB) return numA - numB;
  return a.partType.localeCompare(b.partType, 'cs') || a.item.id - b.item.id;
}

// Hledání bez ohledu na velikost písmen a diakritiku („kopanicka 1“ najde „Kopaničká 1“)
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('cs');
}

// Každé slovo dotazu musí v řádku najít shodu. Číslo musí odpovídat celému slovu,
// aby „kopaničká 1“ nenašlo i „kopaničká 14“.
export function matchesQuery(row: ItemRow, query: string): boolean {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeText(
    [row.code, row.partType, row.item.description, row.item.size, row.item.note, row.kit, row.holder]
      .filter(Boolean)
      .join(' | '),
  );
  const words = new Set(haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  return tokens.every((token) => (/^\d+$/.test(token) ? words.has(token) : haystack.includes(token)));
}

export function filterItemRows(rows: ItemRow[], filter: ItemFilter): ItemRow[] {
  return rows.filter((row) => {
    if (filter.status ? row.status !== filter.status : row.status === 'retired') return false;
    if (filter.seriesId !== undefined && row.item.seriesId !== filter.seriesId) return false;
    if (filter.partTypeId !== undefined && row.item.partTypeId !== filter.partTypeId) return false;
    if (filter.kitId !== undefined && (row.item.kitId ?? 0) !== filter.kitId) return false;
    return matchesQuery(row, filter.query);
  });
}

export const ITEM_CSV_HEADER = [
  'Řada',
  'Číslo',
  'Součást',
  'Popis',
  'Velikost',
  'Komplet',
  'Stav',
  'U koho',
  'Poznámka',
  'Vyřazeno',
  'Důvod vyřazení',
];

export function itemCsvRows(rows: ItemRow[]): (string | number | undefined)[][] {
  return [
    ITEM_CSV_HEADER,
    ...rows.map((row) => [
      row.series,
      row.item.number ?? 'bez čísla',
      row.partType,
      row.item.description,
      row.item.size,
      row.kit,
      ITEM_STATUS_LABELS[row.status],
      row.holder,
      row.item.note,
      formatDate(row.item.retired?.at),
      row.item.retired?.reason,
    ]),
  ];
}
