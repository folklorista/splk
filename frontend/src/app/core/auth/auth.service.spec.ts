import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { MOCK_MEMBERS } from '../../features/members/data/mock-members';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
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

  it('uživatel přebírá přezdívku člena a role podle výboru a administrátora', (done) => {
    service.loginAsMember(2).subscribe((user) => {
      expect(user.name).toBe('Vedoucí');
      expect(user.roles).toEqual(['member', 'leader']);
      service.loginAsMember(3).subscribe((admin) => {
        expect(admin.roles).toEqual(['member', 'leader', 'admin']);
        done();
      });
    });
  });

  it('refreshFromMember aktualizuje přihlášeného uživatele', (done) => {
    service.loginAsMember(1).subscribe(() => {
      service.refreshFromMember({ ...MOCK_MEMBERS[0], nickname: 'Janička' });
      expect(service.currentUser()?.name).toBe('Janička');
      done();
    });
  });
});
