import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { API_BASE_URL } from '../api-config';
import { HttpInventoryApi } from './http-inventory-api';

describe('HTTP inventory workflows', () => {
  it('preserves version, explicit physical results, pagination and canonical endpoint paths', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), HttpInventoryApi, { provide: API_BASE_URL, useValue: '/v1' }] });
    const api = TestBed.inject(HttpInventoryApi), http = TestBed.inject(HttpTestingController);
    const checks = { version: 2, mode: 'people' as const, personId: 3, entries: [{ targetId: 4, result: 'not_presented' as const }] };
    const writes: [() => Observable<unknown>, string, string, object][] = [
      [() => api.inventoryPreview(1, { groupId: 7 }), '/v1/funds/1/inventories/preview', 'POST', { scope: { groupId: 7 } }],
      [() => api.createInventory(1, { name: 'Autumn', scope: {} }), '/v1/funds/1/inventories', 'POST', { name: 'Autumn', scope: {} }],
      [() => api.addInventoryTarget(2, { version: 1, itemId: 3, note: 'New' }), '/v1/inventories/2/targets', 'POST', { version: 1, itemId: 3, note: 'New' }],
      [() => api.checkInventory(2, checks), '/v1/inventories/2/checks', 'POST', checks],
      [() => api.updateInventorySlot(2, 5, { version: 3, capacity: 4 }), '/v1/inventories/2/slots/5', 'PATCH', { version: 3, capacity: 4 }],
      [() => api.createInventoryVisit(2, { version: 3, personId: 8 }), '/v1/inventories/2/visits', 'POST', { version: 3, personId: 8 }],
      [() => api.updateInventoryVisit(2, 9, { version: 4, status: 'completed' }), '/v1/inventories/2/visits/9', 'PATCH', { version: 4, status: 'completed' }],
      [() => api.closeInventory(2, { version: 5, closedWithIssues: true, reason: 'Unresolved' }), '/v1/inventories/2/close', 'POST', { version: 5, closedWithIssues: true, reason: 'Unresolved' }],
    ];
    for (const [write, path, method, body] of writes) { const result = firstValueFrom(write()), req = http.expectOne(path); expect(req.request.method).toBe(method); expect(req.request.body).toEqual(body); req.flush({}); await result; }
    const page = firstValueFrom(api.inventoryCollection(2, 'workOrders', { limit: 10, offset: 5 })), req = http.expectOne((r) => r.url === '/v1/inventories/2/work-orders');
    expect(req.request.params.get('offset')).toBe('5'); req.flush({ items: [], total: 15 }); expect((await page).total).toBe(15);
    const undo = firstValueFrom(api.cancelInventoryCheck(7, 8)), deletion = http.expectOne('/v1/inventory-checks/7?version=8'); expect(deletion.request.method).toBe('DELETE'); deletion.flush({}); await undo;
    http.verify();
  });
});
