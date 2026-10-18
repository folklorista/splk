import { seedCostumeState } from '../data/mock-costumes';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { CostumeState } from '../models/costume.model';
import { Inventory, InventoryCheck, emptyScope } from '../models/inventory.model';
import {
  canCloseCleanly,
  classifyQuickEntry,
  inventoryProgress,
  isEligibleForBooking,
  itemInventoryState,
  parseNumberInput,
  resolveScope,
  stockGroups,
} from './inventory-logic';
import { itemClassification, openLoanFor } from './costume-logic';

describe('inventory-logic', () => {
  let state: CostumeState;
  const itemIdOf = (seriesId: number, number: number) => state.items.find((i) => i.seriesId === seriesId && i.number === number && !i.retired)!.id;

  beforeEach(() => (state = seedCostumeState(MOCK_MEMBERS)));

  describe('resolveScope', () => {
    it('celý fond zahrne zapůjčené i nezapůjčené kusy, ale ne vyřazené', () => {
      const r = resolveScope(state, emptyScope(), MOCK_MEMBERS);
      expect(r.itemIds.length).toBe(state.items.filter((i) => !i.retired).length);
      expect(r.loanedCount).toBeGreaterThan(0);
      expect(r.unloanedCount).toBeGreaterThan(0);
    });

    it('filtr klasifikace je průnik (ženské + Kopanice)', () => {
      const r = resolveScope(state, { ...emptyScope(), genderIds: ['female'], regionIds: ['kopanice'] }, MOCK_MEMBERS);
      expect(r.itemIds.length).toBeGreaterThan(0);
      for (const id of r.itemIds) {
        const cls = itemClassification(state, state.items.find((i) => i.id === id)!);
        expect(cls.genderId).toBe('female');
        expect(cls.regionId).toBe('kopanice');
      }
    });

    it('skupina zahrne jen kusy zapůjčené jejím členům, ne skladové zásoby', () => {
      const r = resolveScope(state, { ...emptyScope(), groupIds: [GROUP_IDS.muzika] }, MOCK_MEMBERS);
      const musicians = MOCK_MEMBERS.filter((m) => m.groupIds.includes(GROUP_IDS.muzika)).map((m) => m.id);
      expect(r.unloanedCount).toBe(0);
      for (const id of r.itemIds) {
        const loan = openLoanFor(state, id)!;
        expect(loan.borrower.kind === 'member' && musicians.includes(loan.borrower.memberId)).toBeTrue();
      }
    });

    it('skupina × klasifikace = jen odpovídající výpůjčky lidí ze skupiny', () => {
      const group = resolveScope(state, { ...emptyScope(), groupIds: [GROUP_IDS.muzika] }, MOCK_MEMBERS);
      const both = resolveScope(state, { ...emptyScope(), groupIds: [GROUP_IDS.muzika], regionIds: ['slovensko'] }, MOCK_MEMBERS);
      expect(both.itemIds.length).toBeGreaterThan(0);
      expect(both.itemIds.length).toBeLessThan(group.itemIds.length);
      expect(both.itemIds.every((id) => group.itemIds.includes(id))).toBeTrue();
    });

    it('člen ve více skupinách ani kus se nezapočítají dvakrát', () => {
      const r = resolveScope(state, { ...emptyScope(), groupIds: [GROUP_IDS.muzika, GROUP_IDS.tanecni, GROUP_IDS.kluci] }, MOCK_MEMBERS);
      expect(new Set(r.itemIds).size).toBe(r.itemIds.length);
      expect(new Set(r.holders.map((h) => JSON.stringify(h))).size).toBe(r.holders.length);
    });
  });

  describe('parseNumberInput', () => {
    it('čte čísla a rozsahy s různými oddělovači', () => {
      expect(parseNumberInput('1, 3 7;12-15').numbers).toEqual([1, 3, 7, 12, 13, 14, 15]);
      expect(parseNumberInput('4 – 6').numbers).toEqual([4, 5, 6]);
    });

    it('hlásí nečíselné tokeny, obrácené a příliš velké rozsahy', () => {
      const r = parseNumberInput('x, 9-3, 1-5000');
      expect(r.numbers).toEqual([]);
      expect(r.errors.length).toBe(3);
    });
  });

  describe('classifyQuickEntry', () => {
    let inv: Inventory;
    beforeEach(() => (inv = state.inventories.find((i) => i.name.startsWith('Ženské Kopanice'))!));

    it('rozliší ověřený, duplicitní, neexistující, vyřazený, zapůjčený a mimo sklad vedený kus', () => {
      // řada 18 = ženské / Kopanice / rukávce: 1 už ověřeno, 3 zapůjčeno, 6 u švadleny, 7 vyřazeno, 99 neexistuje
      const results = classifyQuickEntry(state, inv, 18, [10, 1, 3, 6, 7, 99, 10]);
      expect(results.map((r) => r.outcome)).toEqual(['verified', 'duplicate', 'on-loan', 'away', 'retired', 'unknown', 'repeated']);
    });

    it('kus mimo zmrazený rozsah se nepotvrdí', () => {
      const results = classifyQuickEntry(state, inv, 1, [1]);
      expect(results[0].outcome).toBe('out-of-scope');
    });
  });

  describe('ověření a pokrytí', () => {
    const check = (id: number, presented: boolean, at: string): InventoryCheck => ({ id, inventoryId: 1, itemId: 5, at, byMemberId: 1, mode: 'stock', presented });

    it('opakované kontroly se do pokrytí počítají jednou; nepředložení fyzicky viděný kus neodznačí', () => {
      const s = itemInventoryState([check(1, true, '2026-01-01'), check(2, true, '2026-01-02'), check(3, false, '2026-01-03')], 5);
      expect(s.verified).toBeTrue();
      expect(itemInventoryState([check(1, false, '2026-01-01')], 5).state).toBe('not-presented');
      expect(itemInventoryState([], 5).state).toBe('unchecked');
    });

    it('skupinová inventura muzikantů: návštěvy dokončené, ale nepředložený kus brání čistému uzavření', () => {
      const inv = state.inventories.find((i) => i.name === 'Kroje muzikantů')!;
      const p = inventoryProgress(state, inv);
      expect(p.completed).toBe(2);
      expect(p.notPresented).toBe(1);
      expect(p.needsAlteration).toBe(1);
      expect(p.verified).toBe(p.total - 1);
      expect(canCloseCleanly(p)).toBeFalse();
    });

    it('sklad po řadách ukazuje jen nezapůjčené cílové kusy', () => {
      const inv = state.inventories.find((i) => i.name.startsWith('Ženské Kopanice'))!;
      const groups = stockGroups(state, inv);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.every((g) => g.items.every((r) => !openLoanFor(state, r.item.id)))).toBeTrue();
      expect(groups.find((g) => g.series.id === 18)!.items.some((r) => r.item.id === itemIdOf(18, 10))).toBeTrue();
    });

    it('přihlásit se smí jen dotčený člen', () => {
      const inv = state.inventories.find((i) => i.name.startsWith('Ženské Kopanice'))!;
      expect(isEligibleForBooking(state, inv, 1)).toBeTrue(); // Jana drží kopaničké kusy
      expect(isEligibleForBooking(state, inv, 4)).toBeFalse(); // Péťa ne
    });
  });
});
