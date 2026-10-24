import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { HttpInventoryApi } from './http-inventory-api';

describe('HttpInventoryApi loans', () => {
  let api: HttpInventoryApi, backend: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), HttpInventoryApi, { provide: API_BASE_URL, useValue: '/v1' }] });
    api = TestBed.inject(HttpInventoryApi); backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());
  it('uses canonical loan endpoints and preserves actual return and loss quantities', async () => {
    const issue = { holder: { personId: 3 }, kitId: 4, omitItemIds: [8], note: 'Without scarf' };
    const returned = { lines: [{ lineId: 9, returnedQty: 0, closeType: 'settled' as const, note: 'Lost' }] };
    const exchange = { lineId: 9, itemId: 8, condition: 'damaged' as const };
    const writes: [() => Observable<unknown>, string, string, object][] = [
      [() => api.issue(1, issue), '/v1/funds/1/loans', 'POST', issue],
      [() => api.returnLoan(7, returned), '/v1/loans/7/return', 'POST', returned],
      [() => api.exchange(7, exchange), '/v1/loans/7/exchange', 'POST', exchange],
      [() => api.updateLoan(7, { dueAt: null }), '/v1/loans/7', 'PATCH', { dueAt: null }],
    ];
    for (const [write, path, method, body] of writes) {
      const result = firstValueFrom(write()), request = backend.expectOne(path);
      expect(request.request.method).toBe(method); expect(request.request.body).toEqual(body);
      request.flush({}); await result;
    }
  });
  it('encodes loan and movement filters, preserves pages and returns stable errors', async () => {
    const list = firstValueFrom(api.loans(1, { open: false, overdue: true, person: 3, holderType: 'external', offset: 2 }));
    const req = backend.expectOne((r) => r.url === '/v1/funds/1/loans');
    expect(req.request.params.get('open')).toBe('false'); expect(req.request.params.get('person')).toBe('3');
    req.flush({ items: [], total: 12 }); expect((await list).total).toBe(12);
    const moves = firstValueFrom(api.movements(1, { from: '2026-10-24T12:00:00+02:00', item: 8 }));
    const movement = backend.expectOne((r) => r.url === '/v1/funds/1/movements');
    expect(movement.request.params.get('from')).toBe('2026-10-24T12:00:00+02:00');
    movement.flush({ items: [], total: 0 }); await moves;
    const detail = firstValueFrom(api.loan(7)).catch((e: unknown) => e);
    backend.expectOne('/v1/loans/7').flush({ error: { code: 'not_found' } }, { status: 404, statusText: 'Not found' });
    expect(await detail).toMatchObject({ status: 404, code: 'not_found' });
  });
});
