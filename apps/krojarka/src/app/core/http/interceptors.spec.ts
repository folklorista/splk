import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../data/api-config';
import { CsrfTokenStore } from '../../data/http/csrf-token.store';
import { AuthService } from '../auth/auth.service';
import { apiCredentialsInterceptor, authErrorInterceptor, csrfInterceptor } from './interceptors';

const API = 'https://api.test/v1';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: { markSignedOut: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn> };
  let router: { url: string; navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { markSignedOut: vi.fn(), refresh: vi.fn() };
    router = { url: '/lide', navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, authErrorInterceptor, csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(CsrfTokenStore).set('token-1');
  });

  afterEach(() => backend.verify());

  it('sends credentials only to the API', () => {
    http.get(`${API}/auth/me`).subscribe();
    http.get('https://api.test/v1evil/x').subscribe();
    http.get('https://other.example/data').subscribe();

    expect(backend.expectOne(`${API}/auth/me`).request.withCredentials).toBe(true);
    expect(backend.expectOne('https://api.test/v1evil/x').request.withCredentials).toBe(false);
    expect(backend.expectOne('https://other.example/data').request.withCredentials).toBe(false);
  });

  it('adds the CSRF token to API writes only', () => {
    http.get(`${API}/items`).subscribe();
    http.post(`${API}/items`, {}).subscribe();
    http.post('https://other.example/form', {}).subscribe();

    expect(backend.expectOne({ method: 'GET', url: `${API}/items` }).request.headers.has('X-CSRF-Token')).toBe(false);
    expect(backend.expectOne({ method: 'POST', url: `${API}/items` }).request.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(backend.expectOne('https://other.example/form').request.headers.has('X-CSRF-Token')).toBe(false);
  });

  it('on 401 marks the user signed out and opens the login', async () => {
    const result = firstValueFrom(http.get(`${API}/items`)).catch((e) => e);
    backend.expectOne(`${API}/items`).flush({ error: { code: 'unauthenticated' } }, { status: 401, statusText: '' });
    await result;

    expect(auth.markSignedOut).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/prihlaseni'], { queryParams: { navrat: '/lide' } });
  });

  it('does not redirect on 401 from login or me', async () => {
    const result = firstValueFrom(http.post(`${API}/auth/login`, {})).catch((e) => e);
    backend.expectOne(`${API}/auth/login`).flush({ error: { code: 'invalid_credentials' } }, { status: 401, statusText: '' });
    await result;

    expect(auth.markSignedOut).not.toHaveBeenCalled();
  });

  it('refreshes the CSRF token once and repeats the write', async () => {
    auth.refresh.mockImplementation(async () => TestBed.inject(CsrfTokenStore).set('token-2'));
    const result = firstValueFrom(http.post(`${API}/items`, {}));

    backend.expectOne(`${API}/items`).flush({ error: { code: 'csrf_token_invalid' } }, { status: 403, statusText: '' });
    await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalled());
    const retry = backend.expectOne(`${API}/items`);
    expect(retry.request.headers.get('X-CSRF-Token')).toBe('token-2');
    retry.flush({ ok: true });

    expect(await result).toEqual({ ok: true });
  });

  it('does not retry a second CSRF failure', async () => {
    auth.refresh.mockResolvedValue(undefined);
    const result = firstValueFrom(http.post(`${API}/items`, {})).catch((e) => e.status);

    backend.expectOne(`${API}/items`).flush({ error: { code: 'csrf_token_invalid' } }, { status: 403, statusText: '' });
    await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalled());
    backend.expectOne(`${API}/items`).flush({ error: { code: 'csrf_token_invalid' } }, { status: 403, statusText: '' });

    expect(await result).toBe(403);
    expect(auth.refresh).toHaveBeenCalledTimes(1);
  });
});
