import { Injectable, signal, computed } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { User } from './models/user.model';
import { Member } from '../models/member.model';
import { MembersService } from '../../features/members/members.service';
import { memberToUser } from '../utils/member.utils';

export const AUTH_STORAGE_KEY = 'splk.auth.user';

// Přihlášený uživatel přežije reload / znovuotevření PWA. Úložiště může být nedostupné
// (anonymní okno, zablokovaná data) – pak se jen nepamatuje.
function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as User;
    return typeof user?.id === 'number' ? { id: user.id, name: user.name, email: user.email } : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // úložiště nedostupné – přihlášení platí jen do reloadu
  }
}

// Mock autentizace: uživatelé se odvozují z aktivních členů, heslo se nekontroluje
@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = signal<User | null>(readStoredUser());

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  constructor(private membersService: MembersService) {}

  login(email: string, password: string): Observable<User> {
    if (!email || !password) {
      return throwError(() => new Error('Zadejte email a heslo.'));
    }
    const normalized = email.trim().toLowerCase();
    return this.loginWhere((m) => m.email?.toLowerCase() === normalized);
  }

  loginAsMember(memberId: number): Observable<User> {
    return this.loginWhere((m) => m.id === memberId);
  }

  // Seznam pro rychlé přihlášení na login obrazovce (demo)
  getDemoMembers(): Observable<Member[]> {
    return this.membersService
      .getActiveMembers()
      .pipe(map((members) => [...members].sort((a, b) => a.nickname.localeCompare(b.nickname, 'cs'))));
  }

  // Po úpravě vlastního profilu (např. přezdívky) se přihlášený uživatel aktualizuje
  refreshFromMember(member: Member): void {
    if (this._currentUser()?.id === member.userId) {
      this.setUser(memberToUser(member));
    }
  }

  logout(): void {
    this.setUser(null);
  }

  private setUser(user: User | null): void {
    this._currentUser.set(user);
    writeStoredUser(user);
  }

  private loginWhere(predicate: (member: Member) => boolean): Observable<User> {
    return this.membersService.getActiveMembers().pipe(
      map((members) => {
        const member = members.find(predicate);
        if (!member) throw new Error('Uživatel nebyl nalezen.');
        return memberToUser(member);
      }),
      tap((user) => this.setUser(user)),
    );
  }
}
