import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../api-config';
import { HttpOrganizationApi } from './http-organization-api';
import { MockOrganizationApi } from './mock-organization-api';

describe('Group adapters', () => {
  it('routes group administration and membership removal through the shared HTTP adapter', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), HttpOrganizationApi, { provide: API_BASE_URL, useValue: '/v1' }] });
    const api = TestBed.inject(HttpOrganizationApi), http = TestBed.inject(HttpTestingController);
    const list = firstValueFrom(api.groups()); const groupPage = http.expectOne('/v1/groups?limit=200&offset=0'); groupPage.flush({ items: [], total: 0 }); expect(await list).toEqual([]);
    const options = firstValueFrom(api.groupOptions(2)); http.expectOne('/v1/funds/2/inventories/groups?limit=200&offset=0').flush({ items: [], total: 0 }); await options;
    const add = firstValueFrom(api.addGroupMember(3, { personId: 7 }));
    const request = http.expectOne('/v1/groups/3/members'); expect(request.request.method).toBe('POST'); expect(request.request.body).toEqual({ personId: 7 }); request.flush({ id: 3 }); await add;
    const remove = firstValueFrom(api.revokeGroupMember(3, 8)); const deletion = http.expectOne('/v1/groups/3/members/8'); expect(deletion.request.method).toBe('DELETE'); deletion.flush({ id: 3 }); await remove;
    http.verify();
  });
  it('preserves revoked membership and excludes archived groups from mock selection', async () => {
    TestBed.configureTestingModule({ providers: [MockOrganizationApi] }); const api = TestBed.inject(MockOrganizationApi);
    const group = await firstValueFrom(api.createGroup({ name: 'Dancers' }));
    const withMember = await firstValueFrom(api.addGroupMember(group.id, { personId: 3 }));
    await expect(firstValueFrom(api.addGroupMember(group.id, { personId: 3 }))).rejects.toMatchObject({ code: 'group_membership_exists' });
    const removed = await firstValueFrom(api.revokeGroupMember(group.id, withMember.memberships[0].id));
    expect(removed.memberships[0].active).toBe(false); expect(removed.memberships[0].revokedAt).not.toBeNull();
    const again = await firstValueFrom(api.addGroupMember(group.id, { personId: 3 })); expect(again.memberships).toHaveLength(2);
    await firstValueFrom(api.updateGroup(group.id, { archived: true })); expect((await firstValueFrom(api.groupOptions(1))).some((g) => g.id === group.id)).toBe(false);
    expect((await firstValueFrom(api.groups())).find((g) => g.id === group.id)?.memberships).toHaveLength(2);
  });
  it('rejects invalid dates and archived-group writes in the mock without mutation', async () => {
    TestBed.configureTestingModule({ providers: [MockOrganizationApi] }); const api = TestBed.inject(MockOrganizationApi);
    await expect(firstValueFrom(api.addGroupMember(1, { personId: 3, validFrom: '2026-02-30' }))).rejects.toMatchObject({ code: 'validation_failed' });
    await firstValueFrom(api.updateGroup(1, { archived: true }));
    await expect(firstValueFrom(api.addGroupMember(1, { personId: 2 }))).rejects.toMatchObject({ code: 'validation_failed' });
    expect((await firstValueFrom(api.groups()))[0].memberships).toHaveLength(1);
  });
  it('loads every page of group choices before returning the complete adapter result', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), HttpOrganizationApi, { provide: API_BASE_URL, useValue: '/v1' }] });
    const api = TestBed.inject(HttpOrganizationApi), http = TestBed.inject(HttpTestingController);
    const response = firstValueFrom(api.groupOptions(1));
    http.expectOne('/v1/funds/1/inventories/groups?limit=200&offset=0').flush({ items: [{ id: 1, name: 'One', unitId: null }], total: 2 });
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/v1/funds/1/inventories/groups?limit=200&offset=1').flush({ items: [{ id: 2, name: 'Two', unitId: null }], total: 2 });
    expect((await response).map((g) => g.id)).toEqual([1, 2]); http.verify();
  });
});
