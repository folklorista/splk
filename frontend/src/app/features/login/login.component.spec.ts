import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent, safeReturnUrl } from './login.component';
import { AuthService } from '../../core/auth/auth.service';

describe('LoginComponent', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  let queryParams: Record<string, string>;

  beforeEach(async () => {
    queryParams = {};
    authSpy = jasmine.createSpyObj('AuthService', ['login', 'loginAsMember', 'getDemoMembers', 'isLoggedIn']);
    authSpy.getDemoMembers.and.returnValue(of([]));
    authSpy.isLoggedIn.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (k: string) => convertToParamMap(queryParams).get(k) } } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl');
  });

  it('prázdný formulář zobrazí chybu', fakeAsync(() => {
    authSpy.login.and.returnValue(throwError(() => new Error('Zadejte email a heslo.')));

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.email = '';
    component.password = '';

    component.onSubmit();
    tick(500);

    expect(component.error()).toBe('Zadejte email a heslo.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  }));

  it('vyplněný formulář zavolá login a naviguje na /app/dashboard', fakeAsync(() => {
    const mockUser = { id: 1, name: 'Jana', email: 'jana@test.cz', groupIds: [1], roles: ['member' as const] };
    authSpy.login.and.returnValue(of(mockUser));

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.email = 'jana@test.cz';
    component.password = 'heslo';

    component.onSubmit();
    tick(500);

    expect(authSpy.login).toHaveBeenCalledWith('jana@test.cz', 'heslo');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/dashboard');
  }));

  it('rychlé přihlášení přihlásí vybraného člena', fakeAsync(() => {
    const mockUser = { id: 3, name: 'Admin', email: '', groupIds: [1], roles: ['member' as const] };
    authSpy.loginAsMember.and.returnValue(of(mockUser));

    const component = TestBed.createComponent(LoginComponent).componentInstance;
    component.quickLogin(3);
    tick(500);

    expect(authSpy.loginAsMember).toHaveBeenCalledWith(3);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/dashboard');
  }));

  it('po přihlášení vrátí uživatele na původně požadovanou URL', fakeAsync(() => {
    queryParams = { returnUrl: '/app/boards/tanecni/posts/3' };
    authSpy.loginAsMember.and.returnValue(of({ id: 1, name: 'Jana', email: '', groupIds: [], roles: ['member' as const] }));

    TestBed.createComponent(LoginComponent).componentInstance.quickLogin(1);
    tick(500);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/boards/tanecni/posts/3');
  }));

  it('už přihlášeného uživatele rovnou přesměruje do aplikace', () => {
    authSpy.isLoggedIn.and.returnValue(true);
    queryParams = { returnUrl: '/app/events' };

    TestBed.createComponent(LoginComponent);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/events');
    expect(authSpy.getDemoMembers).not.toHaveBeenCalled();
  });

  it('safeReturnUrl pustí jen cesty uvnitř aplikace', () => {
    expect(safeReturnUrl('/app/events?view=calendar')).toBe('/app/events?view=calendar');
    expect(safeReturnUrl('https://evil.example')).toBe('/app/dashboard');
    expect(safeReturnUrl('//evil.example/app')).toBe('/app/dashboard');
    expect(safeReturnUrl('/login')).toBe('/app/dashboard');
    expect(safeReturnUrl(null)).toBe('/app/dashboard');
  });
});
