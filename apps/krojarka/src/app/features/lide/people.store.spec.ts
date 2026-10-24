import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { Fund, FundContext } from '../../core/fund/fund-context';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../data/api-error';
import { OrganizationApi } from '../../data/organization/organization-api';
import { PeopleApi } from '../../data/people/people-api';
import { PersonCard } from '@splk/api-contracts';
import { PeopleStore } from './people.store';

const card: PersonCard = { openLoans: { items: [], total: 0 }, movements: { items: [], total: 0 }, person: { id: 3, firstName: 'Jan', lastName: 'Novák', nickname: null, contact: '555', contactVisible: true, affiliations: [], defaultCostume: 'unspecified' }, profile: null };
describe('PeopleStore', () => {
  let current: ReturnType<typeof signal<Fund | null>>, api: Record<string, ReturnType<typeof vi.fn>>, store: PeopleStore;
  beforeEach(() => {
    current = signal<Fund | null>({ unitId: 1, name: 'Vonica', canManage: true });
    api = { people: vi.fn(() => of({ items: [{ ...card.person, profile: null }], total: 1 })), card: vi.fn(() => of(card)),
      create: vi.fn(() => throwError(() => new ApiError(422, 'possible_duplicate', { people: [card.person] }))), profile: vi.fn(() => of({})), update: vi.fn(() => of(card.person)) };
    TestBed.configureTestingModule({ providers: [PeopleStore, { provide: FundContext, useValue: { current } }, { provide: AuthService, useValue: { hasMandate: () => true } },
      { provide: OrganizationApi, useValue: { units: () => of([]) } }, { provide: PeopleApi, useValue: api }] });
    store = TestBed.inject(PeopleStore); TestBed.tick();
  });
  it('discards a late card from a previous fund and never shows its private note', async () => {
    const old = new Subject<PersonCard>(); api['card'].mockReturnValueOnce(old);
    const pending = store.openCard(3); current.set({ unitId: 2, name: 'Other', canManage: false }); TestBed.tick();
    old.next({ ...card, profile: { id: 1, unitId: 1, personId: 3, note: 'Private', paperState: 'paper', paperCheckedAt: null, migratedAt: null, migratedBy: null } }); old.complete(); await pending;
    expect(store.card()).toBeNull();
  });
  it('separates permission to edit shared identity from permission to edit a fund profile', async () => {
    current.set({ unitId: 2, name: 'Other', canManage: false }); TestBed.tick();
    await expect(store.profile(3, { paperState: 'paper' })).rejects.toMatchObject({ code: 'forbidden' });
    expect(api['profile']).not.toHaveBeenCalled();
    await expect(store.update(3, { contact: '777' })).resolves.toMatchObject({ id: 3 });
  });
  it('rethrows duplicate warnings without creating or merging any local identity', async () => {
    await expect(store.create({ firstName: 'Jan', lastName: 'Novák' })).rejects.toMatchObject({ code: 'possible_duplicate', details: { people: [card.person] } });
    expect(store.busy()).toBe(false); expect(api['create']).toHaveBeenCalledTimes(1);
  });
});
