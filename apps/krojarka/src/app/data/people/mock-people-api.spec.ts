import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { Mandate } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationApi } from '../organization/organization-api';
import { MockOrganizationApi } from '../organization/mock-organization-api';
import { MockPeopleApi } from './mock-people-api';

describe('MockPeopleApi', () => {
  let api: MockPeopleApi, organization: OrganizationApi;
  let mandates: Mandate[];
  beforeEach(() => {
    vi.useFakeTimers();
    mandates = [1, 2].map((id) => ({ id, kind: 'costumes.manage', scopeType: 'unit', scopeId: id, scopeName: 'Fund' }));
    TestBed.configureTestingModule({ providers: [MockPeopleApi, { provide: OrganizationApi, useClass: MockOrganizationApi },
      { provide: AuthService, useValue: { user: () => ({ account: { id: 1 }, mandates }), hasMandate: (kind: string) => mandates.some((m) => m.kind === kind) } }] });
    api = TestBed.inject(MockPeopleApi); organization = TestBed.inject(OrganizationApi);
  });
  afterEach(() => vi.useRealTimers());
  const resolve = async <T>(source: Observable<T>): Promise<T> => { const result = firstValueFrom(source); void result.catch(() => undefined); await vi.runAllTimersAsync(); return result; };

  it('uses one person registry for people and organization administration', async () => {
    const person = await resolve(api.create({ firstName: 'Eva', lastName: 'Nová', contact: '555' }));
    const managed = (await resolve(organization.persons())).find((p) => p.id === person.id)!;
    expect(managed.contact).toBe('555'); expect(managed.account).toBeNull(); expect(managed.mandates).toEqual([]);
    await resolve(api.update(person.id, { contact: '777', defaultCostume: 'female' }));
    expect((await resolve(organization.persons())).find((p) => p.id === person.id)?.contact).toBe('777');
    const card = await resolve(api.card(2, person.id)); expect(card.person.defaultCostume).toBe('female');
    expect(card.person).not.toHaveProperty('account'); expect(card.person).not.toHaveProperty('note');
  });
  it('warns before creating the same name and allows an explicitly separate identity', async () => {
    await expect(resolve(api.create({ firstName: 'Jan', lastName: 'Muzikant' }))).rejects.toMatchObject({ code: 'possible_duplicate' });
    const person = await resolve(api.create({ firstName: 'Jan', lastName: 'Muzikant', confirmDuplicate: true }));
    expect(person.id).not.toBe(3); expect((await resolve(api.people({ q: 'jan muzikant' }))).total).toBe(2);
  });
  it('keeps notes and conversion state independent across funds', async () => {
    await resolve(api.profile(1, 3, { paperState: 'digital', note: 'Own shoes' }));
    expect((await resolve(api.card(2, 3))).profile).toBeNull();
    await resolve(api.profile(2, 3, { paperState: 'paper', note: 'Other fund' }));
    const own = await resolve(api.card(1, 3)); expect(own.profile?.note).toBe('Own shoes'); expect(own.profile?.paperCheckedAt).toBeNull();
    expect((await resolve(api.people({ fund: 1, paperState: 'digital' }))).items.map((p) => p.id)).toEqual([3]);
  });
  it('redacts shared contacts for viewers and rejects writes and foreign cards', async () => {
    await resolve(api.update(3, { contact: 'Secret' }));
    mandates = [{ id: 9, kind: 'costumes.view', scopeType: 'unit', scopeId: 1, scopeName: 'Fund' }];
    const card = await resolve(api.card(1, 3)); expect(card.person.contact).toBeNull(); expect(card.person.contactVisible).toBe(false);
    await expect(resolve(api.profile(1, 3, { paperState: 'paper' }))).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    await expect(resolve(api.card(2, 3))).rejects.toMatchObject({ status: 404, code: 'not_found' });
    await expect(resolve(api.update(3, { contact: 'No' }))).rejects.toMatchObject({ status: 403 });
  });
});
