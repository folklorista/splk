import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/auth/auth.service';
import { EventsService } from '../events/events.service';
import { PostsService } from '../posts/posts.service';
import { AttendanceService } from '../attendance/attendance.service';
import { MembersService } from '../members/members.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';
import { AppEvent } from '../events/models/event.model';

describe('DashboardComponent', () => {
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let attendanceSpy: jasmine.SpyObj<AttendanceService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let postsSpy: jasmine.SpyObj<PostsService>;

  const user: User = {
    id: 2,
    name: 'Vedoucí Souboru',
    email: 'vedouci@soubor.cz',
    groupIds: [1],
    roles: ['leader'],
  };

  // Member ID záměrně odlišné od User ID, aby test odhalil záměnu obou identifikátorů
  const member: Member = {
    id: 5,
    ensembleId: 1,
    userId: 2,
    name: 'Vedoucí Souboru',
    email: 'vedouci@soubor.cz',
    groupIds: [1],
    isActive: true,
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

  function configure(): void {
    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of([member]));

    postsSpy = jasmine.createSpyObj('PostsService', ['getPosts']);
    postsSpy.getPosts.and.returnValue(of([]));

    eventsSpy = jasmine.createSpyObj('EventsService', ['getEvents']);
    eventsSpy.getEvents.and.returnValue(of([futureEvent]));

    attendanceSpy = jasmine.createSpyObj('AttendanceService', ['getMemberAttendance']);

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: EventsService, useValue: eventsSpy },
        { provide: PostsService, useValue: postsSpy },
        { provide: AttendanceService, useValue: attendanceSpy },
        { provide: MembersService, useValue: membersSpy },
      ],
    });
  }

  it('dotáže se na účast podle ID přihlášeného člena, ne podle ID uživatele', () => {
    configure();
    attendanceSpy.getMemberAttendance.and.returnValue(of([]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(attendanceSpy.getMemberAttendance).toHaveBeenCalledWith(member.id);
    expect(attendanceSpy.getMemberAttendance).not.toHaveBeenCalledWith(user.id);
  });

  it('nezahrne akci, na kterou už člen odpověděl', () => {
    configure();
    attendanceSpy.getMemberAttendance.and.returnValue(
      of([{ eventId: futureEvent.id, memberId: member.id, status: 'yes' }]),
    );

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingAttendance()).toEqual([]);
  });

  it('zahrne budoucí akci bez odpovědi mezi nepotvrzenou účast', () => {
    configure();
    attendanceSpy.getMemberAttendance.and.returnValue(of([]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const pending = fixture.componentInstance.pendingAttendance();
    expect(pending.length).toBe(1);
    expect(pending[0].event.id).toBe(futureEvent.id);
  });

  it('nezahrne do nepotvrzené účasti ani do nejbližší akce událost mimo skupiny uživatele', () => {
    configure();
    eventsSpy.getEvents.and.returnValue(of([futureEvent, foreignEvent]));
    attendanceSpy.getMemberAttendance.and.returnValue(of([]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const pending = fixture.componentInstance.pendingAttendance();
    expect(pending.some((p) => p.event.id === foreignEvent.id)).toBeFalse();
    expect(fixture.componentInstance.nextEvent()?.id).toBe(futureEvent.id);
  });

  it('nezahrne do připnutých oznámení příspěvek z nástěnky cizí skupiny', () => {
    configure();
    postsSpy.getPosts.and.returnValue(
      of([
        { id: 1, title: 'Pro mou skupinu', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 1 } as any,
        { id: 2, title: 'Pro cizí skupinu', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 99 } as any,
      ]),
    );
    attendanceSpy.getMemberAttendance.and.returnValue(of([]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const pinned = fixture.componentInstance.pinnedPosts();
    expect(pinned?.map((p) => p.id)).toEqual([1]);
  });

  it('administrátorovi zobrazí připnuté příspěvky ze všech nástěnek, archivované ne', () => {
    user.roles = ['member', 'admin'];
    configure();
    postsSpy.getPosts.and.returnValue(
      of([
        { id: 1, title: 'Moje', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 1 } as any,
        { id: 2, title: 'Cizí', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 99 } as any,
        { id: 3, title: 'Archiv', body: '', publishedAt: '2026-01-01T00:00:00', isPinned: true, groupId: 1, archivedAt: '2026-02-01T00:00:00' } as any,
      ]),
    );
    attendanceSpy.getMemberAttendance.and.returnValue(of([]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    user.roles = ['leader'];

    expect(fixture.componentInstance.pinnedPosts()?.map((p) => p.id).sort()).toEqual([1, 2]);
  });
});
