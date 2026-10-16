import { Member } from '../../../../core/models/member.model';
import { seedCostumeState } from '../../data/mock-costumes';
import { CostumeState } from '../../models/costume.model';
import { ITEM_CSV_HEADER, ItemFilter, buildItemRows, filterItemRows, itemCsvRows, matchesQuery } from './items.utils';

describe('items.utils', () => {
  let state: CostumeState;
  const members: Member[] = [
    { id: 4, ensembleId: 1, userId: 40, firstName: 'Anna', lastName: 'Malá', nickname: 'Anička', groupIds: [], isActive: true, createdAt: '2020-01-01' },
  ];
  const ids = (filter: Partial<ItemFilter>) =>
    filterItemRows(buildItemRows(state, members), { query: '', ...filter }).map((r) => r.item.id);
  const sorted = (values: number[]) => [...values].sort((a, b) => a - b);

  beforeEach(() => (state = seedCostumeState()));

  it('řadí podle řady a čísla, součást bez čísla na konci řady', () => {
    const rows = buildItemRows(state, members);
    expect(rows[0].series).toBe('Horňácká černá');
    const kopanicka = rows.filter((r) => r.item.seriesId === 2).map((r) => r.item.number);
    expect(kopanicka).toEqual([1, 1, 1, 1, 14, undefined]);
  });

  it('ve výchozím stavu skryje vyřazené, filtr „Vyřazené“ ukáže jen je', () => {
    expect(ids({})).not.toContain(16);
    expect(ids({ status: 'retired' })).toEqual([16]);
  });

  it('hledá podle řady a čísla bez záměny 1 a 14, i bez diakritiky', () => {
    expect(sorted(ids({ query: 'kopaničká 1' }))).toEqual([10, 11, 12, 13]);
    expect(ids({ query: 'kopanicka 14' })).toEqual([19]);
    expect(sorted(ids({ query: 'kopanicka vesta' }))).toEqual([12, 18]);
  });

  it('hledá podle vypůjčitele, poznámky a kompletu', () => {
    expect(ids({ query: 'anna mala' })).toEqual([4]);
    expect(ids({ query: 'nevypraná' })).toEqual([15]);
    expect(ids({ query: 'HČ ženský 2' }).length).toBe(4);
  });

  it('filtruje podle řady, druhu, stavu a kompletu (0 = bez kompletu)', () => {
    expect(sorted(ids({ kitId: 0 }))).toEqual([14, 15, 17, 18, 19]);
    expect(sorted(ids({ seriesId: 3, partTypeId: 1 }))).toEqual([14, 15]);
    expect(ids({ status: 'not-ready' })).toEqual([15]);
    expect(sorted(ids({ status: 'on-loan' }))).toEqual([4, 6, 7, 8, 9, 14]);
  });

  it('matchesQuery s prázdným dotazem propustí vše', () => {
    expect(matchesQuery(buildItemRows(state, members)[0], '   ')).toBeTrue();
  });

  it('sestaví CSV s českou hlavičkou a údaji o vypůjčiteli i vyřazení', () => {
    const rows = itemCsvRows(buildItemRows(state, members));
    expect(rows[0]).toEqual(ITEM_CSV_HEADER);
    expect(rows.length).toBe(state.items.length + 1);
    const satek = rows.find((r) => r[2] === 'Šátek' && r[1] === 1 && r[0] === 'Horňácká černá')!;
    expect(satek[6]).toBe('Zapůjčeno');
    expect(satek[7]).toContain('Anička');
    const unnumbered = rows.find((r) => r[1] === 'bez čísla')!;
    expect(unnumbered[2]).toBe('Vesta');
    const retired = rows.find((r) => r[10] === 'roztržená, neopravitelná')!;
    expect(retired[6]).toBe('Vyřazeno');
    expect(retired[9]).toBeTruthy();
  });
});
