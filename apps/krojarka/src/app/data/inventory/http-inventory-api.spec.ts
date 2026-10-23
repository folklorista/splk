import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { HttpInventoryApi } from './http-inventory-api';

/** Exercise the wire contract, including canonical IDs, versions and filter encoding. */
describe('HttpInventoryApi', () => {
  let api: HttpInventoryApi;
  let backend: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), HttpInventoryApi, { provide: API_BASE_URL, useValue: '/v1' }] });
    api = TestBed.inject(HttpInventoryApi); backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('preserves page metadata and sends boolean, date and literal search filters', async () => {
    const result = firstValueFrom(api.items(4, { q: 'košile 17 & 100%', retired: false, acquiredFrom: '2026-01-01', limit: 1, offset: 2 }));
    const request = backend.expectOne((r) => r.url === '/v1/funds/4/items');
    expect(request.request.params.get('q')).toBe('košile 17 & 100%');
    expect(request.request.params.get('retired')).toBe('false');
    expect(request.request.params.get('offset')).toBe('2');
    const page = { items: [], total: 12 }; request.flush(page);
    expect(await result).toEqual(page);
  });

  it('uses canonical item, kit, history, stock and work-order URLs', async () => {
    const reads: [() => Observable<unknown>, string][] = [
      [() => api.item(8), '/v1/items/8'], [() => api.kit(9), '/v1/kits/9'],
      [() => api.history(8), '/v1/items/8/history'], [() => api.workOrders(8), '/v1/items/8/work-orders'],
      [() => api.stocks(4), '/v1/funds/4/bulk-stocks'], [() => api.kits(4), '/v1/funds/4/kits'],
    ];
    for (const [read, path] of reads) { const result = firstValueFrom(read()); const req = backend.expectOne(path); expect(req.request.method).toBe('GET'); req.flush({}); await result; }
  });

  it('sends audited mutations with their versions and composition participants', async () => {
    const writes: [() => Observable<unknown>, string, string, object][] = [
      [() => api.createItem(4, { seriesId: 1, number: null }), '/v1/funds/4/items', 'POST', { seriesId: 1, number: null }],
      [() => api.updateItem(8, { version: 3, note: 'New' }), '/v1/items/8', 'PATCH', { version: 3, note: 'New' }],
      [() => api.retireItem(8, { version: 3, reason: 'Worn' }), '/v1/items/8/retire', 'POST', { version: 3, reason: 'Worn' }],
      [() => api.createStock(4, { partTypeId: 3, quantityTotal: 5 }), '/v1/funds/4/bulk-stocks', 'POST', { partTypeId: 3, quantityTotal: 5 }],
      [() => api.updateStock(5, { quantityTotal: 4 }), '/v1/bulk-stocks/5', 'PATCH', { quantityTotal: 4 }],
      [() => api.createKit(4, { seriesId: 2, number: 'K1' }), '/v1/funds/4/kits', 'POST', { seriesId: 2, number: 'K1' }],
      [() => api.updateKit(9, { version: 2, compositionState: 'incomplete' }), '/v1/kits/9', 'PATCH', { version: 2, compositionState: 'incomplete' }],
      [() => api.composition(9, { version: 2, action: 'move', itemId: 8, itemVersion: 3, targetKitId: 10, targetVersion: 1 }), '/v1/kits/9/composition', 'POST', { version: 2, action: 'move', itemId: 8, itemVersion: 3, targetKitId: 10, targetVersion: 1 }],
      [() => api.createWorkOrder(8, { type: 'repair', description: 'Button' }), '/v1/items/8/work-orders', 'POST', { type: 'repair', description: 'Button' }],
      [() => api.updateWorkOrder(12, { status: 'done' }), '/v1/work-orders/12', 'PATCH', { status: 'done' }],
    ];
    for (const [write, path, method, body] of writes) {
      const result = firstValueFrom(write()); const req = backend.expectOne(path);
      expect(req.request.method).toBe(method); expect(req.request.body).toEqual(body); req.flush({}); await result;
    }
  });

  it('preserves conflict code and current version for feature services', async () => {
    const result = firstValueFrom(api.updateItem(8, { version: 1 })).catch((error: unknown) => error);
    backend.expectOne('/v1/items/8').flush({ error: { code: 'version_conflict', details: { version: 2 } } }, { status: 409, statusText: 'Conflict' });
    expect(await result).toMatchObject({ status: 409, code: 'version_conflict', details: { version: 2 } });
  });
});
