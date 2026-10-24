import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { InventoryDetail } from '@splk/api-contracts';
import { inventoryProgress } from '@splk/domain';
import { Fund, FundContext } from '../../core/fund/fund-context';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { PeopleApi } from '../../data/people/people-api';
import { OrganizationApi } from '../../data/organization/organization-api';
import { InventoriesStore } from './inventories.store';

const header = (unitId = 1, version = 1): InventoryDetail => ({ id: 7, unitId, name: 'Autumn', scope: {}, status: 'open', version,
  startedAt: '2026-10-24T12:00:00Z', startedBy: 1, closedAt: null, closedBy: null, closedWithIssues: false, closeReason: null, resultSnapshot: null, progress: inventoryProgress([], []) });
describe('InventoriesStore', () => {
  let current: ReturnType<typeof signal<Fund | null>>, store: InventoriesStore, api: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    current = signal<Fund | null>({ unitId: 1, name: 'Vonica', canManage: true }); const empty = () => of({ items: [], total: 0 });
    api = { inventories: vi.fn(empty), inventory: vi.fn(() => of(header())), inventoryCollection: vi.fn(empty), createInventory: vi.fn(() => of(header())),
      inventoryPreview: vi.fn(() => of({ scope: {}, progress: inventoryProgress([], []), unloanedItemCount: 0 })), closeInventory: vi.fn(() => of(header())),
      items: vi.fn(empty), stocks: vi.fn(empty), kits: vi.fn(empty) };
    TestBed.configureTestingModule({ providers: [InventoriesStore, { provide: FundContext, useValue: { current } }, { provide: InventoryApi, useValue: api },
      { provide: CatalogApi, useValue: { series: () => of([]), partTypes: () => of([]), regions: () => of([]) } },
      { provide: PeopleApi, useValue: { people: empty } }, { provide: OrganizationApi, useValue: { units: () => of([]), groupOptions: () => of([]) } }] });
    store = TestBed.inject(InventoriesStore); TestBed.tick();
  });
  it('loads complete paginated lists and collections before presenting a stable detail', async () => {
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    api['inventories'].mockImplementation((_unit, q) => of({ items: q.offset === 0 ? [header()] : [{ ...header(), id: 8 }], total: 2 }));
    await store.reload(); expect(store.inventories()).toHaveLength(2);
    expect(api['inventories']).toHaveBeenLastCalledWith(1, { limit: 200, offset: 1 });
    await store.open(7); expect(store.detail()?.id).toBe(7); expect(store.detailLoading()).toBe(false);
  });
  it('retries a read when the inventory version changes between its collection requests', async () => {
    api['inventory'].mockReturnValueOnce(of(header(1, 1))).mockReturnValueOnce(of(header(1, 2))).mockReturnValue(of(header(1, 2)));
    await store.open(7); expect(store.detail()?.version).toBe(2); expect(api['inventory']).toHaveBeenCalledTimes(4);
    expect(api['inventoryCollection']).toHaveBeenCalledTimes(12);
  });
  it('rejects a detail in another fund before requesting its collections', async () => {
    api['inventory'].mockReturnValue(of(header(2))); await store.open(7);
    expect(store.detail()).toBeNull(); expect(api['inventoryCollection']).not.toHaveBeenCalled(); expect(store.error()).toBeTruthy();
  });
  it('discards a late detail and preview after switching funds', async () => {
    const response = new Subject<InventoryDetail>(), preview = new Subject<{ scope: {}; progress: InventoryDetail['progress']; unloanedItemCount: number }>();
    api['inventory'].mockReturnValue(response); api['inventoryPreview'].mockReturnValue(preview);
    const pending = store.open(7), pendingPreview = store.showPreview({});
    current.set({ unitId: 2, name: 'Other', canManage: false }); TestBed.tick();
    response.next(header()); response.complete(); preview.next({ scope: {}, progress: header().progress, unloanedItemCount: 0 }); preview.complete();
    await Promise.all([pending, pendingPreview]); expect(store.detail()).toBeNull(); expect(store.preview()).toBeNull(); expect(store.targets()).toEqual([]);
  });
  it('refuses writes and preview for readers before calling an adapter', async () => {
    current.set({ unitId: 1, name: 'Vonica', canManage: false }); TestBed.tick();
    await expect(store.create({ name: 'No', scope: {} })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(store.showPreview({})).rejects.toMatchObject({ code: 'forbidden' });
    expect(api['createInventory']).not.toHaveBeenCalled(); expect(api['inventoryPreview']).not.toHaveBeenCalled();
  });
  it('serializes writes, sends the loaded version and rejects a late success in another fund', async () => {
    await store.open(7); const response = new Subject<InventoryDetail>(); api['closeInventory'].mockReturnValue(response);
    const pending = store.close({ closedWithIssues: false });
    expect(api['closeInventory']).toHaveBeenCalledWith(7, { version: 1, closedWithIssues: false });
    await expect(store.close({ closedWithIssues: false })).rejects.toMatchObject({ code: 'validation_failed' });
    current.set({ unitId: 2, name: 'Other', canManage: true }); TestBed.tick(); response.next(header()); response.complete();
    await expect(pending).rejects.toMatchObject({ code: 'not_found' }); expect(store.detail()).toBeNull(); expect(store.busy()).toBe(false);
  });
});
