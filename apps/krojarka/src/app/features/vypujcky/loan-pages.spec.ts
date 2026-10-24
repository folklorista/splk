import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { CostumeItem, CostumeLoan, KitDetail, PersonCard } from '@splk/api-contracts';
import { LoansStore } from './loans.store';
import { IssuePage } from './issue-page';
import { LoanPage } from './loan-page';

const item = (id: number): CostumeItem => ({ id, unitId: 1, seriesId: id, number: String(id), variant: null, size: null, description: null, note: null, condition: 'ok', issuable: true, location: 'unknown', locationNote: null, acquiredOn: null, kitId: null, retiredAt: null, retiredBy: null, retireReason: null, version: 1, available: true, holder: null, loanId: null, loanKitId: null });
const loan = (): CostumeLoan => ({ id: 3, unitId: 1, holder: { personId: 7 }, kitId: null, issuedAt: '2026-10-24T12:00:00Z', issuedBy: 1, dueAt: null, note: null, replacesLoanId: null, returns: [], lines: [{ id: 9, label: 'Shirt 1', region: null, gender: 'male', itemId: 1, bulkStockId: null, qty: 1, returnedQty: 0, closedAt: null, closedBy: null, closeType: null, closeNote: null }] });

describe('Loan page logic', () => {
  let store: ReturnType<typeof fakeStore>;
  const navigate = vi.fn(async () => true);
  function fakeStore() { return {
    fund: signal({ unitId: 1, name: 'Vonica', canManage: true }), canManage: signal(true), loading: signal(false), busy: signal(false), error: signal(null), previewLoading: signal(false), detailLoading: signal(false),
    items: signal([item(1), item(2), item(3)]), series: signal([{ id: 1, gender: 'male' }, { id: 2, gender: 'female' }, { id: 3, gender: null }]), partTypes: signal([]), stocks: signal([]), kits: signal([]), people: signal([]), units: signal([]),
    preview: signal<KitDetail | null>(null), detail: signal<CostumeLoan | null>(loan()), holderCard: signal<PersonCard | null>({ person: { id: 7, firstName: 'Eva', lastName: 'Test', nickname: null, affiliations: [], contact: null, contactVisible: true, defaultCostume: 'female' }, profile: null, openLoans: { items: [], total: 0 }, movements: { items: [], total: 0 } }),
    openLoan: vi.fn(async () => undefined), selectPerson: vi.fn(async () => undefined), openKit: vi.fn(async () => undefined), reload: vi.fn(async () => undefined),
    issue: vi.fn(async () => ({ ...loan(), omittedItemIds: [] })), returnLoan: vi.fn(async () => loan()), exchange: vi.fn(async () => ({ ...loan(), id: 4, omittedItemIds: [] })), update: vi.fn(async () => loan()),
    itemLabel: (id: number) => `Item ${id}`, stockLabel: (id: number) => `Stock ${id}`, kitLabel: (id: number) => `Kit ${id}`, holderLabel: () => 'Eva Test',
  }; }
  beforeEach(() => {
    store = fakeStore(); navigate.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: LoansStore, useValue: store }, { provide: Router, useValue: { navigate } }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) }, paramMap: of(convertToParamMap({ id: '3' })) } }] });
    // Test behavior, not presentation; the production build checks the complete templates.
    TestBed.overrideComponent(IssuePage, { set: { template: '' } }); TestBed.overrideComponent(LoanPage, { set: { template: '' } });
  });
  it('defaults the offer by costume preference but allows an opposite-costume handover', async () => {
    const fixture = TestBed.createComponent(IssuePage); fixture.detectChanges(); const page = fixture.componentInstance;
    expect(page.offeredItems().map((i) => i.id)).toEqual([2, 3]);
    page.opposite = true; expect(page.offeredItems().map((i) => i.id)).toEqual([1, 2, 3]);
    page.holderId = 7; page.selected.add(1); page.review(); await page.submit();
    expect(store.issue).toHaveBeenCalledWith(expect.objectContaining({ holder: { personId: 7 }, items: [1] }));
  });
  it('requires an explicit review and sends the kit snapshot version and all exceptions', async () => {
    const fixture = TestBed.createComponent(IssuePage); fixture.detectChanges(); const page = fixture.componentInstance;
    await page.submit(); expect(store.issue).not.toHaveBeenCalled();
    store.preview.set({ holder: null, loanId: null, id: 5, unitId: 1, seriesId: 4, number: 'K1', note: null, description: null, compositionState: 'unverified', retiredAt: null, version: 8, items: [item(1), { ...item(2), available: false }], bulkLines: [{ id: 6, bulkStockId: 10, requiredQty: 2, presentQty: 2 }], changes: [] });
    fixture.detectChanges(); page.holderId = 7; page.mode = 'kit'; page.kitId = 5; page.bulk[10] = 1; page.note = 'Exceptions'; page.review(); await page.submit();
    expect(store.issue).toHaveBeenCalledWith(expect.objectContaining({ kitId: 5, kitVersion: 8, omitItemIds: [2], kitBulk: [{ stockId: 10, qty: 1 }] }));
  });
  it('clears a reviewed handover on a fund change', async () => {
    const fixture = TestBed.createComponent(IssuePage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.holderId = 7; page.selected.add(1); page.review(); expect(page.reviewed).toBe(true);
    store.fund.set({ unitId: 2, name: 'Other', canManage: true }); fixture.detectChanges();
    expect(page.reviewed).toBe(false); expect(page.selected.size).toBe(0); await page.submit(); expect(store.issue).not.toHaveBeenCalled();
  });
  it('does not preselect returns and represents a loss without a fictional physical return', async () => {
    const fixture = TestBed.createComponent(LoanPage); fixture.detectChanges(); const page = fixture.componentInstance;
    expect(page.returnInput().lines).toEqual([]);
    const line = store.detail()!.lines[0]; page.drafts[line.id].selected = true; page.drafts[line.id].type = 'settled'; page.changeType(line); page.drafts[line.id].note = 'Lost';
    expect(page.returnInput().lines[0]).toEqual({ lineId: 9, returnedQty: 0, closeType: 'settled', note: 'Lost' });
    page.reviewReturn(); await page.confirmReturn(); expect(store.returnLoan).toHaveBeenCalledWith(3, { lines: [{ lineId: 9, returnedQty: 0, closeType: 'settled', note: 'Lost' }] });
  });
  it('requires the original piece to be presented before an exchange', async () => {
    const fixture = TestBed.createComponent(LoanPage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.exchangeLine = 9; page.replacement = 2; await page.exchange(); expect(store.exchange).not.toHaveBeenCalled();
    page.presented = true; await page.exchange(); expect(store.exchange).toHaveBeenCalledWith(3, expect.objectContaining({ lineId: 9, itemId: 2 }));
    expect(navigate).toHaveBeenCalledWith(['/vypujcky', 4], { queryParamsHandling: 'preserve' });
  });
  it('restores actual outstanding quantities when selecting all after drafting a loss', () => {
    const fixture = TestBed.createComponent(LoanPage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.drafts[9].type = 'settled'; page.drafts[9].qty = 0; page.selectAll();
    expect(page.returnInput().lines[0]).toMatchObject({ closeType: 'returned', returnedQty: 1 });
  });
});
