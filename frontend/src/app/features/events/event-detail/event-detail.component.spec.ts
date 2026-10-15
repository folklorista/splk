import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { EventDetailComponent } from './event-detail.component';
import { EventsService } from '../events.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { ActualAttendanceService } from '../../attendance/actual-attendance.service';
import { ActualAttendance } from '../../attendance/models/actual-attendance.model';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { GroupsService } from '../../../core/services/groups.service';
import { User } from '../../../core/auth/models/user.model';
import { Member } from '../../../core/models/member.model';
import { AppEvent } from '../models/event.model';
import { AttendanceRecord } from '../../attendance/models/attendance.model';

describe('EventDetailComponent', () => {
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let attendanceSpy: jasmine.SpyObj<AttendanceService>;
  let actualSpy: jasmine.SpyObj<ActualAttendanceService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let groupsSpy: jasmine.SpyObj<GroupsService>;

  const user: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['leader'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    { id: 2, ensembleId: 1, userId: 2, firstName: 'Petr', lastName: 'Novák', nickname: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    { id: 3, ensembleId: 1, userId: 3, firstName: 'Eva', lastName: 'Svobodová', nickname: 'Eva Svobodová', email: 'eva@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    // Cizí skupina – neměl by se počítat do souhrnu
    { id: 4, ensembleId: 1, userId: 4, firstName: 'Karel', lastName: 'Mimo', nickname: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
  ];

  const event: AppEvent = {
    id: 10, ensembleId: 1, title: 'Zkouška', type: 'rehearsal',
    startsAt: '2026-01-01T18:00:00', endsAt: '2026-01-01T20:00:00',
    location: 'Sál', targetGroupIds: [1],
  };

  function configure(records: AttendanceRecord[], actual: ActualAttendance[] = []): void {
    actualSpy = jasmine.createSpyObj('ActualAttendanceService', ['getForEvent', 'mark', 'markMany', 'clear']);
    actualSpy.getForEvent.and.returnValue(of(actual));
    actualSpy.mark.and.returnValue(of(actual[0]));
    actualSpy.markMany.and.returnValue(of([]));
    actualSpy.clear.and.returnValue(of(undefined));

    eventsSpy = jasmine.createSpyObj('EventsService', ['getEvent']);
    eventsSpy.getEvent.and.returnValue(of(event));

    attendanceSpy = jasmine.createSpyObj('AttendanceService', ['getAttendance', 'updateAttendance', 'markViewed']);
    attendanceSpy.getAttendance.and.returnValue(of(records));
    attendanceSpy.markViewed.and.returnValue(of(undefined));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroupsByIds']);
    groupsSpy.getGroupsByIds.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: EventsService, useValue: eventsSpy },
        { provide: AttendanceService, useValue: attendanceSpy },
        { provide: ActualAttendanceService, useValue: actualSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: GroupsService, useValue: groupsSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '10' } } } },
      ],
    });
  }

  it('započítá do souhrnu i členy bez záznamu jako "pending"', () => {
    configure([{ eventId: 10, memberId: 2, status: 'yes' }]);
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();

    const summary = fixture.componentInstance.attendanceSummary();
    expect(summary.yes).toBe(1);
    expect(summary.pending).toBe(2);
  });

  it('nezahrne do souhrnu člena mimo cílovou skupinu akce', () => {
    configure([]);
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();

    const names = fixture.componentInstance.visibleMembers().map((m) => m.nickname);
    expect(names).not.toContain('Karel Mimo');
    expect(names.length).toBe(3);
  });

  it('membersByStatus rozdělí členy podle stavu', () => {
    configure([{ eventId: 10, memberId: 2, status: 'no' }]);
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.membersByStatus().no.map((m) => m.nickname)).toEqual(['Petr Novák']);
    expect(fixture.componentInstance.membersByStatus().yes).toEqual([]);
  });

  it('viewedStatus rozdělí členy na ty, co akci zobrazili, a ty, co ne', () => {
    configure([{ eventId: 10, memberId: 2, status: 'pending', firstViewedAt: '2026-01-01T10:00:00' }]);
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();

    const status = fixture.componentInstance.viewedStatus();
    expect(status.viewed.map((m) => m.nickname)).toEqual(['Petr Novák']);
    expect(status.notViewed.map((m) => m.nickname)).toContain('Jana Nováková');
  });

  it('dotáže se na účast pro celou akci, ne jen pro přihlášeného člena', () => {
    configure([]);
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();

    expect(attendanceSpy.getAttendance).toHaveBeenCalledWith(10);
  });

  it('poznámku k účasti vidí i ostatní a na kliknutí se rozbalí', () => {
    configure([{ eventId: 10, memberId: 2, status: 'no', note: 'Pracovní povinnost' }]);
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.noteFor(2)).toBe('Pracovní povinnost');
    expect(component.noteFor(3)).toBeUndefined();
    component.toggleNote(2);
    expect(component.openNoteMemberId()).toBe(2);
    component.toggleNote(2);
    expect(component.openNoteMemberId()).toBeNull();
  });

  it('neaktivní členy do účasti nepočítá', () => {
    members.push({ ...members[0], id: 5, userId: 5, nickname: 'Bývalý', isActive: false });
    configure([]);
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    members.pop();

    expect(fixture.componentInstance.visibleMembers().map((m) => m.nickname)).not.toContain('Bývalý');
  });

  describe('skutečná docházka', () => {
    const actual = (memberId: number, present: boolean): ActualAttendance => ({
      eventId: 10, memberId, present, recordedByMemberId: 1, recordedAt: '2026-01-01T21:00:00Z',
    });

    it('vedoucímu u proběhlé akce ukáže očekávané členy s nahlášenou účastí a zapsanou přítomností', () => {
      configure([{ eventId: 10, memberId: 2, status: 'yes' }], [actual(2, false)]);
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.canRecordActual()).toBeTrue();
      const petr = component.actualRows().find((r) => r.member.id === 2)!;
      expect(petr.rsvp).toBe('yes');
      expect(petr.present).toBeFalse();
      expect(component.actualSummary()).toEqual({ present: 0, absent: 1, unchecked: 2 });
    });

    it('zapíše přítomnost za přihlášeného vedoucího a opětovné klepnutí záznam zruší', () => {
      configure([], [actual(2, true)]);
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.markActual(3, true);
      expect(actualSpy.mark).toHaveBeenCalledWith(10, 3, true, 1);
      component.markActual(2, true);
      expect(actualSpy.clear).toHaveBeenCalledWith(10, 2);
      expect(attendanceSpy.updateAttendance).not.toHaveBeenCalled();
    });

    it('„Ostatní nepřítomni“ označí jen nezkontrolované', () => {
      configure([], [actual(2, true)]);
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();

      fixture.componentInstance.markRestAbsent();
      expect(actualSpy.markMany).toHaveBeenCalledWith(10, [1, 3], false, 1);
    });

    it('běžnému členovi se sekce nezobrazí', () => {
      const original = user.roles;
      user.roles = ['member'];
      configure([]);
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.canRecordActual()).toBeFalse();
      expect(actualSpy.getForEvent).not.toHaveBeenCalled();
      user.roles = original;
    });
  });
});
