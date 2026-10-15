import { seedCostumeState } from '../../data/mock-costumes';
import { CostumeState } from '../../models/costume.model';
import { KitBulkView, kitView } from '../../utils/costume-logic';
import { bulkStatusText, buildKitRows, compositionStatus, kitCompositionCsvRows, kitsCsvRows } from './kits.utils';

describe('kits.utils', () => {
  let state: CostumeState;
  const bulk = (required: number, present: number, extra: Partial<KitBulkView> = {}): KitBulkView => ({
    line: { partTypeId: 6, required, present },
    loanedWithKit: 0,
    loanedSeparately: 0,
    missing: Math.max(0, required - present),
    ...extra,
  });

  beforeEach(() => (state = seedCostumeState()));

  it('u jednoho požadovaného kusu ukazuje přítomno / chybí', () => {
    expect(bulkStatusText(bulk(1, 1))).toBe('přítomno');
    expect(bulkStatusText(bulk(1, 0))).toBe('chybí');
  });

  it('u více kusů ukazuje „x z y“ s rozpisem', () => {
    expect(bulkStatusText(bulk(2, 1))).toBe('1 z 2 v kompletu, 1 chybí');
    expect(bulkStatusText(bulk(2, 0, { loanedWithKit: 1, missing: 1 }))).toBe(
      '0 z 2 v kompletu, 1 zapůjčeno s kompletem, 1 chybí',
    );
  });

  it('přehled kompletů ukáže samostatně zapůjčený šátek jako chybějící a držitele celého kompletu', () => {
    const rows = buildKitRows(state, []);
    const kit1 = rows.find((r) => r.view.kit.id === 1)!;
    expect(kit1.view.completeness).toBe('incomplete');
    expect(kit1.missing).toEqual(['Šátek Horňácká černá 1 (zapůjčeno: Člen #4)']);
    expect(kit1.holder).toBeUndefined();
    expect(kit1.partCount).toBe(7);

    const kit2 = rows.find((r) => r.view.kit.id === 2)!;
    expect(kit2.holder).toBe('Člen #1');
    expect(kit2.holderKey).toBe('member-1');
  });

  it('CSV přehledu kompletů má hlavičku a řádek pro každý komplet', () => {
    const csv = kitsCsvRows(buildKitRows(state, []));
    expect(csv[0]).toEqual(['Komplet', 'Řada', 'Stav', 'Svěřeno', 'Součástí', 'Chybí']);
    expect(csv.length).toBe(state.kits.length + 1);
  });

  it('rozliší stav součásti ve složení', () => {
    const view1 = kitView(state, state.kits[0]);
    const satek = view1.items.find((i) => i.item.id === 4)!;
    expect(compositionStatus(state, satek, []).loanId).toBe(1);
    const kosile = view1.items.find((i) => i.item.id === 1)!;
    expect(compositionStatus(state, kosile, []).text).toBe('v kompletu');
    const view2 = kitView(state, state.kits[1]);
    expect(compositionStatus(state, view2.items[0], []).text).toBe('zapůjčeno s kompletem');
  });

  it('CSV složení obsahuje číslované součásti i neočíslované doplňky', () => {
    const rows = kitCompositionCsvRows(state, kitView(state, state.kits[0]), []);
    expect(rows[0]).toEqual(['Součást', 'Kód', 'Stav', 'U koho / poznámka']);
    expect(rows.length).toBe(1 + 5 + 1);
    expect(rows[rows.length - 1]).toEqual(['Úzká mašle do vlasů', '', '2 z 2 v kompletu', '']);
  });
});
