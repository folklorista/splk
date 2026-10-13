import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EventsComponent } from './events.component';
import { EventsService } from './events.service';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';
import { AppEvent } from './models/event.model';
import { AttendanceService } from '../attendance/attendance.service';

describe('EventsComponent', () => {
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let attendanceSpy: jasmine.SpyObj<AttendanceService>;

  const user: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['member'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, name: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true },
    { id: 2, ensembleId: 1, userId: 2, name: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true },
    { id: 3, ensembleId: 1, userId: 3, name: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isActive: true },
  ];

  const event: AppEvent = {
    id: 1, ensembleId: 1, title: 'Zkouška', type: 'rehearsal',
    startsAt: '2026-01-01T18:00:00', endsAt: '2026-01-01T20:00:00',
    location: 'Sál', targetGroupIds: [1],
    attendance: [{ eventId: 1, memberId: 2, status: 'yes' }],
  };

  function configure(queryParams: Record<string, string> = {}): void {
    attendanceSpy = jasmine.createSpyObj('AttendanceService', ['setStatus']);
    attendanceSpy.setStatus.and.returnValue(of({ eventId: 0, memberId: 0, status: 'yes' }));

    eventsSpy = jasmine.createSpyObj('EventsService', ['getEvents']);
    eventsSpy.getEvents.and.returnValue(of([event]));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: EventsService, useValue: eventsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: AttendanceService, useValue: attendanceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    });
  }

  it('attendanceSummary počítá jen viditelné členy a chybějící záznam jako neodpovědělo', () => {
    configure();
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    const summary = fixture.componentInstance.attendanceSummary(event);
    expect(summary).toEqual({ yes: 1, no: 0, maybe: 0, pending: 1 });
  });

  const upcoming: AppEvent = {
    ...event, id: 2, title: 'Budoucí', startsAt: '2099-03-01T18:00:00', endsAt: '2099-03-01T20:00:00', attendance: [],
  };
  const foreign: AppEvent = { ...upcoming, id: 3, targetGroupIds: [99] };

  it('seznam ukáže jen nadcházející akce pro skupiny uživatele', () => {
    configure();
    eventsSpy.getEvents.and.returnValue(of([event, upcoming, foreign]));
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.upcomingEvents().map((e) => e.id)).toEqual([2]);
  });

  it('otevře kalendář podle query parametru view=calendar', () => {
    configure({ view: 'calendar' });
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.view()).toBe('calendar');
  });

  it('po výběru dne v kalendáři vrátí akce toho dne a přepne měsíc', () => {
    configure();
    eventsSpy.getEvents.and.returnValue(of([event, upcoming, foreign]));
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectDay('2099-03-01');

    expect(fixture.componentInstance.selectedDayEvents().map((e) => e.id)).toEqual([2]);
    expect(fixture.componentInstance.monthTitle()).toBe('Březen 2099');
  });

  it('rychlé potvrzení uloží stav přes službu a hned ho promítne do akce', () => {
    configure();
    eventsSpy.getEvents.and.returnValue(of([upcoming]));
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    fixture.componentInstance.setStatus(upcoming.id, 'no');

    expect(attendanceSpy.setStatus).toHaveBeenCalledWith(upcoming.id, 1, 'no');
    expect(fixture.componentInstance.ownStatus(fixture.componentInstance.events()[0])).toBe('no');
  });
});
