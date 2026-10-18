import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { CostumesService, CostumeRuleError } from './costumes.service';
import { InventoryService } from './inventory.service';
import { CostumeStoreService } from './costume-store.service';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { clearDemoData } from '../../core/data/demo-storage';
import { MOCK_MEMBERS } from '../members/data/mock-members';
import { emptyScope } from './models/inventory.model';
import { inventoryProgress, itemInventoryState, activeChecks, resolveScope } from './utils/inventory-logic';
import { openLoanFor, openLoans } from './utils/costume-logic';

describe('CostumesService + InventoryService', () => {
  let costumes: CostumesService;
  let inventories: InventoryService;
  let store: CostumeStoreService;
  let canManage = true;
  let memberId = 9;
  let isAdmin = false;

  const state = () => store.snapshot;
  const itemId = (seriesId: number, number: number) => state().items.find((i) => i.seriesId === seriesId && i.number === number && !i.retired)!.id;
  const kopanice = () => state().inventories.find((i) => i.name.startsWith('Ženské Kopanice'))!;
  const musicians = () => state().inventories.find((i) => i.name === 'Kroje muzikantů')!;

  function run<T>(obs: Observable<T>): { value?: T; error?: unknown } {
    const result: { value?: T; error?: unknown } = {};
    obs.subscribe({ next: (v) => (result.value = v), error: (e) => (result.error = e) });
    tick(1000);
    return result;
  }

  beforeEach(() => {
    clearDemoData();
    canManage = true;
    memberId = 9;
    isAdmin = false;
    TestBed.configureTestingModule({
      providers: [{ provide: AccessService, useValue: { memberId: () => memberId, canManageCostumes: () => canManage, isEnsembleAdmin: () => isAdmin } }],
    });
    costumes = TestBed.inject(CostumesService);
    inventories = TestBed.inject(InventoryService);
    store = TestBed.inject(CostumeStoreService);
  });

  afterEach(() => clearDemoData());

  it('bez pověření Správa krojů zápis odmítne', fakeAsync(() => {
    canManage = false;
    expect(run(costumes.createItem({ seriesId: 1, number: 50 })).error).toEqual(jasmine.any(AccessDeniedError));
    expect(run(inventories.recordCheck({ inventoryId: kopanice().id, itemId: itemId(18, 10), presented: true, mode: 'stock' })).error).toEqual(jasmine.any(AccessDeniedError));
  }));

  it('výchozí kroj smí nastavit i Správa souboru, ale ne běžný člen; vydávat kusy Správa souboru nesmí', fakeAsync(() => {
    const borrower = { kind: 'member' as const, memberId: 4 };
    canManage = false;
    expect(run(costumes.setDefaultCostume(borrower, 'female')).error).toEqual(jasmine.any(AccessDeniedError));
    isAdmin = true;
    expect(run(costumes.setDefaultCostume(borrower, 'female')).error).toBeUndefined();
    expect(state().defaultCostumes['member-4']).toBe('female');
    expect(run(costumes.issueItems({ borrower, itemIds: [itemId(1, 1)] })).error).toEqual(jasmine.any(AccessDeniedError));
  }));

  it('číslo vyřazeného kusu nelze bez pravidla řady znovu přidělit', fakeAsync(() => {
    expect(run(costumes.createItem({ seriesId: 1, number: 5 })).error).toEqual(jasmine.any(CostumeRuleError));
    expect(run(costumes.createItem({ seriesId: 1, number: 10 })).error).toBeUndefined();
  }));

  it('jeden kus nelze zapůjčit dvěma lidem', fakeAsync(() => {
    const loaned = itemId(18, 3);
    const result = run(costumes.issueItems({ borrower: { kind: 'member', memberId: 4 }, itemIds: [loaned] }));
    expect(result.error).toEqual(jasmine.any(CostumeRuleError));
    expect(openLoans(state()).filter((l) => l.itemId === loaned).length).toBe(1);
  }));

  it('výměna s předložením vrátí původní kus a vydá dostupný kus; historie zůstane', fakeAsync(() => {
    const original = openLoanFor(state(), itemId(18, 3))!;
    const res = run(costumes.exchangeItem({ loanId: original.id, originalReturned: true, newItemId: itemId(18, 10) }));
    expect(res.error).toBeUndefined();
    expect(state().loans.find((l) => l.id === original.id)!.endReason).toBe('exchanged');
    expect(openLoanFor(state(), itemId(18, 10))!.replacesLoanId).toBe(original.id);
    expect(state().items.find((i) => i.id === itemId(18, 3))!.location).toBe('store');
  }));

  it('výměna bez předložení původní kus nevrátí ani neověří', fakeAsync(() => {
    const original = openLoanFor(state(), itemId(18, 3))!;
    run(costumes.exchangeItem({ loanId: original.id, originalReturned: false, newItemId: itemId(18, 10), inventoryId: kopanice().id }));
    expect(openLoanFor(state(), itemId(18, 3))?.id).toBe(original.id);
    expect(itemInventoryState(activeChecks(state(), kopanice().id), itemId(18, 3)).verified).toBeFalse();
  }));

  it('výměna nezmění zmrazený rozsah ani nezpůsobí dvojí započítání', fakeAsync(() => {
    const before = inventoryProgress(state(), kopanice()).total;
    const original = openLoanFor(state(), itemId(18, 3))!;
    run(costumes.exchangeItem({ loanId: original.id, originalReturned: true, newItemId: itemId(1, 1) }));
    expect(inventoryProgress(state(), kopanice()).total).toBe(before);
  }));

  it('člen se přihlásí sám jen jako dotčený a kapacita termínu se dodržuje', fakeAsync(() => {
    canManage = false;
    const inv = kopanice();
    // Péťa se inventury netýká
    memberId = 4;
    expect(run(inventories.bookSlot(inv.id, 2)).error).toEqual(jasmine.any(CostumeRuleError));
    // Evička (7) je dotčená, ale první termín je plný
    memberId = 7;
    expect(run(inventories.bookSlot(inv.id, 1)).error).toEqual(jasmine.any(CostumeRuleError));
    const ok = run(inventories.bookSlot(inv.id, 3));
    expect(ok.error).toBeUndefined();
    expect(ok.value!.borrower).toEqual({ kind: 'member', memberId: 7 });
    // Člen nemůže přihlásit někoho jiného
    expect(run(inventories.bookSlot(inv.id, 3, { kind: 'member', memberId: 1 })).error).toEqual(jasmine.any(AccessDeniedError));
  }));

  it('rychlé zadání potvrdí jen bezproblémové kusy a opakované nezapočítá', fakeAsync(() => {
    const inv = kopanice();
    const res = run(inventories.quickEntry(inv.id, 18, '10, 12, 3, 99'))!.value!;
    expect(res.results.map((r) => r.outcome)).toEqual(['verified', 'verified', 'on-loan', 'unknown']);
    const again = run(inventories.quickEntry(inv.id, 18, '10'))!.value!;
    expect(again.results[0].outcome).toBe('duplicate');
    expect(activeChecks(state(), inv.id).filter((c) => c.itemId === itemId(18, 10)).length).toBe(1);
  }));

  it('dokončení návštěvy s nepředloženým kusem je možné, kus zůstává otevřený', fakeAsync(() => {
    const inv = kopanice();
    const visit = run(inventories.startVisit(inv.id, { kind: 'member', memberId: 1 })).value!;
    run(inventories.recordCheck({ inventoryId: inv.id, itemId: itemId(18, 3), presented: true, condition: 'damaged', mode: 'person', visitId: visit.id }));
    run(inventories.recordCheck({ inventoryId: inv.id, itemId: itemId(19, 5), presented: false, mode: 'person', visitId: visit.id }));
    expect(run(inventories.completeVisit(visit.id)).error).toBeUndefined();
    const checks = activeChecks(state(), inv.id);
    expect(itemInventoryState(checks, itemId(18, 3)).verified).toBeTrue();
    expect(state().items.find((i) => i.id === itemId(18, 3))!.condition).toBe('damaged');
    expect(itemInventoryState(checks, itemId(19, 5)).state).toBe('not-presented');
  }));

  it('kus mimo rozsah se nepřidá potichu, jen výslovně s poznámkou', fakeAsync(() => {
    const inv = kopanice();
    const outside = itemId(1, 1);
    expect(run(inventories.recordCheck({ inventoryId: inv.id, itemId: outside, presented: true, mode: 'stock' })).error).toEqual(jasmine.any(CostumeRuleError));
    expect(run(inventories.addItem(inv.id, outside, '')).error).toEqual(jasmine.any(CostumeRuleError));
    expect(run(inventories.addItem(inv.id, outside, 'nalezeno v kopaničké krabici')).error).toBeUndefined();
    expect(run(inventories.recordCheck({ inventoryId: inv.id, itemId: outside, presented: true, mode: 'stock' })).error).toBeUndefined();
  }));

  it('uzavření s nesrovnalostmi jen výslovně s důvodem; rekapitulace netvrdí úplnost', fakeAsync(() => {
    const inv = musicians();
    expect(run(inventories.closeInventory(inv.id, { acceptDiscrepancies: false })).error).toEqual(jasmine.any(CostumeRuleError));
    expect(run(inventories.closeInventory(inv.id, { acceptDiscrepancies: true, reason: ' ' })).error).toEqual(jasmine.any(CostumeRuleError));
    const closed = run(inventories.closeInventory(inv.id, { acceptDiscrepancies: true, reason: 'klobouk dořešíme' })).value!;
    expect(closed.closure!.withDiscrepancies).toBeTrue();
    expect(closed.closure!.verified).toBeLessThan(closed.closure!.total);
  }));

  it('založení inventury zmrazí rozsah; prázdný rozsah odmítne', fakeAsync(() => {
    const scope = { ...emptyScope(), regionIds: ['zalesi'] };
    const created = run(inventories.createInventory({ name: 'Zálesí', scope, scopeLabel: 'Zálesí' }, MOCK_MEMBERS)).value!;
    expect(created.targetItemIds).toEqual(resolveScope(state(), scope, MOCK_MEMBERS).itemIds);
    run(costumes.createItem({ seriesId: 22, number: 4 }));
    expect(state().inventories.find((i) => i.id === created.id)!.targetItemIds.length).toBe(created.targetItemIds.length);
    const empty = run(inventories.createInventory({ name: 'x', scope: { ...emptyScope(), regionIds: ['zalesi'], genderIds: ['male'], partTypeIds: [1] }, scopeLabel: '' }, MOCK_MEMBERS));
    expect(empty.error).toEqual(jasmine.any(CostumeRuleError));
  }));
});
