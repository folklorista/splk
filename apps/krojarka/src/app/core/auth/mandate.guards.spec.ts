import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { FundContext } from '../fund/fund-context';
import { AuthService } from './auth.service';
import { fundGuard, organizationAdminGuard, settingsHomeGuard } from './mandate.guards';

describe('mandate guards', () => {
  let admin: boolean;
  let fund: object | null;
  let resolveSession: () => void;

  beforeEach(() => {
    admin = false;
    fund = null;
    // the session resolves only after the guard started, as on a direct load of /nastaveni
    const session = new Promise<void>((resolve) => (resolveSession = resolve));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { init: () => session, hasMandate: (kind: string) => kind === 'organization.admin' && admin } },
        { provide: FundContext, useValue: { current: () => fund } },
      ],
    });
  });

  const run = async (guard: typeof fundGuard, setUp: () => void) => {
    const result = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Promise<boolean | UrlTree>;
    setUp();
    resolveSession();
    const value = await result;
    return value === true ? true : TestBed.inject(Router).serializeUrl(value as UrlTree);
  };

  it('lets only organization admins into users and mandates', async () => {
    expect(await run(organizationAdminGuard, () => (admin = false))).toBe('/nastaveni');
  });

  it('decides after the session is known', async () => {
    expect(await run(organizationAdminGuard, () => (admin = true))).toBe(true);
  });

  it('opens catalog pages only with a fund', async () => {
    expect(await run(fundGuard, () => (fund = null))).toBe('/nastaveni');
  });

  it('opens catalog pages with a fund', async () => {
    expect(await run(fundGuard, () => (fund = { unitId: 1 }))).toBe(true);
  });

  it('sends /nastaveni to the catalog when there is a fund', async () => {
    expect(await run(settingsHomeGuard, () => ((fund = { unitId: 1 }), (admin = true)))).toBe('/nastaveni/katalog');
  });

  it('sends /nastaveni to users for an admin without a fund', async () => {
    expect(await run(settingsHomeGuard, () => (admin = true))).toBe('/nastaveni/uzivatele');
  });

  it('shows the no-access page to everybody else', async () => {
    expect(await run(settingsHomeGuard, () => undefined)).toBe(true);
  });
});
