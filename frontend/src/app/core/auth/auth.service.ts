import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { User } from './models/user.model';

const MOCK_USER: User = {
  id: 1,
  name: 'Jana Nováková',
  email: 'jana@soubor.cz',
  role: 'member',
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
    return of(MOCK_USER).pipe(
      delay(400),
      tap((user) => this._currentUser.set(user)),
    );
  }

  logout(): void {
    this._currentUser.set(null);
  }
}
