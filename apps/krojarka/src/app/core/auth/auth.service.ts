import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MandateKind, MeResponse, SessionInfo } from '@splk/api-contracts';
import { ApiError } from '../../data/api-error';
import { AuthApi } from '../../data/auth/auth-api';

export type AuthStatus = 'unknown' | 'signed-in' | 'signed-out';
export type CurrentUser = Omit<MeResponse, 'csrfToken'>;

/**
 * Who is signed in. The state comes from GET /auth/me at startup and lives in memory only;
 * nothing about the login is stored in the browser (hosting doc chap. 8).
 * The API is the authority for permissions, mandates here only shape the UI.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly state = signal<{ status: AuthStatus; user: CurrentUser | null }>({
    status: 'unknown',
    user: null,
  });
  private initialized: Promise<void> | null = null;

  readonly status = computed(() => this.state().status);
  readonly user = computed(() => this.state().user);
  readonly displayName = computed(() => {
    const person = this.state().user?.person;
    return person ? `${person.firstName} ${person.lastName}` : '';
  });

  /** Resolves the session once; guards await it before the first navigation. */
  init(): Promise<void> {
    return (this.initialized ??= this.refresh());
  }

  async refresh(): Promise<void> {
    try {
      this.setUser(await firstValueFrom(this.api.me()));
    } catch (error) {
      if (ApiError.from(error).status !== 401) {
        console.error('Could not resolve the session', error);
      }
      this.markSignedOut();
    }
  }

  async login(email: string, password: string): Promise<void> {
    this.setUser(await firstValueFrom(this.api.login(email, password)));
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.markSignedOut();
    }
  }

  /** Called when the API answers 401 – the session expired or was ended elsewhere. */
  markSignedOut(): void {
    this.state.set({ status: 'signed-out', user: null });
  }

  hasMandate(kind: MandateKind): boolean {
    return this.state().user?.mandates.some((m) => m.kind === kind) ?? false;
  }

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return firstValueFrom(this.api.changePassword(currentPassword, newPassword));
  }

  requestPasswordReset(email: string): Promise<void> {
    return firstValueFrom(this.api.requestPasswordReset(email));
  }

  confirmPasswordReset(token: string, password: string): Promise<void> {
    return firstValueFrom(this.api.confirmPasswordReset(token, password));
  }

  sessions(): Promise<SessionInfo[]> {
    return firstValueFrom(this.api.sessions());
  }

  async deleteSession(session: SessionInfo): Promise<void> {
    await firstValueFrom(this.api.deleteSession(session.id));
    if (session.current) {
      this.markSignedOut();
    }
  }

  private setUser(me: MeResponse): void {
    const { csrfToken: _csrf, ...user } = me;
    this.state.set({ status: 'signed-in', user });
  }
}
