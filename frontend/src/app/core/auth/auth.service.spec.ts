import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

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
    service.login('test@test.cz', 'heslo').subscribe((user) => {
      expect(service.currentUser()).toEqual(user);
      expect(service.isLoggedIn()).toBeTrue();
      done();
    });
  });

  it('logout odstraní uživatele', (done) => {
    service.login('test@test.cz', 'heslo').subscribe(() => {
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
});
