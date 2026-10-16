import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DASHBOARD_EVENT_LIMIT, DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/auth/auth.service';
import { EventsService } from '../events/events.service';
import { PostsService } from '../posts/posts.service';
import { AttendanceService } from '../attendance/attendance.service';
import { MembersService } from '../members/members.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';
import { AppEvent } from '../events/models/event.model';
import { createTestAccess, testMandate } from '../../testing/access.testing';
import { AccessService } from '../../core/access/access.service';

describe('DashboardComponent', () => {
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let attendanceSpy: jasmine.SpyObj<AttendanceService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let postsSpy: jasmine.SpyObj<PostsService>;

  const user: User = {
    id: 2,
    name: 'Vedoucí Souboru',
    email: 'vedouci@soubor.cz',
  };

  // Member ID záměrně odlišné od User ID, aby test odhalil záměnu obou identifikátorů
  const member: Member = {
    id: 5,
    ensembleId: 1,
    userId: 2,
    firstName: 'Vedoucí',
    lastName: 'Souboru',
    nickname: 'Vedoucí Souboru',
    email: 'vedouci@soubor.cz',
    groupIds: [1],
    isActive: true,
    createdAt: '2020-01-01',
  };

  const futureEvent: AppEvent = {
    id: 100,
    ensembleId: 1,
    title: 'Budoucí zkouška',
    type: 'rehearsal',
    startsAt: '2099-01-01T18:00:00',
    endsAt: '2099-01-01T20:00:00',
    location: 'Sál',
    targetGroupIds: [],
  };

  // Cílená na skupinu, ve které user není (groupIds: [1])
  const foreignEvent: AppEvent = {
    id: 101,
    ensembleId: 1,
    title: 'Schůzka vedení',
    type: 'meeting',
    startsAt: '2099-01-02T18:00:00',
    endsAt: '2099-01-02T20:00:00',
    location: 'Sál',
    targetGroupIds: [99],
  };

  let env: ReturnType<typeof createTestAccess>;

  function configure(): void {
    env = env ?? createTestAccess(member);
    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of([member]));

    postsSpy = jasmine.createSpyObj('PostsService', ['getPosts']);
    postsSpy.getPosts.and.returnValue(of([]));

    eventsSpy = jasmine.createSpyObj('EventsService', ['getEvents']);
    eventsSpy.getEvents.and.returnValue(of([futureEvent]));

    attendanceSpy = jasmine.createSpyObj('AttendanceService', ['setStatus']);
    attendanceSpy.setStatus.and.returnValue(of({ eventId: 0, memberId: 0, status: 'yes' }));

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: AccessService, useValue: env.access },
        { provide: EventsService, useValue: eventsSpy },
        { provide: PostsService, useValue: postsSpy },
        { provide: AttendanceService, useValue: attendanceSpy },
        { provide: MembersService, useValue: membersSpy },
      ],
    });
  }

  const pastEvent: AppEvent = {
    ...futureEvent,
    id: 102,
    title: 'Proběhlá zkouška',
    startsAt: '2000-01-01T18:00:00',
    endsAt: '2000-01-01T20:00:00',
  };

  it('zobrazí jen nadcházející akce viditelné pro skupiny uživatele', () => {
    configure();
    eventsSpy.getEvents.and.returnValue(of([futureEvent, foreignEvent, pastEvent]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.upcomingEvents().map((r) => r.event.id)).toEqual([futureEvent.id]);
  });

  it('zobrazí nejvýš pevný počet nejbližších akcí seřazených podle začátku', () => {
    configure();
    const events = Array.from({ length: DASHBOARD_EVENT_LIMIT + 3 }, (_, i) => ({
      ...futureEvent,
      id: 200 + i,
      startsAt: `2099-02-${String(28 - i).padStart(2, '0')}T18:00:00`,
    }));
    eventsSpy.getEvents.and.returnValue(of(events));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const rows = fixture.componentInstance.upcomingEvents();
    expect(rows.length).toBe(DASHBOARD_EVENT_LIMIT);
    expect(rows[0].event.id).toBe(200 + DASHBOARD_EVENT_LIMIT + 2);
  });

  it('převezme stav účasti přihlášeného člena (podle ID člena), jinak pending', () => {
    configure();
    const answered: AppEvent = {
      ...futureEvent,
      attendance: [
        { eventId: futureEvent.id, memberId: user.id, status: 'no' },
        { eventId: futureEvent.id, memberId: member.id, status: 'yes' },
      ],
    };
    const unanswered: AppEvent = { ...futureEvent, id: 103, startsAt: '2099-01-03T18:00:00' };
    eventsSpy.getEvents.and.returnValue(of([answered, unanswered]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.upcomingEvents().map((r) => r.status)).toEqual(['yes', 'pending']);
  });

  it('rychlé potvrzení uloží stav přes službu pod ID člena a hned ho zobrazí', () => {
    configure();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    fixture.componentInstance.setStatus(futureEvent.id, 'maybe');

    expect(attendanceSpy.setStatus).toHaveBeenCalledWith(futureEvent.id, member.id, 'maybe');
    expect(fixture.componentInstance.upcomingEvents()[0].status).toBe('maybe');
  });

  it('nezahrne do připnutých oznámení příspěvek z nástěnky cizí skupiny', () => {
    configure();
    postsSpy.getPosts.and.returnValue(
      of([
        { id: 1, title: 'Pro mou skupinu', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 1 } as any,
        { id: 2, title: 'Pro cizí skupinu', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 99 } as any,
      ]),
    );

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const pinned = fixture.componentInstance.pinnedPosts();
    expect(pinned?.map((p) => p.id)).toEqual([1]);
  });

  beforeEach(() => {
    env = createTestAccess(member);
  });

  it('Správě souboru nezobrazí připnuté příspěvky cizích skupin, archivované ani skryté', () => {
    env.mandates.set([testMandate(member.id, 'ensemble-admin')]);
    configure();
    postsSpy.getPosts.and.returnValue(
      of([
        { id: 1, title: 'Moje', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 1 } as any,
        { id: 2, title: 'Cizí', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 99 } as any,
        { id: 3, title: 'Archiv', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 1, archivedAt: '2026-02-01T00:00:00' } as any,
        { id: 4, title: 'Skryté', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 1, hiddenAt: '2026-02-01T00:00:00' } as any,
      ]),
    );

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.pinnedPosts()?.map((p) => p.id)).toEqual([1]);
  });
});
