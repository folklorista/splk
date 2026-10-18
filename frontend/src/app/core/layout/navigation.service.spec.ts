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
import { ChatService } from '../../features/chat/chat.service';
import { ChatMessage } from '../../features/chat/models/chat-message.model';
import { CostumesService } from '../../features/costumes/costumes.service';
import { SettingsService } from '../settings/settings.service';
import { seedCostumeState } from '../../features/costumes/data/mock-costumes';
import { MOCK_MEMBERS } from '../../features/members/data/mock-members';

describe('NavigationService', () => {
  const member = testMember({ id: 7, groupIds: [2] });
  let env: ReturnType<typeof createTestAccess>;
  const requests = signal<JoinRequest[]>([]);
  const messages = signal<ChatMessage[]>([]);
  const appSettings = signal<{ bottomBar: string[] | null }>({ bottomBar: null });

  function create(): NavigationService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessService, useValue: env.access },
        { provide: BoardsService, useValue: { getBoardBadges: () => of(new Map([[2, 3]])) } },
        { provide: EventsService, useValue: { getEvents: () => of([]) } },
        { provide: JoinRequestsService, useValue: { requests } },
        { provide: ChatService, useValue: { messages, lastReadAt: () => '2026-01-01T00:00:00Z' } },
        { provide: CostumesService, useValue: { state$: of(seedCostumeState(MOCK_MEMBERS)) } },
        { provide: SettingsService, useValue: { settings: appSettings } },
      ],
    });
    return TestBed.inject(NavigationService);
  }

  beforeEach(() => {
    env = createTestAccess(member);
    requests.set([]);
    messages.set([]);
    appSettings.set({ bottomBar: null });
  });

  it('badge skupiny zahrne i nepřečtené cizí zprávy chatu', fakeAsync(() => {
    const msg = (id: number, authorId: number, createdAt: string): ChatMessage => ({ id, groupId: 2, authorId, body: '', mentionedMemberIds: [], createdAt });
    messages.set([msg(1, 3, '2026-02-01T00:00:00Z'), msg(2, 7, '2026-02-01T00:00:00Z'), msg(3, 3, '2025-12-01T00:00:00Z')]);
    const nav = create();
    nav.start();
    tick();
    expect(nav.groupItems()[0].badge).toBe(4);
    nav.stop();
    discardPeriodicTasks();
  }));

  it('v menu jsou jen skupiny, kde je člen členem, s badge', fakeAsync(() => {
    const nav = create();
    nav.start();
    tick();
    expect(nav.groupItems().map((i) => i.path)).toEqual(['/app/boards/tanecni']);
    expect(nav.groupItems()[0].badge).toBe(3);
    nav.stop();
    discardPeriodicTasks();
  }));

  it('Správa souboru přidá místo Správa (v agendách), ale ne cizí skupiny', () => {
    env.mandates.set([testMandate(7, 'ensemble-admin')]);
    const nav = create();
    expect(nav.places().map((p) => p.path)).toContain('/app/manage');
    expect(nav.places().filter((p) => p.category === 'group').map((p) => p.path)).toEqual(['/app/boards/tanecni']);
    expect(nav.bottomItems()[0].path).toBe('/app/dashboard');
    expect(nav.sections().find((s) => s.label === 'Agendy')!.items.map((i) => i.path)).toEqual(['/app/manage']);
  });

  it('výchozí lišta: Přehled, Akce, skupiny člena přímo, žádné posouvání ani „Více“', () => {
    const nav = create();
    const paths = nav.bottomItems().map((i) => i.path);
    expect(paths[0]).toBe('/app/dashboard');
    expect(paths).toContain('/app/events');
    expect(paths).toContain('/app/boards/tanecni');
    expect(paths.length).toBeLessThanOrEqual(5);
    expect(paths).not.toContain('/app/more');
  });

  it('vlastní lišta s víc než 4 místy: první 3 a „Více“ se součtem badge schovaných míst', () => {
    appSettings.set({ bottomBar: ['search', 'groups', 'costumes', 'events', 'group-2'] });
    const nav = create();
    const items = nav.bottomItems();
    expect(items.map((i) => i.path)).toEqual(['/app/dashboard', '/app/search', '/app/boards', '/app/costumes', '/app/more']);
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
