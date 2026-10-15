import { seedCostumeState } from '../data/mock-costumes';
import { Member } from '../../../core/models/member.model';
import {
  borrowerLabel,
  holdingsOf,
  inventoryProgress,
  isLoanOverdue,
  isNumberTaken,
  itemLabel,
  kitView,
  parseBorrowerKey,
  borrowerKey,
} from './costume-logic';

describe('costume-logic', () => {
  const state = seedCostumeState();

  it('označí součást řadou a číslem', () => {
    expect(itemLabel(state, state.items[0])).toBe('Košile – horňácká černá 1');
  });

  it('vyřazená součást nedrží číslo', () => {
    expect(isNumberTaken(state, 1, 3, 17)).toBeFalse();
    expect(isNumberTaken(state, 1, 3)).toBeTrue();
  });

  it('po termínu jen otevřené krátkodobé zápůjčky', () => {
    const [satek, kit, external, returned] = state.loans;
    expect(isLoanOverdue(external)).toBeTrue();
    expect(isLoanOverdue(satek)).toBeFalse();
    expect(isLoanOverdue(kit)).toBeFalse();
    expect(isLoanOverdue(returned)).toBeFalse();
  });

  it('komplet svěřený celý není kvůli tomu neúplný; chybějící mašle ano', () => {
    const view = kitView(state, state.kits[1]);
    expect(view.kitLoan?.id).toBe(2);
    expect(view.items.every((i) => i.withKitLoan)).toBeTrue();
    // 2 požadované, 1 u vypůjčitelky, 1 vrácena do kompletu? ne – present 0, takže 1 chybí
    expect(view.bulk[0].loanedWithKit).toBe(1);
    expect(view.bulk[0].missing).toBe(1);
    expect(view.completeness).toBe('incomplete');
  });

  it('přehled držených věcí osoby', () => {
    expect(holdingsOf(state, { kind: 'member', memberId: 1 }).length).toBe(5);
    expect(holdingsOf(state, { kind: 'member', memberId: 5 }).length).toBe(0);
  });

  it('bývalý člen a externista jsou v popisku rozlišeni', () => {
    const members = [{ id: 6, nickname: 'Mára', firstName: 'Marek', lastName: 'K.', isActive: false } as Member];
    expect(borrowerLabel({ kind: 'member', memberId: 6 }, members, [])).toContain('bývalý člen');
    expect(borrowerLabel({ kind: 'external', externalId: 1 }, [], state.externals)).toContain('externista');
  });

  it('klíč vypůjčitele jde převést tam a zpět', () => {
    const borrower = { kind: 'external', externalId: 3 } as const;
    expect(parseBorrowerKey(borrowerKey(borrower))).toEqual(borrower);
    expect(parseBorrowerKey('nesmysl')).toBeUndefined();
  });

  it('průběh inventury rozlišuje nezkontrolované a mimo sklad', () => {
    const progress = inventoryProgress({
      id: 1, name: 'x', startedAt: '', startedByUserId: 0,
      lines: [
        { key: 'a', expectedCount: 1, result: 'ok' },
        { key: 'b', expectedCount: 1, holder: { kind: 'member', memberId: 1 } },
        { key: 'c', expectedCount: 1, result: 'missing' },
      ],
    });
    expect(progress).toEqual(jasmine.objectContaining({ total: 3, checked: 2, unchecked: 1, outside: 1, outsideUnchecked: 1, missing: 1 }));
  });
});
