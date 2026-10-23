import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ManagedPerson } from '@splk/api-contracts';
import { OrganizationApi } from '../../data/organization/organization-api';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationStore } from './organization.store';

const person = (id: number, lastName: string): ManagedPerson => ({
  id,
  firstName: 'X',
  lastName,
  nickname: null,
  contact: null,
  note: null,
  account: null,
  mandates: [],
});

describe('OrganizationStore', () => {
  const refresh = vi.fn(() => Promise.resolve());
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: OrganizationStore;

  beforeEach(async () => {
    refresh.mockClear();
    api = {
      persons: vi.fn(() => of([person(2, 'Šťastná'), person(1, 'Čermáková'), person(3, 'Adámková')])),
      units: vi.fn(() => of([{ id: 1, name: 'Vonica', shortName: null, hasCostumeFund: true, archived: false }, { id: 4, name: 'Muzika', shortName: null, hasCostumeFund: false, archived: false }])),
      grantMandate: vi.fn(() => of({ id: 7, kind: 'costumes.manage', scopeType: 'unit', scopeId: 1, scopeName: 'Vonica', validFrom: '2026-10-24' })),
      revokeMandate: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        OrganizationStore,
        { provide: OrganizationApi, useValue: api },
        { provide: AuthService, useValue: { user: signal({ person: { id: 1 }, account: { id: 10 } }), refresh } },
      ],
    });
    store = TestBed.inject(OrganizationStore);
    await store.load();
  });

  it('sorts persons by Czech surname and offers only units with a fund', () => {
    expect(store.persons().map((p) => p.lastName)).toEqual(['Adámková', 'Čermáková', 'Šťastná']);
    expect(store.funds().map((u) => u.name)).toEqual(['Vonica']);
  });

  it('refreshes the session after changing own mandates, not after others', async () => {
    await store.grantMandate({ personId: 2, kind: 'costumes.manage', unitId: 1 });
    expect(refresh).not.toHaveBeenCalled();
    expect(store.persons().find((p) => p.id === 2)?.mandates).toHaveLength(1);

    await store.grantMandate({ personId: 1, kind: 'costumes.manage', unitId: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);

    await store.revokeMandate(1, 7);
    expect(store.persons().find((p) => p.id === 1)?.mandates).toHaveLength(0);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
