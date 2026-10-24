import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { CostumeInventory } from '@splk/api-contracts';
import { Fund, FundContext } from '../../core/fund/fund-context';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { InventoryOperationStore } from './inventory-operation.store';

const header: CostumeInventory = { id: 7, unitId: 1, name: 'Autumn', scope: {}, status: 'open', version: 1,
  startedAt: '2026-10-24T12:00:00Z', startedBy: 1, closedAt: null, closedBy: null, closedWithIssues: false, closeReason: null, resultSnapshot: null };
function setup(query: Record<string, string> = {}) {
  const params = new BehaviorSubject(convertToParamMap(query)), current = signal<Fund | null>({ unitId: 1, name: 'Vonica', canManage: true });
  const api = { inventory: vi.fn(() => of(header)) };
  TestBed.configureTestingModule({ providers: [InventoryOperationStore, { provide: ActivatedRoute, useValue: { queryParamMap: params } },
    { provide: FundContext, useValue: { current } }, { provide: InventoryApi, useValue: api }] });
  const store = TestBed.inject(InventoryOperationStore); TestBed.tick(); return { store, params, current, api };
}
describe('InventoryOperationStore', () => {
  it('does not invent an inventory context on ordinary routes', async () => {
    const { store, api } = setup(); await store.reload(); expect(store.values()).toEqual({}); expect(api.inventory).not.toHaveBeenCalled();
  });
  it('adds the loaded version and advances it only for the committed operation', async () => {
    const { store } = setup({ inventoryId: '7' }); await store.reload();
    const values = store.values(); expect(values).toEqual({ inventoryId: 7, inventoryVersion: 1 }); store.committed(values); store.committed(values);
    expect(store.values()).toEqual({ inventoryId: 7, inventoryVersion: 2 });
  });
  it('blocks a newly requested context before its effect has loaded it', async () => {
    const { store, params } = setup(); await store.reload(); params.next(convertToParamMap({ inventoryId: '7' }));
    expect(() => store.values()).toThrow(); expect(store.blocked()).toBe(true);
    await store.reload(); expect(store.values().inventoryId).toBe(7);
  });
  it('refuses closed, malformed and foreign contexts without silently falling back to ordinary writes', async () => {
    const { store, params, api } = setup({ inventoryId: '7' }); api.inventory.mockReturnValue(of({ ...header, status: 'closed' })); await store.reload();
    expect(() => store.values()).toThrow('inventory_closed');
    api.inventory.mockReturnValue(of({ ...header, unitId: 2 })); await store.reload(); expect(() => store.values()).toThrow('not_found');
    params.next(convertToParamMap({ inventoryId: '0' })); await store.reload(); expect(() => store.values()).toThrow('not_found');
    params.next(convertToParamMap({})); await store.reload(); expect(store.values()).toEqual({});
  });
  it('drops a late successful context load after the fund changes', async () => {
    const { store, current, api } = setup({ inventoryId: '7' }); const response = new Subject<CostumeInventory>(); api.inventory.mockReturnValue(response);
    const pending = store.reload(); current.set({ unitId: 2, name: 'Other', canManage: true }); TestBed.tick();
    response.next(header); response.complete(); await pending; expect(store.inventory()).toBeNull(); expect(store.blocked()).toBe(true);
  });
});
