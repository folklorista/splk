import { Injectable } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';
import { MeResponse, PASSWORD_MIN_LENGTH, SessionInfo } from '@splk/api-contracts';
import { ApiError } from '../api-error';
import { AuthApi } from './auth-api';

/** Mock login for work without a server. Only state in memory, nothing in localStorage (K01). */
export const MOCK_LOGIN = { email: 'krojarka@example.test', password: 'krojarka-demo' } as const;

const LATENCY_MS = 200;

@Injectable()
export class MockAuthApi extends AuthApi {
  private password: string = MOCK_LOGIN.password;
  private signedIn = false;
  private sessionList: SessionInfo[] = [];

  private readonly user: Omit<MeResponse, 'csrfToken'> = {
    account: { id: 1, loginEmail: MOCK_LOGIN.email, status: 'active' },
    person: { id: 1, firstName: 'Marie', lastName: 'Ukázková', nickname: null },
    mandates: [
      { id: 1, kind: 'costumes.manage', scopeType: 'unit', scopeId: 1, scopeName: 'Vonica' },
      { id: 2, kind: 'costumes.view', scopeType: 'unit', scopeId: 2, scopeName: 'Malá Vonica' },
    ],
  };

  login(email: string, password: string): Observable<MeResponse> {
    if (email.trim().toLowerCase() !== MOCK_LOGIN.email || password !== this.password) {
      return this.fail(401, 'invalid_credentials');
    }
    this.signedIn = true;
    const now = new Date().toISOString();
    this.sessionList = [
      { id: 2, createdAt: now, lastSeenAt: now, userAgent: navigator.userAgent, current: true },
      { id: 1, createdAt: '2026-10-01T18:00:00+02:00', lastSeenAt: '2026-10-20T19:30:00+02:00', userAgent: 'Safari na iPhonu', current: false },
    ];
    return this.ok(this.me$());
  }

  logout(): Observable<void> {
    this.signedIn = false;
    return this.ok(undefined);
  }

  me(): Observable<MeResponse> {
    return this.signedIn ? this.ok(this.me$()) : this.fail(401, 'unauthenticated');
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    if (currentPassword !== this.password) {
      return this.fail(422, 'validation_failed', { field: 'currentPassword', reason: 'password_incorrect' });
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return this.fail(422, 'validation_failed', { field: 'newPassword', reason: 'password_too_short' });
    }
    this.password = newPassword;
    this.sessionList = this.sessionList.filter((s) => s.current);
    return this.ok(undefined);
  }

  requestPasswordReset(): Observable<void> {
    return this.ok(undefined);
  }

  confirmPasswordReset(token: string, password: string): Observable<void> {
    if (token !== 'mock') {
      return this.fail(422, 'reset_token_invalid');
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return this.fail(422, 'validation_failed', { field: 'password', reason: 'password_too_short' });
    }
    this.password = password;
    return this.ok(undefined);
  }

  sessions(): Observable<SessionInfo[]> {
    return this.signedIn ? this.ok([...this.sessionList]) : this.fail(401, 'unauthenticated');
  }

  deleteSession(id: number): Observable<void> {
    const session = this.sessionList.find((s) => s.id === id);
    if (!session) {
      return this.fail(404, 'not_found');
    }
    this.sessionList = this.sessionList.filter((s) => s.id !== id);
    if (session.current) {
      this.signedIn = false;
    }
    return this.ok(undefined);
  }

  private me$(): MeResponse {
    return { ...this.user, csrfToken: 'mock-csrf' };
  }

  private ok<T>(value: T): Observable<T> {
    return of(value).pipe(delay(LATENCY_MS));
  }

  private fail(status: number, code: ApiError['code'], details: Record<string, unknown> = {}): Observable<never> {
    return throwError(() => new ApiError(status, code, details));
  }
}
