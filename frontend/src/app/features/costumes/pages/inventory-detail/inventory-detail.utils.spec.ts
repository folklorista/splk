import { Member } from '../../../../core/models/member.model';
import { CostumeState, InventoryLine } from '../../models/costume.model';
import {
  filterLineViews,
  groupByKit,
  INVENTORY_CSV_HEADER,
  inventoryCsvRows,
  inventoryLineView,
  matchesTab,
  NO_KIT_TITLE,
  resultLabel,
  suggestBulkResult,
} from './inventory-detail.utils';

const state: CostumeState = {
  series: [{ id: 1, name: 'Horňácká černá' }],
  partTypes: [
    { id: 1, name: 'Košile', numbered: true },
    { id: 2, name: 'Úzká mašle', numbered: false },
  ],
  items: [
    { id: 1, seriesId: 1, number: 1, partTypeId: 1, kitId: 2, ready: true, createdAt: '' },
    { id: 2, seriesId: 1, number: 2, partTypeId: 1, ready: true, createdAt: '' },
    { id: 3, seriesId: 1, number: 3, partTypeId: 1, kitId: 1, ready: true, createdAt: '' },
  ],
  kits: [
    { id: 1, label: 'Komplet B', bulk: [], createdAt: '' },
    { id: 2, label: 'Komplet A', bulk: [], createdAt: '' },
  ],
  externals: [{ id: 1, name: 'Jan Host', createdAt: '' }],
  loans: [],
  log: [],
  inventories: [],
};

const members = [{ id: 5, userId: 50, firstName: 'Alois', lastName: 'Novák', nickname: 'Lojza', isActive: false } as Member];

const lines: InventoryLine[] = [
  { key: 'item-1', itemId: 1, kitId: 2, expectedCount: 1, result: 'ok', checkedAt: '2026-10-01T10:00:00Z', checkedByUserId: 50 },
  { key: 'item-2', itemId: 2, expectedCount: 1, holder: { kind: 'member', memberId: 5 } },
  { key: 'item-3', itemId: 3, kitId: 1, expectedCount: 1, result: 'missing', note: 'nenalezeno' },
  { key: 'bulk-1-2', kitId: 1, partTypeId: 2, expectedCount: 2, result: 'problem', foundCount: 1 },
  { key: 'bulk-loan-1-1', kitId: 1, partTypeId: 2, expectedCount: 1, holder: { kind: 'external', externalId: 1 } },
];

const views = lines.map((l) => inventoryLineView(state, l, members));

describe('inventory detail utils', () => {
  it('builds labels and expected location', () => {
    expect(views[0].label).toBe('Košile – horňácká černá 1');
    expect(views[0].location).toBe('Ve skladu');
    expect(views[1].location).toContain('u Lojza');
    expect(views[3].isBulk).toBeTrue();
    expect(views[3].label).toBe('Úzká mašle – 2 ks');
    expect(views[4].location).toBe('u Jan Host – externista');
  });

  it('filters lines by tab', () => {
    const keys = (tab: Parameters<typeof matchesTab>[1]) => lines.filter((l) => matchesTab(l, tab)).map((l) => l.key);
    expect(keys('unchecked')).toEqual(['item-2', 'bulk-loan-1-1']);
    expect(keys('outside')).toEqual(['item-2', 'bulk-loan-1-1']);
    expect(keys('problems')).toEqual(['item-3', 'bulk-1-2']);
    expect(keys('checked')).toEqual(['item-1', 'item-3', 'bulk-1-2']);
    expect(keys('all').length).toBe(5);
  });

  it('distinguishes unchecked from missing in result label', () => {
    expect(resultLabel(lines[1])).toBe('Mimo sklad – neověřeno');
    expect(resultLabel(lines[2])).toBe('Chybí');
    expect(resultLabel({ key: 'x', expectedCount: 1 })).toBe('Nezkontrolováno');
  });

  it('searches code, part, kit and holder', () => {
    expect(filterLineViews(views, 'all', 'černá 3').map((v) => v.line.key)).toEqual(['item-3']);
    expect(filterLineViews(views, 'all', 'mašle').length).toBe(2);
    expect(filterLineViews(views, 'all', 'komplet a').map((v) => v.line.key)).toEqual(['item-1']);
    expect(filterLineViews(views, 'all', 'LOJZA').map((v) => v.line.key)).toEqual(['item-2']);
    expect(filterLineViews(views, 'unchecked', 'mašle').map((v) => v.line.key)).toEqual(['bulk-loan-1-1']);
    expect(filterLineViews(views, 'all', '  ').length).toBe(5);
  });

  it('groups by kit alphabetically with items without kit last', () => {
    const groups = groupByKit(views);
    expect(groups.map((g) => g.title)).toEqual(['Komplet A', 'Komplet B', NO_KIT_TITLE]);
    expect(groups[1].lines.length).toBe(3);
  });

  it('suggests bulk result from found count', () => {
    expect(suggestBulkResult(2, 2)).toBe('ok');
    expect(suggestBulkResult(2, 1)).toBe('problem');
    expect(suggestBulkResult(2, 0)).toBe('missing');
  });

  it('builds CSV rows', () => {
    const rows = inventoryCsvRows(groupByKit(views), (id) => `user-${id}`);
    expect(rows[0]).toEqual(INVENTORY_CSV_HEADER);
    expect(rows.length).toBe(6);
    const first = rows[1];
    expect(first.slice(0, 6)).toEqual(['Komplet A', 'Košile – horňácká černá 1', 1, 'Ve skladu', 'Zkontrolováno', undefined]);
    expect(first[7]).toBeTruthy();
    expect(first[8]).toBe('user-50');
    const bulk = rows.find((r) => r[1] === 'Úzká mašle – 2 ks')!;
    expect(bulk[4]).toBe('Nesrovnalost');
    expect(bulk[5]).toBe(1);
    const missing = rows.find((r) => r[4] === 'Chybí')!;
    expect(missing[6]).toBe('nenalezeno');
    expect(missing[8]).toBe('');
  });
});
