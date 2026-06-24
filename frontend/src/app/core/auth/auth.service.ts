import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { User } from './models/user.model';

const MOCK_USERS: Record<string, User> = {
  'jana@soubor.cz': {
    id: 'jana',
    name: 'Jana Nováková',
    email: 'jana@soubor.cz',
    groups: ['dospeli', 'tanecni-skupina'],
    roles: ['member'],
  },
  'vedouci@soubor.cz': {
    id: 'vedouci',
    name: 'Vedoucí Souboru',
    email: 'vedouci@soubor.cz',
    groups: ['dospeli', 'vedeni'],
    roles: ['member', 'leader'],
  },
  'admin@soubor.cz': {
    id: 'admin',
    name: 'Administrátor',
    email: 'admin@soubor.cz',
    groups: ['dospeli', 'vedeni'],
    roles: ['member', 'leader', 'admin'],
  },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = signal<User | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  login(email: string, password: string): Observable<User> {
    if (!email || !password) {
      return throwError(() => new Error('Zadejte email a heslo.'));
    }
    const user = MOCK_USERS[email];
    if (!user) {
      return throwError(() => new Error('Uživatel nebyl nalezen.'));
    }
    return of(user).pipe(
      delay(400),
      tap((u) => this._currentUser.set(u)),
    );
  }

  logout(): void {
    this._currentUser.set(null);
  }
}

export const DEMO_USERS = Object.values(MOCK_USERS);
