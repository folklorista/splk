import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { CostumeItem, Page } from '@splk/api-contracts';
import { Fund, FundContext } from '../../core/fund/fund-context';
import { ApiError } from '../../data/api-error';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { InventoryStore } from './inventory.store';

const item = (id: number, unitId = 1): CostumeItem => ({ id, unitId, seriesId: 1, number: String(id), variant: null, size: null, description: null,
  note: null, condition: 'ok', issuable: true, location: 'unknown', locationNote: null, acquiredOn: null, kitId: null,
  retiredAt: null, retiredBy: null, retireReason: null, version: 1 });

describe('InventoryStore', () => {
  let current: ReturnType<typeof signal<Fund | null>>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InventoryStore;
  beforeEach(() => {
    current = signal<Fund | null>({ unitId: 1, name: 'Vonica', canManage: true });
    api = { items: vi.fn((_unit, q) => of({ items: q.retired ? [] : [item(1, _unit)], total: q.retired ? 0 : 1 })),
      stocks: vi.fn(() => of({ items: [], total: 0 })), kits: vi.fn(() => of({ items: [], total: 0 })),
      item: vi.fn(() => of(item(1))), history: vi.fn(() => of({ items: [], total: 0 })), workOrders: vi.fn(() => of({ items: [], total: 0 })),
      createItem: vi.fn(() => of(item(9))), updateItem: vi.fn(() => throwError(() => new ApiError(409, 'version_conflict'))) };
    TestBed.configureTestingModule({ providers: [InventoryStore, { provide: FundContext, useValue: { current } }, { provide: InventoryApi, useValue: api },
      { provide: CatalogApi, useValue: { series: () => of([]), partTypes: () => of([]), regions: () => of([]) } }] });
    store = TestBed.inject(InventoryStore); TestBed.tick();
  });

  it('loads every page, including retired pieces', async () => {
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    const rows = Array.from({ length: 201 }, (_, index) => item(index + 1));
    api['items'].mockImplementation((_unit, q) => of(q.retired ? { items: [], total: 0 } : { items: rows.slice(q.offset, q.offset + 200), total: 201 }));
    await store.reload();
    expect(store.items()).toHaveLength(201);
    expect(api['items']).toHaveBeenCalledWith(1, { limit: 200, offset: 200 });
  });

  it('clears previous fund data immediately and ignores its late list response', async () => {
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    const old = new Subject<Page<CostumeItem>>();
    api['items'].mockImplementation((unit, q) => unit === 1 && !q.retired ? old : of({ items: [], total: 0 }));
    const pending = store.reload();
    current.set({ unitId: 2, name: 'Other', canManage: false }); TestBed.tick();
    expect(store.items()).toEqual([]);
    old.next({ items: [item(8)], total: 1 }); old.complete();
    await pending;
    expect(store.items()).toEqual([]); expect(store.canManage()).toBe(false);
  });

  it('ignores late errors and late details after a fund change', async () => {
    const old = new Subject<CostumeItem>(); api['item'].mockReturnValue(old);
    const pending = store.openItem(1);
    current.set({ unitId: 2, name: 'Other', canManage: true }); TestBed.tick();
    old.error(new ApiError(404, 'not_found')); await pending;
    expect(store.item()).toBeNull(); expect(store.error()).toBeNull();
  });

  it('rejects canonical details belonging to another selected fund', async () => {
    api['item'].mockReturnValue(of(item(5, 2)));
    await store.openItem(5);
    expect(store.item()).toBeNull(); expect(store.history()).toEqual([]); expect(store.error()).toContain('přístup');
  });

  it('keeps the most recently selected detail when requests finish in reverse order', async () => {
    const old = new Subject<CostumeItem>(); api['item'].mockImplementation((id) => id === 1 ? old : of(item(id)));
    const pending = store.openItem(1); await store.openItem(2);
    old.next(item(1)); old.complete(); await pending;
    expect(store.item()?.id).toBe(2);
  });

  it('prevents writes in read-only mode and rethrows conflicts without replacing loaded data', async () => {
    await store.openItem(1);
    await expect(store.updateItem(1, { version: 1, note: 'Draft' })).rejects.toMatchObject({ code: 'version_conflict' });
    expect(store.item()?.note).toBeNull(); expect(store.busy()).toBe(false);
    current.set({ unitId: 1, name: 'Vonica', canManage: false }); TestBed.tick();
    await expect(store.createItem({ seriesId: 1, number: null })).rejects.toMatchObject({ code: 'forbidden' });
    expect(api['createItem']).not.toHaveBeenCalled();
  });

  it('does not apply a successful write after the user switches funds', async () => {
    const response = new Subject<CostumeItem>(); api['createItem'].mockReturnValue(response);
    const write = store.createItem({ seriesId: 1, number: null }).catch((error: unknown) => error);
    current.set({ unitId: 2, name: 'Other', canManage: true }); TestBed.tick();
    response.next(item(9)); response.complete();
    expect(await write).toMatchObject({ code: 'not_found' });
    expect(store.items().every((i) => i.unitId === 2)).toBe(true);
  });

  it('reports a refresh failure without presenting a committed write as failed', async () => {
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    api['items'].mockReturnValue(throwError(() => new ApiError(0, 'network_error')));
    await expect(store.createItem({ seriesId: 1, number: null })).resolves.toMatchObject({ id: 9 });
    expect(api['createItem']).toHaveBeenCalledTimes(1); expect(store.error()).toContain('spojit');
  });
});
