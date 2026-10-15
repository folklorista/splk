import { Member } from '../../../../core/models/member.model';
import { seedCostumeState } from '../../data/mock-costumes';
import { CostumeState } from '../../models/costume.model';
import { itemHistory, userName } from './item-history';

describe('itemHistory', () => {
  let state: CostumeState;

  beforeEach(() => (state = seedCostumeState()));

  it('nespojí historii vyřazené součásti a nové součásti se stejným číslem', () => {
    expect(itemHistory(state, 16, []).map((e) => e.text)).toEqual(['Vyřazeno: Košile – horňácká černá 3']);
    expect(itemHistory(state, 17, []).map((e) => e.text)).toEqual(['Založeno: Košile – horňácká černá 3']);
  });

  it('zahrne zápůjčku a vrácení s poznámkou v chronologickém pořadí', () => {
    const history = itemHistory(state, 15, []);
    expect(history.length).toBe(2);
    expect(history[0].text).toContain('Zapůjčeno');
    expect(history[0].loanId).toBe(4);
    expect(history[1].text).toContain('nepřipraveno');
    expect(history[1].note).toBe('vrácena nevypraná');
  });

  it('zahrne vypořádání zápůjčky a inventuru', () => {
    state.loans[2].lines[0].settled = { at: '2030-01-01T00:00:00.000Z', byUserId: 0, note: 'ztraceno' };
    state.inventories.push({
      id: 1,
      name: 'Podzim',
      startedAt: '2030-02-01T00:00:00.000Z',
      startedByUserId: 0,
      lines: [{ key: 'item-14', itemId: 14, expectedCount: 1, result: 'missing', note: 'nenalezeno', checkedAt: '2030-02-02T00:00:00.000Z' }],
    });
    const texts = itemHistory(state, 14, []).map((e) => e.text);
    expect(texts[texts.length - 2]).toContain('vypořádána');
    expect(texts[texts.length - 1]).toBe('Inventura „Podzim“: Chybí');
  });

  it('userName přeloží userId člena na přezdívku', () => {
    const members: Member[] = [
      { id: 1, ensembleId: 1, userId: 7, firstName: 'A', lastName: 'B', nickname: 'Maky', groupIds: [], isAdmin: false, isActive: true, createdAt: '' },
    ];
    expect(userName(members, 7)).toBe('Maky');
    expect(userName(members, 0)).toBe('evidence');
  });
});
