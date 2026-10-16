import { TestBed } from '@angular/core/testing';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';
import { MOCK_MEMBERS } from '../../features/members/data/mock-members';
import { MembersService } from '../../features/members/members.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  afterEach(() => localStorage.removeItem(AUTH_STORAGE_KEY));

  it('přihlášení přežije reload (nová instance služby ho načte z úložiště)', (done) => {
    service.login('jana@soubor.cz', 'heslo').subscribe((user) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const reloaded = TestBed.inject(AuthService);
      expect(reloaded.currentUser()).toEqual(user);
      done();
    });
  });

  it('odhlášení zapamatované přihlášení smaže', (done) => {
    service.login('jana@soubor.cz', 'heslo').subscribe(() => {
      service.logout();
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
      done();
    });
  });

  it('poškozený záznam v úložišti ignoruje', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{nesmysl');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(AuthService).currentUser()).toBeNull();
  });

  it('výchozí stav je odhlášený', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('login nastaví mock uživatele', (done) => {
    service.login('jana@soubor.cz', 'heslo').subscribe((user) => {
      expect(service.currentUser()).toEqual(user);
      expect(service.isLoggedIn()).toBeTrue();
      done();
    });
  });

  it('logout odstraní uživatele', (done) => {
    service.login('jana@soubor.cz', 'heslo').subscribe(() => {
      service.logout();
      expect(service.currentUser()).toBeNull();
      expect(service.isLoggedIn()).toBeFalse();
      done();
    });
  });

  it('login s prázdnými poli vrátí chybu', (done) => {
    service.login('', '').subscribe({
      error: (err: Error) => {
        expect(err.message).toBeTruthy();
        done();
      },
    });
  });

  it('login neznámého e-mailu vrátí chybu', (done) => {
    service.login('neznamy@soubor.cz', 'heslo').subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('Uživatel nebyl nalezen.');
        expect(service.isLoggedIn()).toBeFalse();
        done();
      },
    });
  });

  it('uživatel přebírá přezdívku člena, role se do přihlášení neukládají', (done) => {
    service.loginAsMember(2).subscribe((user) => {
      expect(user.name).toBe('Vedoucí');
      expect('roles' in user).toBeFalse();
      done();
    });
  });

  it('starší uložené přihlášení s rolemi se načte jen jako identita', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 1, name: 'Jana', email: 'j@x.cz', groupIds: [1], roles: ['admin'] }));
    const fresh = new AuthService(TestBed.inject(MembersService));
    expect(fresh.currentUser()).toEqual({ id: 1, name: 'Jana', email: 'j@x.cz' });
  });

  it('refreshFromMember aktualizuje přihlášeného uživatele', (done) => {
    service.loginAsMember(1).subscribe(() => {
      service.refreshFromMember({ ...MOCK_MEMBERS[0], nickname: 'Janička' });
      expect(service.currentUser()?.name).toBe('Janička');
      done();
    });
  });
});
