import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ManagedGroup } from '@splk/api-contracts';
import { GroupsStore } from './groups.store';
import { OrganizationApi } from '../../data/organization/organization-api';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../data/api-error';

const group: ManagedGroup = { id: 3, name: 'Muzikanti', unitId: 4, archived: false, memberships: [] };
function setup(admin = true) {
  const auth = { hasMandate: vi.fn(() => admin) };
  const api = { groups: vi.fn(() => of([group])), createGroup: vi.fn(() => of(group)), updateGroup: vi.fn(() => of({ ...group, archived: true })),
    addGroupMember: vi.fn(() => of(group)), revokeGroupMember: vi.fn(() => of(group)) };
  TestBed.configureTestingModule({ providers: [GroupsStore, { provide: AuthService, useValue: auth }, { provide: OrganizationApi, useValue: api }] });
  return { store: TestBed.inject(GroupsStore), api, auth };
}
describe('GroupsStore', () => {
  it('rejects group reads and writes without organization administration', async () => {
    const { store, api } = setup(false); await store.load();
    expect(store.groups()).toEqual([]); expect(api.groups).not.toHaveBeenCalled();
    await expect(store.create({ name: 'Other' })).rejects.toMatchObject({ code: 'forbidden' });
    expect(api.createGroup).not.toHaveBeenCalled();
  });
  it('keeps one current group after updates and uses membership endpoints', async () => {
    const { store, api } = setup(); await store.load(); await store.update(3, { archived: true });
    expect(store.groups()).toEqual([{ ...group, archived: true }]);
    await store.add(3, { personId: 5 }); await store.revoke(3, 7);
    expect(api.addGroupMember).toHaveBeenCalledWith(3, { personId: 5 }); expect(api.revokeGroupMember).toHaveBeenCalledWith(3, 7);
    expect(store.groups()).toHaveLength(1);
  });
  it('does not replace a saved group with a late earlier list', async () => {
    const { store, api } = setup(); const source = new Subject<ManagedGroup[]>(); api.groups.mockReturnValue(source);
    const loading = store.load(); await store.create({ name: group.name }); source.next([]); source.complete(); await loading;
    expect(store.groups()).toEqual([group]); expect(store.loading()).toBe(false);
  });
  it('blocks overlapping writes and releases the saving flag on failure', async () => {
    const { store, api } = setup(); const source = new Subject<ManagedGroup>(); api.createGroup.mockReturnValue(source);
    const first = store.create({ name: group.name });
    await expect(store.create({ name: 'Again' })).rejects.toMatchObject({ code: 'version_conflict' });
    source.next(group); source.complete(); await first;
    api.createGroup.mockReturnValue(throwError(() => new ApiError(422, 'validation_failed')));
    await expect(store.create({ name: '' })).rejects.toMatchObject({ code: 'validation_failed' }); expect(store.saving()).toBe(false);
  });
});
