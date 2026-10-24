import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { CostumeLoan, LoanIssueResult, Page } from '@splk/api-contracts';
import { Fund, FundContext } from '../../core/fund/fund-context';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { PeopleApi } from '../../data/people/people-api';
import { OrganizationApi } from '../../data/organization/organization-api';
import { LoansStore } from './loans.store';

const loan = (unitId = 1): CostumeLoan => ({ id: 3, unitId, holder: { personId: 7 }, kitId: null, issuedAt: '2026-10-24T12:00:00Z', issuedBy: 1, dueAt: null, note: null, replacesLoanId: null, lines: [], returns: [] });
describe('LoansStore', () => {
  let current: ReturnType<typeof signal<Fund | null>>, store: LoansStore;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    current = signal<Fund | null>({ unitId: 1, name: 'Vonica', canManage: true });
    const empty = () => of({ items: [], total: 0 });
    api = { loans: vi.fn(empty), movements: vi.fn(empty), items: vi.fn(empty), stocks: vi.fn(empty), kits: vi.fn(empty), loan: vi.fn(() => of(loan())), issue: vi.fn(() => of({ ...loan(), omittedItemIds: [] })) };
    TestBed.configureTestingModule({ providers: [LoansStore, { provide: FundContext, useValue: { current } }, { provide: InventoryApi, useValue: api },
      { provide: CatalogApi, useValue: { series: () => of([]), partTypes: () => of([]) } }, { provide: PeopleApi, useValue: { people: empty } }, { provide: OrganizationApi, useValue: { units: () => of([]) } }] });
    store = TestBed.inject(LoansStore); TestBed.tick();
  });
  it('fetches all pages and passes validated filters to the adapter', async () => {
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    const rows = Array.from({ length: 201 }, (_, i) => ({ ...loan(), id: i + 1 }));
    api['loans'].mockImplementation((_unit, q) => of({ items: rows.slice(q.offset, q.offset + 200), total: 201 }));
    await store.reload({ overdue: true });
    expect(store.loans()).toHaveLength(201);
    expect(api['loans']).toHaveBeenLastCalledWith(1, { overdue: true, limit: 200, offset: 200 });
  });
  it('drops a late list and detail response after changing funds', async () => {
    const list = new Subject<Page<CostumeLoan>>(), detail = new Subject<CostumeLoan>();
    api['loans'].mockImplementation((unit) => unit === 1 ? list : of({ items: [], total: 0 }));
    api['loan'].mockReturnValue(detail);
    const pendingList = store.reload(), pendingDetail = store.openLoan(3);
    current.set({ unitId: 2, name: 'Other', canManage: false }); TestBed.tick();
    list.next({ items: [loan()], total: 1 }); list.complete(); detail.next(loan()); detail.complete();
    await Promise.all([pendingList, pendingDetail]);
    expect(store.loans()).toEqual([]); expect(store.detail()).toBeNull(); expect(store.canManage()).toBe(false);
  });
  it('rejects writes without a mandate and prevents overlapping handovers', async () => {
    current.set({ unitId: 1, name: 'Vonica', canManage: false }); TestBed.tick();
    await expect(store.issue({ holder: { personId: 7 }, items: [4] })).rejects.toMatchObject({ code: 'forbidden' });
    current.set({ unitId: 1, name: 'Vonica', canManage: true }); TestBed.tick();
    const result = new Subject<LoanIssueResult>(); api['issue'].mockReturnValue(result);
    const pending = store.issue({ holder: { personId: 7 }, items: [4] });
    await expect(store.issue({ holder: { personId: 7 }, items: [4] })).rejects.toMatchObject({ code: 'validation_failed' });
    result.next({ ...loan(), omittedItemIds: [] }); result.complete(); await pending;
    expect(store.busy()).toBe(false);
  });
  it('rejects a foreign detail and a late successful write in a different context', async () => {
    api['loan'].mockReturnValue(of(loan(2))); await store.openLoan(3);
    expect(store.detail()).toBeNull(); expect(store.error()).toBeTruthy();
    const response = new Subject<LoanIssueResult>(); api['issue'].mockReturnValue(response);
    const pending = store.issue({ holder: { personId: 7 }, items: [4] });
    current.set({ unitId: 2, name: 'Other', canManage: true }); TestBed.tick();
    response.next({ ...loan(), omittedItemIds: [] }); response.complete();
    await expect(pending).rejects.toMatchObject({ code: 'not_found' });
    expect(store.loans()).toEqual([]);
  });
});
