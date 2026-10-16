import { Member } from '../../../../core/models/member.model';
import { seedCostumeState } from '../../data/mock-costumes';
import { Loan } from '../../models/costume.model';
import { openLines } from '../../utils/costume-logic';
import {
  OPEN_LINES_CSV_HEADER,
  borrowerOptions,
  dateInputToIso,
  filterBorrowers,
  filterLoans,
  initialReturnRows,
  lineLabel,
  loanPieces,
  matchesSearch,
  openLinesCsvRows,
  remainingAfterReturn,
  toReturnInputs,
  todayInputValue,
} from './loan-utils';

describe('loan-utils', () => {
  const member = (id: number, nickname: string, isActive = true): Member => ({
    id, ensembleId: 1, userId: id, firstName: '', lastName: '', nickname, groupIds: [], isActive, createdAt: '',
  });
  const members = [member(1, 'Anička'), member(4, 'Lojza'), member(5, 'Bára', false)];
  const state = seedCostumeState();
  const label = (b: Loan['borrower']) => (b.kind === 'member' ? members.find((m) => m.id === b.memberId)?.nickname ?? '' : 'Marie Dvořáková');
  const ids = (loans: Loan[]) => loans.map((l) => l.id).sort();

  describe('filterLoans', () => {
    it('otevřené vynechá uzavřené zápůjčky', () => {
      expect(ids(filterLoans(state.loans, 'open', '', label))).toEqual([1, 2, 3]);
    });

    it('po termínu vrátí jen krátkodobé s uplynulým termínem', () => {
      expect(ids(filterLoans(state.loans, 'overdue', '', label))).toEqual([3]);
    });

    it('všechny + hledání bez diakritiky', () => {
      expect(ids(filterLoans(state.loans, 'all', '', label))).toEqual([1, 2, 3, 4]);
      expect(ids(filterLoans(state.loans, 'all', 'anicka', label))).toEqual([2]);
    });
  });

  it('matchesSearch ignoruje velikost písmen a diakritiku', () => {
    expect(matchesSearch('Marie Dvořáková', 'DVORAK')).toBeTrue();
    expect(matchesSearch('Marie', 'x')).toBeFalse();
  });

  it('loanPieces počítá kusy u vypůjčitele', () => {
    const loan = state.loans.find((l) => l.id === 2)!;
    expect(loanPieces(loan)).toEqual({ held: 5, total: 6 });
  });

  it('lineLabel rozliší číslovanou součást a neočíslované kusy', () => {
    const loan = state.loans.find((l) => l.id === 2)!;
    expect(lineLabel(state, loan.lines[0])).toBe('Košile – horňácká černá 2');
    expect(lineLabel(state, loan.lines[4])).toBe('Úzká mašle do vlasů – 2 ks');
  });

  it('openLinesCsvRows vytvoří řádek za každý otevřený řádek zápůjčky', () => {
    const rows = openLinesCsvRows(state, members, openLines(state));
    expect(rows[0]).toEqual(OPEN_LINES_CSV_HEADER);
    expect(rows.length).toBe(1 + 7);
    const bulk = rows.find((r) => r[2] === 'Úzká mašle do vlasů')!;
    expect(bulk[1]).toBe('HČ ženský 2');
    expect(bulk[3]).toBe('1');
    expect(bulk[5]).toBe('');
    expect(bulk[6]).toBe('ano');
    const external = rows.find((r) => r[0].includes('externista'))!;
    expect(external[7]).toBe('hostování na hodech v Hradčovicích');
  });

  describe('formulář vrácení', () => {
    const loan = state.loans.find((l) => l.id === 2)!;

    it('předvyplní všechny otevřené řádky jako vrácené a připravené', () => {
      const rows = initialReturnRows(loan);
      expect(rows.length).toBe(5);
      expect(rows.every((r) => r.returned && r.ready)).toBeTrue();
      expect(rows.find((r) => r.lineId === 5)!.count).toBe(1);
      expect(remainingAfterReturn(rows)).toBe(0);
    });

    it('nezaškrtnuté řádky zůstávají v zápůjčce, poznámka a připravenost se předají', () => {
      const rows = initialReturnRows(loan);
      rows[0].note = '  vrácena nevypraná ';
      rows[0].ready = false;
      rows[1].returned = false;
      rows[4].count = 0;
      const inputs = toReturnInputs(rows);
      expect(inputs).toEqual([
        { lineId: 1, count: 1, note: 'vrácena nevypraná', ready: false },
        { lineId: 3, count: 1, note: undefined, ready: true },
        { lineId: 4, count: 1, note: undefined, ready: true },
      ]);
      expect(remainingAfterReturn(rows)).toBe(2);
    });

    it('počet kusů omezí na zbývající', () => {
      const rows = initialReturnRows(loan);
      rows[4].count = 7;
      expect(toReturnInputs(rows).find((r) => r.lineId === 5)!.count).toBe(1);
    });
  });

  it('borrowerOptions řadí aktivní, bývalé a externisty', () => {
    const options = borrowerOptions(state, members);
    expect(options.map((o) => o.group)).toEqual(['member', 'member', 'former', 'external']);
    expect(options[2].label).toContain('bývalý člen');
    expect(options[3].key).toBe('external-1');
  });

  it('filterBorrowers podle skupiny', () => {
    const borrowers = [
      { kind: 'member' as const, memberId: 1 },
      { kind: 'member' as const, memberId: 5 },
      { kind: 'external' as const, externalId: 1 },
    ];
    expect(filterBorrowers(borrowers, 'all', members).length).toBe(3);
    expect(filterBorrowers(borrowers, 'member', members)).toEqual([borrowers[0]]);
    expect(filterBorrowers(borrowers, 'former', members)).toEqual([borrowers[1]]);
    expect(filterBorrowers(borrowers, 'external', members)).toEqual([borrowers[2]]);
  });

  it('datum z formuláře zachová den', () => {
    const iso = dateInputToIso('2026-10-15');
    expect(todayInputValue(new Date(iso))).toBe('2026-10-15');
  });
});
