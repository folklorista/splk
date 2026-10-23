import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { CsrfTokenStore } from '../http/csrf-token.store';
import { HttpAuthApi } from './http-auth-api';

const API = 'https://api.test/v1';

describe('HttpAuthApi', () => {
  let api: HttpAuthApi;
  let backend: HttpTestingController;
  let csrf: CsrfTokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpAuthApi, { provide: API_BASE_URL, useValue: API }],
    });
    api = TestBed.inject(HttpAuthApi);
    backend = TestBed.inject(HttpTestingController);
    csrf = TestBed.inject(CsrfTokenStore);
  });

  afterEach(() => backend.verify());

  it('posts credentials and keeps the CSRF token from the login in memory', async () => {
    const result = firstValueFrom(api.login('a@b.test', 'secret'));
    const request = backend.expectOne(`${API}/auth/login`);
    expect(request.request.body).toEqual({ email: 'a@b.test', password: 'secret' });
    request.flush({ account: {}, person: {}, mandates: [], csrfToken: 'abc' });

    await result;
    expect(csrf.current()).toBe('abc');
  });

  it('forgets the token on logout and on a failed me', async () => {
    csrf.set('abc');
    const logout = firstValueFrom(api.logout());
    backend.expectOne(`${API}/auth/logout`).flush(null, { status: 204, statusText: '' });
    await logout;
    expect(csrf.current()).toBeNull();

    csrf.set('abc');
    const me = firstValueFrom(api.me()).catch((e) => e);
    backend.expectOne(`${API}/auth/me`).flush({ error: { code: 'unauthenticated', message: '' } }, { status: 401, statusText: '' });
    await me;
    expect(csrf.current()).toBeNull();
  });

  it('maps error bodies to ApiError with code and details', async () => {
    const result = firstValueFrom(api.changePassword('old', 'new')).catch((e) => e);
    backend
      .expectOne(`${API}/auth/password`)
      .flush(
        { error: { code: 'validation_failed', message: 'Invalid input.', details: { field: 'newPassword', reason: 'password_too_short' } } },
        { status: 422, statusText: '' },
      );

    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.code).toBe('validation_failed');
    expect(error.reason).toBe('password_too_short');
  });

  it('reads sessions from items', async () => {
    const result = firstValueFrom(api.sessions());
    backend.expectOne(`${API}/auth/sessions`).flush({ items: [{ id: 1, current: true }] });

    expect(await result).toEqual([{ id: 1, current: true }]);
  });
});
