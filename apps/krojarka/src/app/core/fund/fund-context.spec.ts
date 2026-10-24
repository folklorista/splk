import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject } from 'rxjs';
import { Mandate, Unit } from '@splk/api-contracts';
import { OrganizationApi } from '../../data/organization/organization-api';
import { AuthService, CurrentUser } from '../auth/auth.service';
import { FundContext } from './fund-context';

const mandate = (kind: Mandate['kind'], scopeId: number | null, scopeName: string | null = null): Mandate => ({
  id: Math.random(),
  kind,
  scopeType: scopeId === null ? 'organization' : 'unit',
  scopeId,
  scopeName,
});

describe('FundContext', () => {
  const user = signal<CurrentUser | null>(null);
  const units = vi.fn((): Observable<Unit[]> =>
    of([
      { id: 1, name: 'Vonica', shortName: null, hasCostumeFund: true, archived: false },
      { id: 2, name: 'Malá Vonica', shortName: null, hasCostumeFund: true, archived: false },
      { id: 4, name: 'Muzika', shortName: null, hasCostumeFund: false, archived: false },
    ]),
  );

  const setMandates = (mandates: Mandate[]) =>
    user.set({ account: { id: 1, loginEmail: 'a@b.test', status: 'active' }, person: { id: 1, firstName: 'A', lastName: 'B', nickname: null }, mandates });

  beforeEach(() => {
    localStorage.clear();
    units.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: OrganizationApi, useValue: { units } },
      ],
    });
  });

  it('derives funds from costume mandates; manage wins over view; admin gives none', () => {
    setMandates([mandate('costumes.view', 2, 'Malá Vonica'), mandate('costumes.manage', 2, 'Malá Vonica'), mandate('costumes.view', 1, 'Vonica'), mandate('organization.admin', null)]);
    const context = TestBed.inject(FundContext);

    expect(context.funds()).toEqual([
      { unitId: 1, name: 'Vonica', canManage: false },
      { unitId: 2, name: 'Malá Vonica', canManage: true },
    ]);
    expect(context.current()?.unitId).toBe(1);
  });

  it('organization-wide view covers every unit with a fund', async () => {
    setMandates([mandate('costumes.view', null)]);
    const context = TestBed.inject(FundContext);
    TestBed.tick();
    await vi.waitFor(() => expect(context.funds().length).toBe(2));

    expect(context.funds().map((f) => f.name)).toEqual(['Vonica', 'Malá Vonica']);
    expect(context.funds().every((f) => !f.canManage)).toBe(true);
  });

  it('remembers the selected fund and falls back when it is no longer available', () => {
    setMandates([mandate('costumes.manage', 1, 'Vonica'), mandate('costumes.manage', 2, 'Malá Vonica')]);
    const context = TestBed.inject(FundContext);

    context.select(2);
    expect(context.current()?.unitId).toBe(2);
    expect(localStorage.getItem('krojarka.fund')).toBe('2');

    setMandates([mandate('costumes.manage', 1, 'Vonica')]);
    expect(context.current()?.unitId).toBe(1);
  });

  it('has no fund without costume mandates', () => {
    setMandates([mandate('organization.admin', null)]);

    expect(TestBed.inject(FundContext).current()).toBeNull();
  });
  it('shares pending loads and discards a late unit list after sign-out', async () => {
    setMandates([mandate('costumes.view', null)]);
    const response = new Subject<import('@splk/api-contracts').Unit[]>();
    units.mockReturnValueOnce(response);
    const context = TestBed.inject(FundContext);
    const first = context.init(), second = context.init();
    expect(units).toHaveBeenCalledTimes(1);
    user.set(null); await context.init();
    response.next([{ id: 1, name: 'Old', shortName: null, hasCostumeFund: true, archived: false }]); response.complete();
    await Promise.all([first, second]); expect(context.current()).toBeNull();
  });

});
