import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EventsComponent } from './events.component';
import { EventsService } from './events.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccessService } from '../../core/access/access.service';
import { createTestAccess, testMandate } from '../../testing/access.testing';
import { MembersService } from '../members/members.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';
import { AppEvent } from './models/event.model';
import { AttendanceService } from '../attendance/attendance.service';
import { SettingsService } from '../../core/settings/settings.service';

describe('EventsComponent', () => {
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let attendanceSpy: jasmine.SpyObj<AttendanceService>;

  const user: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz' };
  let env: ReturnType<typeof createTestAccess>;

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
    { id: 2, ensembleId: 1, userId: 2, firstName: 'Petr', lastName: 'Novák', nickname: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
    { id: 3, ensembleId: 1, userId: 3, firstName: 'Karel', lastName: 'Mimo', nickname: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isActive: true, createdAt: '2020-01-01' },
  ];

  const event: AppEvent = {
    id: 1, ensembleId: 1, title: 'Zkouška', type: 'rehearsal',
    startsAt: '2026-01-01T18:00:00', endsAt: '2026-01-01T20:00:00',
    location: 'Sál', targetGroupIds: [1],
    attendance: [{ eventId: 1, memberId: 2, status: 'yes' }],
  };

  beforeEach(() => {
    env = createTestAccess(members[0], { members });
  });

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
        { provide: AccessService, useValue: env.access },
        { provide: EventsService, useValue: eventsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: AttendanceService, useValue: attendanceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    });
  }

  it('počty odpovědí vidí evidence docházky a počítají jen členy cílových skupin', () => {
    env.mandates.set([testMandate(1, 'attendance')]);
    configure();
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.attendanceCounts(event)).toEqual({ yes: 1, no: 0, maybe: 0, pending: 1 });
  });

  it('běžný člen počty odpovědí nevidí', () => {
    configure();
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.attendanceCounts(event)).toBeNull();
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

  it('upozornění počítá nadcházející akce bez mé odpovědi a kliknutí zapne filtr nepotvrzených', () => {
    configure({ view: 'calendar' });
    const answered: AppEvent = { ...upcoming, id: 4, attendance: [{ eventId: 4, memberId: 1, status: 'yes' }] };
    eventsSpy.getEvents.and.returnValue(of([event, upcoming, answered, foreign]));
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.pendingCount()).toBe(1);
    component.showPending();
    expect(component.view()).toBe('list');
    expect(component.filteredEvents().map((e) => e.id)).toEqual([2]);
  });

  it('query parametr response=pending rovnou zapne filtr nepotvrzených', () => {
    configure({ response: 'pending' });
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.filters().response).toBe('pending');
  });

  it('tooltip dne vypíše čas a název akcí', () => {
    configure();
    const component = TestBed.createComponent(EventsComponent).componentInstance;
    expect(component.dayTooltip([upcoming, { ...upcoming, startsAt: '2099-03-01T20:30:00', title: 'Schůzka' }]))
      .toBe('18:00 – Budoucí\n20:30 – Schůzka');
  });

  it('bez query parametru otevře zobrazení podle nastavení', () => {
    configure();
    TestBed.inject(SettingsService).update({ eventsView: 'calendar' });
    const fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.view()).toBe('calendar');
  });
});
