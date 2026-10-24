import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import type { CostInput, CostumeCost } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { CostsApi } from '../../data/costs/costs-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { ApiError } from '../../data/api-error';
import { CostsStore } from './costs.store';
const cost = (unit = 1): CostumeCost => ({ id: unit, unitId: unit, spentOn: '2026-10-24', amount: '100.0000', currency: 'CZK', supplier: null, documentRef: null, description: 'Purchase', purpose: null, links: [], createdAt: '2026-10-24T10:00:00Z', createdBy: 1, updatedAt: '2026-10-24T10:00:00Z', updatedBy: 1, version: 1 });
const input: CostInput = { spentOn: '2026-10-24', amount: '-25.1234', currency: 'EUR', description: 'Credit' };
describe('CostsStore', () => {
  let store: CostsStore, api: Record<string, ReturnType<typeof vi.fn>>, inventory: Record<string, ReturnType<typeof vi.fn>>, user: ReturnType<typeof signal<object | null>>;
  beforeEach(() => {
    user = signal<object | null>({ account: { id: 1 } });
    api = { funds: vi.fn(() => of([{ unitId: 1, name: 'Fund', archived: false, canManage: true }, { unitId: 2, name: 'Other', archived: false, canManage: false }])), list: vi.fn((q) => of({ items: [cost(q.unitId ?? 1)], total: 1, totals: [{ currency: 'CZK', amount: '100.0000', count: 1 }] })), detail: vi.fn((id) => of(cost(id))), create: vi.fn(() => of(cost())), update: vi.fn(() => of(cost())), csv: vi.fn(() => of(new Blob(['csv']))) };
    inventory = Object.fromEntries(['items', 'kits', 'stocks'].map((key) => [key, vi.fn(() => of({ items: [], total: 0 }))]));
    TestBed.configureTestingModule({ providers: [CostsStore, { provide: AuthService, useValue: { user } }, { provide: CostsApi, useValue: api }, { provide: InventoryApi, useValue: inventory }, { provide: CatalogApi, useValue: { series: () => of([]), partTypes: () => of([]) } }] });
    store = TestBed.inject(CostsStore); TestBed.tick();
  });
  const loaded = async () => { await vi.waitFor(() => expect(store.rows()).toHaveLength(1)); };
  it('shows linked details to readers without loading unrelated inventory or allowing edits', async () => {
    await loaded(); await store.open(cost(2)); expect(store.detail()?.unitId).toBe(2); expect(store.editor()).toBeNull(); expect(inventory['items']).not.toHaveBeenCalled(); expect(await store.save(input)).toBe(false); expect(api['update']).not.toHaveBeenCalled();
  });
  it('keeps the version from edit start and preserves the editor on conflict', async () => {
    await loaded(); await store.open(cost()); store.rows.set([{ ...cost(), version: 2 }]); api['update'].mockReturnValueOnce(throwError(() => new ApiError(409, 'version_conflict')));
    expect(await store.save(input)).toBe(false); expect(api['update']).toHaveBeenCalledWith(1, { ...input, version: 1 }); expect(store.editor()?.cost?.version).toBe(1); expect(store.error()).toBeTruthy();
  });
  it('ignores a completed write after switching to another fund', async () => {
    await loaded(); store.query.set({ unitId: 1 }); TestBed.tick(); await loaded(); await store.open();
    const delayed = new Subject<CostumeCost>(); api['create'].mockReturnValueOnce(delayed); const pending = store.save(input); store.query.set({ unitId: 2 }); TestBed.tick(); await loaded();
    delayed.next(cost()); delayed.complete(); expect(await pending).toBe(false); expect(store.rows()[0].unitId).toBe(2); expect(store.editor()).toBeNull(); expect(store.notice()).toBe(''); expect(store.busy()).toBe(false);
  });
  it('clears sensitive state on logout and ignores the earlier list', async () => {
    await loaded(); const delayed = new Subject<{ items: CostumeCost[]; total: number; totals: [] }>(); api['list'].mockReturnValueOnce(delayed); const pending = store.load(); user.set(null); TestBed.tick(); delayed.next({ items: [cost()], total: 1, totals: [] }); delayed.complete(); await pending; expect(store.rows()).toEqual([]); expect(store.funds()).toEqual([]); expect(store.total()).toBe(0);
  });
  it('exports the complete filter without paging and ignores a late export in a new context', async () => {
    await loaded(); store.query.set({ unitId: 1, currency: 'EUR', offset: 50 }); TestBed.tick(); await loaded(); const delayed = new Subject<Blob>(); api['csv'].mockReturnValueOnce(delayed); vi.spyOn(URL, 'createObjectURL');
    const pending = store.csv(); expect(api['csv']).toHaveBeenCalledWith({ unitId: 1, currency: 'EUR' }); store.query.set({ unitId: 2 }); TestBed.tick(); delayed.next(new Blob(['old'])); delayed.complete(); await pending; expect(URL.createObjectURL).not.toHaveBeenCalled(); vi.restoreAllMocks();
  });
  it('does not trigger a download after leaving and destroying the cost screen', async () => {
    await loaded(); const delayed = new Subject<Blob>(); api['csv'].mockReturnValueOnce(delayed); vi.spyOn(URL, 'createObjectURL'); const pending = store.csv();
    TestBed.resetTestingModule(); delayed.next(new Blob(['old'])); delayed.complete(); await pending; expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(store.rows()).toEqual([]); vi.restoreAllMocks();
  });
  it('returns to the last existing page when an edited cost leaves the filtered page', async () => {
    await loaded(); api['list'].mockImplementation((q) => of({ items: q.offset ? [] : [cost()], total: 50, totals: [] })); store.query.set({ offset: 50 }); TestBed.tick();
    await vi.waitFor(() => expect(store.query().offset).toBe(0)); TestBed.tick(); await loaded(); expect(api['list']).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
  });
  it('rejects returned costs outside the authorized fund metadata', async () => {
    await loaded(); api['list'].mockReturnValueOnce(of({ items: [cost(99)], total: 1, totals: [] })); store.query.set({ unitId: 2 }); TestBed.tick(); await vi.waitFor(() => expect(store.error()).toBeTruthy()); expect(store.rows()).toEqual([]);
  });
});
