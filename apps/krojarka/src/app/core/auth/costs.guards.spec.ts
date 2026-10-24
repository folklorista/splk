import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { Mandate } from '@splk/api-contracts';
import { FundContext } from '../fund/fund-context';
import { AuthService } from './auth.service';
import { costsGuard, fundGuard, reportsHomeGuard } from './mandate.guards';
describe('cost evidence guards', () => {
  let user: ReturnType<typeof signal<{ mandates: Mandate[] }>>, fund: ReturnType<typeof signal<object | null>>;
  beforeEach(() => { user = signal({ mandates: [] }); fund = signal<object | null>(null); TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { init: async () => undefined, user } }, { provide: FundContext, useValue: { init: async () => undefined, current: fund } }] }); });
  async function run(guard: typeof costsGuard) { const result = await TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)); return result === true ? true : TestBed.inject(Router).serializeUrl(result as UrlTree); }
  const mandate = (kind: Mandate['kind'], scopeType: Mandate['scopeType'], scopeId: number | null) => user.set({ mandates: [{ id: 1, kind, scopeType, scopeId, scopeName: null }] });
  it('lets a treasurer reach costs through Reports while keeping ordinary fund screens closed', async () => {
    mandate('costs.view', 'organization', null); expect(await run(costsGuard)).toBe(true); expect(await run(reportsHomeGuard)).toBe('/prehledy/naklady'); expect(await run(fundGuard)).toBe('/nastaveni');
  });
  it('does not grant cost access from organization administration', async () => { mandate('organization.admin', 'organization', null); expect(await run(costsGuard)).toBe('/nastaveni'); expect(await run(reportsHomeGuard)).toBe('/nastaveni'); });
  it('preserves Reports and cost access for existing fund viewers', async () => { mandate('costumes.view', 'unit', 1); fund.set({ unitId: 1 }); expect(await run(costsGuard)).toBe(true); expect(await run(reportsHomeGuard)).toBe(true); });
});
