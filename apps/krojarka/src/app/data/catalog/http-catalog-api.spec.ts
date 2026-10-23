import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { HttpCatalogApi } from './http-catalog-api';

describe('HttpCatalogApi', () => {
  let api: HttpCatalogApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpCatalogApi, { provide: API_BASE_URL, useValue: 'https://api.test/v1' }],
    });
    api = TestBed.inject(HttpCatalogApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('scopes every call by fund', async () => {
    const list = firstValueFrom(api.series(3));
    backend.expectOne('https://api.test/v1/funds/3/series').flush({ items: [{ id: 1 }] });
    expect(await list).toEqual([{ id: 1 }]);

    const update = firstValueFrom(api.updatePartType(3, 8, { archived: true }));
    const request = backend.expectOne('https://api.test/v1/funds/3/part-types/8');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ archived: true });
    request.flush({ id: 8 });
    await update;
  });

  it('maps errors to ApiError', async () => {
    const result = firstValueFrom(api.createRegion(3, { name: 'X', parentId: null })).catch((e) => e);
    backend.expectOne('https://api.test/v1/funds/3/regions').flush({ error: { code: 'forbidden', message: '' } }, { status: 403, statusText: '' });

    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('forbidden');
  });
});
