import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { NavigationService } from './navigation.service';
import { AccessService } from '../access/access.service';
import { BoardsService } from '../../features/boards/boards.service';
import { EventsService } from '../../features/events/events.service';
import { JoinRequestsService } from '../../features/groups/join-requests.service';
import { JoinRequest } from '../../features/groups/models/join-request.model';
import { createTestAccess, testMandate, testMember } from '../../testing/access.testing';

describe('NavigationService', () => {
  const member = testMember({ id: 7, groupIds: [2] });
  let env: ReturnType<typeof createTestAccess>;
  const requests = signal<JoinRequest[]>([]);

  function create(): NavigationService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessService, useValue: env.access },
        { provide: BoardsService, useValue: { getBoardBadges: () => of(new Map([[2, 3]])) } },
        { provide: EventsService, useValue: { getEvents: () => of([]) } },
        { provide: JoinRequestsService, useValue: { requests } },
      ],
    });
    return TestBed.inject(NavigationService);
  }

  beforeEach(() => {
    env = createTestAccess(member);
    requests.set([]);
  });

  it('v menu jsou jen skupiny, kde je člen členem, s badge', fakeAsync(() => {
    const nav = create();
    nav.start();
    tick();
    expect(nav.groupItems().map((i) => i.path)).toEqual(['/app/boards/tanecni']);
    expect(nav.groupItems()[0].badge).toBe(3);
    nav.stop();
    discardPeriodicTasks();
  }));

  it('Správa souboru přidá Správu, ale ne cizí skupiny', () => {
    env.mandates.set([testMandate(7, 'ensemble-admin')]);
    const nav = create();
    expect(nav.bottomItems().map((i) => i.path)).toEqual(['/app/dashboard', '/app/events', '/app/boards/tanecni', '/app/boards', '/app/manage']);
  });

  it('Docházka jen s pověřením Evidence docházky', () => {
    const nav = create();
    expect(nav.mainItems().some((i) => i.path === '/app/attendance')).toBeFalse();
    env.mandates.set([testMandate(7, 'attendance')]);
    expect(nav.mainItems().some((i) => i.path === '/app/attendance')).toBeTrue();
  });

  it('vypnutý modul zmizí z menu', () => {
    const nav = create();
    env.settings.update((s) => ({ ...s, modules: { events: false, costumes: false } }));
    expect(nav.mainItems().map((i) => i.path)).toEqual(['/app/dashboard']);
    expect(nav.moduleItems()).toEqual([]);
  });

  it('badge rozcestníku: žádosti ve spravovaných skupinách a pozvánky pro mě', () => {
    env.mandates.set([testMandate(7, 'group-deputy', { groupId: 2 })]);
    const base = { kind: 'request' as const, createdById: 1, createdAt: '' };
    requests.set([
      { ...base, id: 1, groupId: 2, memberId: 1, status: 'awaiting-manager' },
      { ...base, id: 2, groupId: 5, memberId: 1, status: 'awaiting-manager' },
      { ...base, id: 3, groupId: 5, memberId: 7, kind: 'invitation', status: 'awaiting-member' },
      { ...base, id: 4, groupId: 2, memberId: 3, status: 'accepted' },
    ]);
    const nav = create();
    expect(nav.pendingRequests()).toBe(2);
  });
});
