import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { leaderGuard } from './leader.guard';
import { AuthService } from './auth.service';
import { User } from './models/user.model';

describe('leaderGuard', () => {
  function run(user: User | null) {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: Router, useValue: { createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((c: string[]) => c) } },
      ],
    });
    return TestBed.runInInjectionContext(() => leaderGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  }

  const base: User = { id: 1, name: 'X', email: 'x@soubor.cz', groupIds: [], roles: ['member'] };

  it('vedoucího pustí', () => {
    expect(run({ ...base, roles: ['member', 'leader'] })).toBe(true);
  });

  it('administrátora pustí', () => {
    expect(run({ ...base, roles: ['member', 'admin'] })).toBe(true);
  });

  it('běžného člena přesměruje na přehled', () => {
    expect(run(base)).toEqual(['/app/dashboard'] as any);
  });

  it('nepřihlášeného přesměruje na přehled', () => {
    expect(run(null)).toEqual(['/app/dashboard'] as any);
  });
});
