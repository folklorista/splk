import { Observable } from 'rxjs';
import { MeResponse, SessionInfo } from '@splk/api-contracts';

/**
 * Data access for login and the own account. Implemented by HttpAuthApi and MockAuthApi,
 * chosen in provideData(); components never use it directly (CLAUDE.md, D-15).
 * Errors are ApiError.
 */
export abstract class AuthApi {
  abstract login(email: string, password: string): Observable<MeResponse>;
  abstract logout(): Observable<void>;
  /** current session; ApiError 401 when signed out */
  abstract me(): Observable<MeResponse>;
  abstract changePassword(currentPassword: string, newPassword: string): Observable<void>;
  /** always succeeds, does not reveal whether the account exists */
  abstract requestPasswordReset(email: string): Observable<void>;
  abstract confirmPasswordReset(token: string, password: string): Observable<void>;
  abstract sessions(): Observable<SessionInfo[]>;
  abstract deleteSession(id: number): Observable<void>;
}
