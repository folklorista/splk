import { Injectable, signal } from '@angular/core';

/**
 * CSRF token of the current session, from login and GET /auth/me. Kept in memory only:
 * the session cookie is HttpOnly on api.vonica.cz, so Angular's cookie-based XSRF support does not apply
 * (hosting doc chap. 8).
 */
@Injectable({ providedIn: 'root' })
export class CsrfTokenStore {
  private readonly token = signal<string | null>(null);

  readonly current = this.token.asReadonly();

  set(token: string | null): void {
    this.token.set(token);
  }
}
