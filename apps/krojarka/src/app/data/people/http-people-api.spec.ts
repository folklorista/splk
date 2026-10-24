import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { HttpPeopleApi } from './http-people-api';

describe('HttpPeopleApi', () => {
  let api: HttpPeopleApi, backend: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), HttpPeopleApi, { provide: API_BASE_URL, useValue: '/v1' }] }); api = TestBed.inject(HttpPeopleApi); backend = TestBed.inject(HttpTestingController); });
  afterEach(() => backend.verify());
  it('scopes profile reads and writes by fund, leaving shared identity global', async () => {
    const list = firstValueFrom(api.people({ fund: 2, paperState: 'paper', q: 'Jan & Jana', limit: 20 }));
    const req = backend.expectOne((r) => r.url === '/v1/people'); expect(req.request.params.get('fund')).toBe('2'); expect(req.request.params.get('q')).toBe('Jan & Jana'); req.flush({ items: [], total: 0 }); await list;
    const card = firstValueFrom(api.card(2, 8)); backend.expectOne('/v1/funds/2/people/8/card').flush({}); await card;
    const profile = firstValueFrom(api.profile(2, 8, { paperState: 'paper', note: 'Own shoes' }));
    const write = backend.expectOne('/v1/funds/2/people/8/profile'); expect(write.request.method).toBe('PUT'); expect(write.request.body).toEqual({ paperState: 'paper', note: 'Own shoes' }); write.flush({}); await profile;
    const identity = firstValueFrom(api.update(8, { contact: '555' })); const patch = backend.expectOne('/v1/people/8'); expect(patch.request.method).toBe('PATCH'); expect(patch.request.body).toEqual({ contact: '555' }); patch.flush({}); await identity;
  });
  it('preserves duplicate candidates for explicit user confirmation', async () => {
    const result = firstValueFrom(api.create({ firstName: 'Jan', lastName: 'Novák' })).catch((e: unknown) => e);
    const req = backend.expectOne('/v1/people'); expect(req.request.method).toBe('POST'); expect(req.request.body.confirmDuplicate).toBeUndefined();
    req.flush({ error: { code: 'possible_duplicate', details: { people: [{ id: 1 }] } } }, { status: 422, statusText: 'Invalid' });
    expect(await result).toMatchObject({ code: 'possible_duplicate', details: { people: [{ id: 1 }] } });
  });
});
