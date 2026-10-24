import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { HttpReportsApi } from './http-reports-api';
describe('HttpReportsApi', () => {
  let api: HttpReportsApi, http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [HttpReportsApi, provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/v1' }] }); api = TestBed.inject(HttpReportsApi); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('keeps fund, identity and filters on JSON and complete CSV requests', async () => {
    const query = { retired: true, acquiredFrom: '2020-01-01' };
    const pending = firstValueFrom(api.report(2, 'series', 7, query)); const json = http.expectOne((r) => r.url === '/v1/funds/2/reports/series/7'); expect(json.request.params.get('retired')).toBe('true'); json.flush({}); await pending;
    const csv = firstValueFrom(api.csv(2, 'series', 7, query)); const binary = http.expectOne((r) => r.url === '/v1/funds/2/reports/series/7'); expect(binary.request.headers.get('Accept')).toBe('text/csv'); expect(binary.request.responseType).toBe('blob'); expect(binary.request.params.get('acquiredFrom')).toBe('2020-01-01'); binary.flush(new Blob(['csv'])); await csv;
  });
  it('encodes literal search text and pagination without broadening the fund', async () => {
    const pending = firstValueFrom(api.search({ q: '100% košile & 03', fund: 2, offset: 50 })); const request = http.expectOne((r) => r.url === '/v1/search'); expect(request.request.params.get('q')).toBe('100% košile & 03'); expect(request.request.params.get('offset')).toBe('50'); expect(request.request.params.get('fund')).toBe('2'); request.flush({ items: [], total: 0 }); await pending;
  });
});
