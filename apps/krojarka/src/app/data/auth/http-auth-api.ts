import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import {
  ChangePasswordRequest,
  LoginRequest,
  MeResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  SessionInfo,
  SessionsResponse,
} from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { CsrfTokenStore } from '../http/csrf-token.store';
import { AuthApi } from './auth-api';

@Injectable()
export class HttpAuthApi extends AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly csrf = inject(CsrfTokenStore);

  login(email: string, password: string): Observable<MeResponse> {
    const body: LoginRequest = { email, password };
    return this.request(this.http.post<MeResponse>(`${this.baseUrl}/auth/login`, body)).pipe(
      tap((me) => this.csrf.set(me.csrfToken)),
    );
  }

  logout(): Observable<void> {
    return this.request(this.http.post<void>(`${this.baseUrl}/auth/logout`, null)).pipe(
      tap(() => this.csrf.set(null)),
    );
  }

  me(): Observable<MeResponse> {
    return this.request(this.http.get<MeResponse>(`${this.baseUrl}/auth/me`)).pipe(
      tap({
        next: (me) => this.csrf.set(me.csrfToken),
        error: () => this.csrf.set(null),
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    const body: ChangePasswordRequest = { currentPassword, newPassword };
    return this.request(this.http.post<void>(`${this.baseUrl}/auth/password`, body));
  }

  requestPasswordReset(email: string): Observable<void> {
    const body: PasswordResetRequest = { email };
    return this.request(this.http.post<void>(`${this.baseUrl}/auth/password-reset`, body));
  }

  confirmPasswordReset(token: string, password: string): Observable<void> {
    const body: PasswordResetConfirmRequest = { token, password };
    return this.request(this.http.post<void>(`${this.baseUrl}/auth/password-reset/confirm`, body));
  }

  sessions(): Observable<SessionInfo[]> {
    return this.request(this.http.get<SessionsResponse>(`${this.baseUrl}/auth/sessions`)).pipe(
      map((response) => response.items),
    );
  }

  deleteSession(id: number): Observable<void> {
    return this.request(this.http.delete<void>(`${this.baseUrl}/auth/sessions/${id}`));
  }

  private request<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
  }
}
