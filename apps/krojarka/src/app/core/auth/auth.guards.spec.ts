import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard, guestGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  let status: 'signed-in' | 'signed-out';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { init: () => Promise.resolve(), status: () => status } },
      ],
    });
  });

  const run = (guard: typeof authGuard, url = '/lide') =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;

  it('lets a signed-in user into the app and sends a guest to the login with return URL', async () => {
    status = 'signed-in';
    expect(await run(authGuard)).toBe(true);

    status = 'signed-out';
    const result = await run(authGuard);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/prihlaseni?navrat=%2Flide');
  });

  it('keeps a signed-in user away from the login page', async () => {
    status = 'signed-out';
    expect(await run(guestGuard)).toBe(true);

    status = 'signed-in';
    expect(TestBed.inject(Router).serializeUrl((await run(guestGuard)) as UrlTree)).toBe('/');
  });

  it('follows only same-app return URLs', () => {
    expect(safeReturnUrl('/lide?q=1')).toBe('/lide?q=1');
    expect(safeReturnUrl('//evil.example')).toBe('/');
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl(null)).toBe('/');
  });
});
