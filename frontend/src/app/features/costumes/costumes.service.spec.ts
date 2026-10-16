import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CostumeRuleError, CostumesService } from './costumes.service';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { CostumeState, Loan } from './models/costume.model';
import { clearDemoData } from '../../core/data/demo-storage';
import { isLoanOpen, itemStatus, kitIssueCandidates, kitView, lineRemaining, nextFreeNumber } from './utils/costume-logic';

describe('CostumesService', () => {
  let service: CostumesService;
  const state = (): CostumeState => service.snapshot;
  const item = (id: number) => state().items.find((i) => i.id === id)!;
  const kit = (id: number) => state().kits.find((k) => k.id === id)!;

  let canManage = true;

  beforeEach(() => {
    clearDemoData();
    canManage = true;
    TestBed.configureTestingModule({
      providers: [{ provide: AccessService, useValue: { memberId: () => 9, canManageCostumes: () => canManage } }],
    });
    service = TestBed.inject(CostumesService);
  });

  afterEach(() => clearDemoData());

  function run<T>(obs: import('rxjs').Observable<T>): { value?: T; error?: unknown } {
    const result: { value?: T; error?: unknown } = {};
    obs.subscribe({ next: (v) => (result.value = v), error: (e) => (result.error = e) });
    tick(1000);
    return result;
  }

  it('bez pověření Správa krojů zápis odmítne', fakeAsync(() => {
    canManage = false;
    const denied = run(service.createItem({ seriesId: 2, number: 99, partTypeId: 1 }));
    expect(denied.error).toEqual(jasmine.any(AccessDeniedError));
  }));

  it('dovolí stejné číslo v různých řadách, ale ne v jedné řadě (A)', fakeAsync(() => {
    const ok = run(service.createItem({ seriesId: 2, number: 2, partTypeId: 1 }));
    expect(ok.error).toBeUndefined();
    const dup = run(service.createItem({ seriesId: 2, number: 2, partTypeId: 3 }));
    expect(dup.error).toEqual(jasmine.any(CostumeRuleError));
  }));

  it('po vyřazení uvolní číslo a nová součást nepřebírá historii (A)', fakeAsync(() => {
    // košile horňácká černá 3 (id 16) je vyřazená, číslo 3 má nová košile (id 17)
    expect(item(16).retired).toBeTruthy();
    expect(item(17).number).toBe(3);
    const retire = run(service.retireItem(17, 'test'));
    expect(retire.error).toBeUndefined();
    expect(nextFreeNumber(state(), 1)).toBe(3);
    const created = run(service.createItem({ seriesId: 1, number: 3, partTypeId: 1 }));
    expect(created.value!.id).not.toBe(17);
    expect(state().log.filter((l) => l.itemId === created.value!.id).length).toBe(1);
  }));

  it('samostatně půjčený šátek dělá komplet neúplným, ale nadále do něj patří (C)', () => {
    const view = kitView(state(), kit(1));
    const satek = view.items.find((i) => i.item.id === 4)!;
    expect(satek.separateLoan).toBeTruthy();
    expect(satek.item.kitId).toBe(1);
    expect(view.completeness).toBe('incomplete');
  });

  it('předání kompletu nezahrne šátek půjčený někomu jinému (D)', fakeAsync(() => {
    const candidates = kitIssueCandidates(state(), kit(1));
    expect(candidates.items.map((i) => i.id)).not.toContain(4);
    expect(candidates.exceptions.length).toBeGreaterThan(0);

    const loan = run(service.issueLoan({
      borrower: { kind: 'member', memberId: 1 },
      kitId: 1,
      itemIds: candidates.items.map((i) => i.id),
      bulk: candidates.bulk.map((b) => ({ ...b, kitId: 1 })),
      issuedAt: new Date().toISOString(),
      longTerm: false,
    })).value!;
    expect(loan.lines.some((l) => l.itemId === 4)).toBeFalse();
    expect(kit(1).bulk[0].present).toBe(0);
  }));

  it('nepovolí předat věc, která je už zapůjčená', fakeAsync(() => {
    const result = run(service.issueLoan({
      borrower: { kind: 'member', memberId: 2 },
      itemIds: [4],
      bulk: [],
      issuedAt: new Date().toISOString(),
      longTerm: false,
    }));
    expect(result.error).toEqual(jasmine.any(CostumeRuleError));
    // chyba nezmění stav
    expect(state().loans.length).toBe(4);
  }));

  it('seznam předaných věcí se nemění pozdější změnou složení kompletu (B)', fakeAsync(() => {
    const before = state().loans.find((l) => l.id === 2)!.lines.length;
    run(service.createItem({ seriesId: 1, number: 9, partTypeId: 5, kitId: 2 }));
    expect(state().loans.find((l) => l.id === 2)!.lines.length).toBe(before);
  }));

  it('částečné vrácení nechá zápůjčku otevřenou a uloží poznámky po řádcích (E, K)', fakeAsync(() => {
    run(service.returnLoan(2, [
      { lineId: 1, count: 1, note: 'vrácena nevypraná', ready: false },
      { lineId: 2, count: 1, ready: true },
      { lineId: 3, count: 1, ready: true },
    ]));
    const loan: Loan = state().loans.find((l) => l.id === 2)!;
    expect(isLoanOpen(loan)).toBeTrue();
    expect(loan.lines[0].returns[0].note).toBe('vrácena nevypraná');
    expect(item(6).ready).toBeFalse();
    expect(itemStatus(state(), item(6))).toBe('not-ready');
    expect(lineRemaining(loan.lines[3])).toBe(1);
  }));

  it('mašle bez čísla – vrácení 1 ze 2 vrátí kus do kompletu (J)', fakeAsync(() => {
    const issued = run(service.issueLoan({
      borrower: { kind: 'member', memberId: 3 },
      itemIds: [],
      bulk: [{ kitId: 1, partTypeId: 6, count: 2 }],
      issuedAt: new Date().toISOString(),
      longTerm: false,
    })).value!;
    expect(kit(1).bulk[0].present).toBe(0);
    run(service.returnLoan(issued.id, [{ lineId: 1, count: 1, ready: true, note: 'jeden kus chybí' }]));
    expect(kit(1).bulk[0].present).toBe(1);
    expect(lineRemaining(state().loans.find((l) => l.id === issued.id)!.lines[0])).toBe(1);
  }));

  it('nedovolí vrátit víc kusů, než je zapůjčeno', fakeAsync(() => {
    const result = run(service.returnLoan(2, [{ lineId: 5, count: 2, ready: true }]));
    expect(result.error).toEqual(jasmine.any(CostumeRuleError));
  }));

  it('zapůjčenou součást nelze vyřadit bez vypořádání zápůjčky', fakeAsync(() => {
    expect(run(service.retireItem(4, 'ztráta')).error).toEqual(jasmine.any(CostumeRuleError));
    expect(run(service.retireItem(4, 'ztráta', true)).error).toBeUndefined();
    expect(state().loans.find((l) => l.id === 1)!.lines[0].settled).toBeTruthy();
  }));

  it('přesun do jiného kompletu zapíše kdo a kdy změnil složení', fakeAsync(() => {
    run(service.moveItemToKit(14, 3, 'doplnění'));
    const entries = state().log.filter((l) => l.itemId === 14);
    expect(entries.length).toBe(1);
    expect(entries[0].kitId).toBe(3);
    expect(entries[0].byUserId).toBe(9);
  }));

  it('inventura zachytí očekávaný stav a pozdější zápůjčka ho nepřepíše (H)', fakeAsync(() => {
    const inventory = run(service.startInventory('Podzim')).value!;
    const satek = inventory.lines.find((l) => l.itemId === 4)!;
    expect(satek.holder).toEqual({ kind: 'member', memberId: 4 });
    run(service.recordInventoryCheck(inventory.id, satek.key, { result: 'ok', note: 'ověřeno osobně' }));
    run(service.returnLoan(1, [{ lineId: 1, count: 1, ready: true }]));
    const stored = state().inventories[0].lines.find((l) => l.itemId === 4)!;
    expect(stored.holder).toEqual({ kind: 'member', memberId: 4 });
    expect(stored.result).toBe('ok');
    run(service.closeInventory(inventory.id));
    expect(run(service.recordInventoryCheck(inventory.id, satek.key, {})).error).toEqual(jasmine.any(CostumeRuleError));
  }));
});
