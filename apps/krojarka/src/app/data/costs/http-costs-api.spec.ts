import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { HttpCostsApi } from './http-costs-api';
describe('HttpCostsApi', () => {
  let api: HttpCostsApi, http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [HttpCostsApi, provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/v1' }] }); api = TestBed.inject(HttpCostsApi); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('keeps amounts as strings, scopes writes and preserves the edited version', async () => {
    const input = { spentOn: '2026-10-24', amount: '-12345678901234.1234', currency: 'EUR', description: 'Credit' };
    const created = firstValueFrom(api.create(2, input)); const post = http.expectOne('/v1/funds/2/costs'); expect(post.request.method).toBe('POST'); expect(post.request.body.amount).toBe(input.amount); post.flush({}); await created;
    const edited = firstValueFrom(api.update(7, { ...input, version: 3, links: [] })); const patch = http.expectOne('/v1/costs/7'); expect(patch.request.method).toBe('PATCH'); expect(patch.request.body.version).toBe(3); expect(patch.request.body.links).toEqual([]); patch.flush({}); await edited;
  });
  it('reads the cost-specific fund scope and filtered totals', async () => {
    const funds = firstValueFrom(api.funds()); http.expectOne('/v1/costs/funds').flush({ items: [{ unitId: 2, canManage: false }] }); expect((await funds)[0].canManage).toBe(false);
    const list = firstValueFrom(api.list({ unitId: 2, currency: 'EUR', from: '2020-01-01', offset: 50 })); const request = http.expectOne((r) => r.url === '/v1/costs'); expect(request.request.params.get('unitId')).toBe('2'); expect(request.request.params.get('currency')).toBe('EUR'); expect(request.request.params.get('offset')).toBe('50'); request.flush({ items: [], totals: [], total: 0 }); await list;
  });
  it('requests CSV and unwraps binary permission errors without losing their code', async () => {
    const pending = firstValueFrom(api.csv({ currency: 'CZK' })).catch((e: unknown) => e); const request = http.expectOne((r) => r.url === '/v1/costs'); expect(request.request.headers.get('Accept')).toBe('text/csv'); expect(request.request.responseType).toBe('blob');
    request.flush(new Blob([JSON.stringify({ error: { code: 'forbidden' } })], { type: 'application/json' }), { status: 403, statusText: 'Forbidden' }); expect(await pending).toMatchObject({ status: 403, code: 'forbidden' });
  });
});
