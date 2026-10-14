import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';

describe('authGuard', () => {
  let authService: AuthService;
  let router: Router;

  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/app/events/5' } as RouterStateSnapshot),
    );

  beforeEach(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: {
            createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((c: string[]) => c),
            navigate: jasmine.createSpy('navigate'),
          },
        },
      ],
    });
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.removeItem(AUTH_STORAGE_KEY));

  it('nepřihlášený uživatel dostane UrlTree na /login s návratovou URL', () => {
    const result = run();
    expect(result).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/app/events/5' } });
  });

  it('přihlášený uživatel projde', (done) => {
    authService.login('jana@soubor.cz', 'x').subscribe(() => {
      const result = run();
      expect(result).toBe(true);
      done();
    });
  });
});
