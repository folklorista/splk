import { seedCostumeState } from '../data/mock-costumes';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { CostumeState } from '../models/costume.model';
import { borrowerKey, cardGroups, defaultCostumeOf, holdingsOf, inferDefaultCostume, isNumberTaken, itemGenderId, itemLabel, lastSeen, matchesDefaultCostume, nextFreeNumber, seriesStats } from './costume-logic';
import { CostumeRuleError, setDefaultCostume } from './costume-ops';

describe('costume-logic', () => {
  let state: CostumeState;
  beforeEach(() => (state = seedCostumeState(MOCK_MEMBERS)));

  it('kus se identifikuje řadou + číslem; stejné číslo v různých řadách je v pořádku', () => {
    const a = state.items.find((i) => i.seriesId === 1 && i.number === 1)!;
    const b = state.items.find((i) => i.seriesId === 6 && i.number === 1)!;
    expect(itemLabel(state, a)).toBe('Mužské / Horňácko / Košile č. 1');
    expect(itemLabel(state, b)).toBe('Mužské / Kopanice / Košile č. 1');
  });

  it('varianta v klíči řady i jako atribut kusu', () => {
    const inKey = state.items.find((i) => i.seriesId === 10 && i.number === 1)!;
    const attr = state.items.find((i) => i.seriesId === 2 && i.number === 1)!;
    expect(itemLabel(state, inKey)).toBe('Mužské / Slovensko / Gatě modré č. 1');
    expect(itemLabel(state, attr)).toBe('Mužské / Horňácko / Gatě č. 1 (modré)');
  });

  it('mezery v číslování jsou validní a čísla vyřazených kusů se bez pravidla nerecyklují', () => {
    // řada 1: číslo 5 vyřazené, 10 a 13 nikdy nepoužité
    const stats = seriesStats(state, 1);
    expect(stats.retiredNumbers).toEqual([5]);
    expect(stats.unusedNumbers).toEqual([10, 13]);
    expect(isNumberTaken(state, 1, 5)).toBeTrue();
    expect(isNumberTaken(state, 1, 10)).toBeFalse();
    expect(nextFreeNumber(state, 1)).toBe(16);
  });

  it('s výslovným pravidlem řady lze číslo vyřazeného kusu znovu použít', () => {
    state.series.find((s) => s.id === 1)!.allowNumberReuse = true;
    expect(isNumberTaken(state, 1, 5)).toBeFalse();
    expect(nextFreeNumber(state, 1)).toBe(5);
  });

  it('krojová karta seskupí kusy podle kroje a upozorní na chybějící druhy ze šablony', () => {
    // Péťa (id 4): Horňácko (košile, gatě) a Slovensko (košile, gatě modré)
    const groups = cardGroups(state, holdingsOf(state, { kind: 'member', memberId: 4 }));
    const hornacko = groups.find((g) => g.title.startsWith('Horňácko'))!;
    expect(hornacko.title).toBe('Horňácko – mužský kroj');
    expect(hornacko.missing[0].partTypes).toEqual(['Pruclek', 'Klobouk', 'Čižmy']);
    expect(groups.find((g) => g.title.startsWith('Slovensko'))!.missing).toEqual([]);
  });

  it('naposledy fyzicky viděn – nejnovější předložení napříč inventurami', () => {
    const verifiedToday = state.inventoryChecks.find((c) => c.inventoryId === 2 && c.presented)!;
    const seen = lastSeen(state, verifiedToday.itemId)!;
    expect(seen.source).toBe('inventory');
    expect(seen.inventoryId).toBe(2);
  });

  describe('výchozí kroj osoby', () => {
    const male = () => state.items.find((i) => i.seriesId === 1)!;
    const female = () => state.items.find((i) => itemGenderId(state, i) === 'female')!;

    it('pohlaví kusu určuje jeho evidenční řada', () => {
      expect(itemGenderId(state, male())).toBe('male');
      expect(itemGenderId(state, female())).toBe('female');
    });

    it('neurčený výchozí kroj odpovídá všem kusům, určený jen kusům stejného pohlaví', () => {
      expect(matchesDefaultCostume(state, male(), undefined)).toBeTrue();
      expect(matchesDefaultCostume(state, female(), undefined)).toBeTrue();
      expect(matchesDefaultCostume(state, female(), 'female')).toBeTrue();
      expect(matchesDefaultCostume(state, male(), 'female')).toBeFalse();
    });

    it('nastavení a zrušení výchozího kroje pro člena i externistu', () => {
      const member = { kind: 'member' as const, memberId: 999 };
      const external = { kind: 'external' as const, externalId: 1 };
      setDefaultCostume(state, member, 'female');
      setDefaultCostume(state, external, 'male');
      expect(defaultCostumeOf(state, member)).toBe('female');
      expect(defaultCostumeOf(state, external)).toBe('male');
      setDefaultCostume(state, member, undefined);
      expect(defaultCostumeOf(state, member)).toBeUndefined();
      expect(() => setDefaultCostume(state, member, 'nonsense')).toThrowError(CostumeRuleError);
    });

    it('odhad z držených kusů: převažující pohlaví, při shodě neurčeno', () => {
      const borrower = { kind: 'member' as const, memberId: 999 };
      expect(inferDefaultCostume(state, borrower)).toBeUndefined();
      const [m1, m2] = state.items.filter((i) => itemGenderId(state, i) === 'male' && !i.retired && !state.loans.some((l) => l.itemId === i.id && !l.endedAt));
      const f1 = state.items.find((i) => itemGenderId(state, i) === 'female' && !i.retired && !state.loans.some((l) => l.itemId === i.id && !l.endedAt))!;
      const loan = (itemId: number, id: number) => ({ id, ensembleId: 1, itemId, borrower, issuedAt: '2026-01-01', issuedByMemberId: 1 });
      state.loans.push(loan(m1.id, 9001), loan(f1.id, 9002));
      expect(inferDefaultCostume(state, borrower)).toBeUndefined();
      state.loans.push(loan(m2.id, 9003));
      expect(inferDefaultCostume(state, borrower)).toBe('male');
    });

    it('demo data mají výchozí kroj u držitelů s kusy', () => {
      expect(Object.keys(state.defaultCostumes).length).toBeGreaterThan(0);
      for (const key of Object.keys(state.defaultCostumes)) expect(key).toMatch(/^(member|external)-\d+$/);
      expect(borrowerKey({ kind: 'member', memberId: 1 })).toBe('member-1');
    });
  });
});
