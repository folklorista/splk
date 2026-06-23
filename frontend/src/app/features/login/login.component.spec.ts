import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth/auth.service';

describe('LoginComponent', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
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
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('vyplněný formulář zavolá login a naviguje na /app/dashboard', fakeAsync(() => {
    const mockUser = { id: 1, name: 'Jana', email: 'jana@test.cz', role: 'member' as const };
    authSpy.login.and.returnValue(of(mockUser));

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.email = 'jana@test.cz';
    component.password = 'heslo';

    component.onSubmit();
    tick(500);

    expect(authSpy.login).toHaveBeenCalledWith('jana@test.cz', 'heslo');
    expect(router.navigate).toHaveBeenCalledWith(['/app/dashboard']);
  }));
});
