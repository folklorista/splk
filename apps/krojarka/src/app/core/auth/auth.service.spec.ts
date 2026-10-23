import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MeResponse } from '@splk/api-contracts';
import { ApiError } from '../../data/api-error';
import { AuthApi } from '../../data/auth/auth-api';
import { AuthService } from './auth.service';

const ME: MeResponse = {
  account: { id: 1, loginEmail: 'a@b.test', status: 'active' },
  person: { id: 7, firstName: 'Anna', lastName: 'Nováková', nickname: null },
  mandates: [{ id: 1, kind: 'costumes.manage', scopeType: 'unit', scopeId: 2, scopeName: 'Děvčice' }],
  csrfToken: 'csrf',
};

describe('AuthService', () => {
  let api: { [K in keyof AuthApi]: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    api = {
      login: vi.fn(() => of(ME)),
      logout: vi.fn(() => of(undefined)),
      me: vi.fn(() => of(ME)),
      changePassword: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      sessions: vi.fn(),
      deleteSession: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: AuthApi, useValue: api }] });
    service = TestBed.inject(AuthService);
  });

  it('starts unknown and resolves the session once', async () => {
    expect(service.status()).toBe('unknown');

    await Promise.all([service.init(), service.init()]);

    expect(api.me).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('signed-in');
    expect(service.displayName()).toBe('Anna Nováková');
    expect(service.hasMandate('costumes.manage')).toBe(true);
    expect(service.hasMandate('organization.admin')).toBe(false);
  });

  it('does not keep the CSRF token in the user state', async () => {
    await service.init();

    expect(service.user()).not.toHaveProperty('csrfToken');
  });

  it('is signed out when the API answers 401', async () => {
    api.me.mockReturnValue(throwError(() => new ApiError(401, 'unauthenticated')));

    await service.init();

    expect(service.status()).toBe('signed-out');
    expect(service.user()).toBeNull();
  });

  it('login signs in, logout signs out even when the request fails', async () => {
    api.me.mockReturnValue(throwError(() => new ApiError(401, 'unauthenticated')));
    await service.init();

    await service.login('a@b.test', 'secret');
    expect(service.status()).toBe('signed-in');

    api.logout.mockReturnValue(throwError(() => new ApiError(0, 'network_error')));
    await expect(service.logout()).rejects.toBeInstanceOf(ApiError);
    expect(service.status()).toBe('signed-out');
  });

  it('ending the current session signs out, another session does not', async () => {
    await service.init();

    await service.deleteSession({ id: 2, createdAt: '', lastSeenAt: '', userAgent: null, current: false });
    expect(service.status()).toBe('signed-in');

    await service.deleteSession({ id: 1, createdAt: '', lastSeenAt: '', userAgent: null, current: true });
    expect(service.status()).toBe('signed-out');
  });
});
