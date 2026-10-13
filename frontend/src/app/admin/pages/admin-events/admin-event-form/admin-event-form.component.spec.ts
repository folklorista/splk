import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { AdminEventFormComponent } from './admin-event-form.component';
import { EventsService } from '../../../../features/events/events.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { MembersService } from '../../../../features/members/members.service';
import { AttendanceService } from '../../../../features/attendance/attendance.service';
import { AppEvent } from '../../../../features/events/models/event.model';
import { Member } from '../../../../core/models/member.model';
import { AttendanceRecord } from '../../../../features/attendance/models/attendance.model';

describe('AdminEventFormComponent', () => {
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let attendanceSpy: jasmine.SpyObj<AttendanceService>;

  const event: AppEvent = {
    id: 1, ensembleId: 1, title: 'Zkouška', type: 'rehearsal',
    startsAt: '2026-01-01T18:00:00', endsAt: '2026-01-01T20:00:00',
    location: 'Sál', targetGroupIds: [1],
  };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, name: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true },
    { id: 2, ensembleId: 1, userId: 2, name: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true },
    { id: 3, ensembleId: 1, userId: 3, name: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isActive: true },
  ];

  function configure(records: AttendanceRecord[], paramMap: Record<string, string> = { id: '1' }): void {
    eventsSpy = jasmine.createSpyObj('EventsService', ['getEvent', 'updateEvent', 'createEvent']);
    eventsSpy.getEvent.and.returnValue(of(event));
    eventsSpy.updateEvent.and.returnValue(of(event));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    attendanceSpy = jasmine.createSpyObj('AttendanceService', ['getAttendance', 'updateAttendance']);
    attendanceSpy.getAttendance.and.returnValue(of(records));
    attendanceSpy.updateAttendance.and.returnValue(of(records[0]));

    TestBed.configureTestingModule({
      imports: [AdminEventFormComponent],
      providers: [
        provideRouter([]),
        { provide: EventsService, useValue: eventsSpy },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: MembersService, useValue: membersSpy },
        { provide: AttendanceService, useValue: attendanceSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => paramMap[key] ?? null } } },
        },
      ],
    });
  }

  it('zobrazí jen členy z cílových skupin akce', () => {
    configure([]);
    const fixture = TestBed.createComponent(AdminEventFormComponent);
    fixture.detectChanges();

    const names = fixture.componentInstance.attendanceMembers().map((m) => m.name);
    expect(names).toEqual(['Jana Nováková', 'Petr Novák']);
  });

  it('zpřístupní poznámku člena, pokud ji vyplnil', () => {
    configure([{ eventId: 1, memberId: 1, status: 'yes', note: 'Přijedu později' }]);
    const fixture = TestBed.createComponent(AdminEventFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.noteByMember().get(1)).toBe('Přijedu později');
    expect(fixture.componentInstance.noteByMember().get(2)).toBeUndefined();
  });

  it('chybějící záznam znamená stav pending a nezobrazeno', () => {
    configure([{ eventId: 1, memberId: 1, status: 'yes' }]);
    const fixture = TestBed.createComponent(AdminEventFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingStatuses().get(1)).toBe('yes');
    expect(fixture.componentInstance.pendingStatuses().get(2)).toBe('pending');
    expect(fixture.componentInstance.viewedAtByMember().get(2)).toBeUndefined();
  });

  it('setMemberStatus jen upraví lokální stav, neuloží hned', () => {
    configure([]);
    const fixture = TestBed.createComponent(AdminEventFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.setMemberStatus(1, 'no');

    expect(fixture.componentInstance.pendingStatuses().get(1)).toBe('no');
    expect(attendanceSpy.updateAttendance).not.toHaveBeenCalled();
  });

  it('onSubmit uloží jen změněné stavy účasti', () => {
    configure([{ eventId: 1, memberId: 1, status: 'yes' }]);
    const fixture = TestBed.createComponent(AdminEventFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.setMemberStatus(2, 'no');
    fixture.componentInstance.onSubmit();

    expect(eventsSpy.updateEvent).toHaveBeenCalled();
    expect(attendanceSpy.updateAttendance).toHaveBeenCalledTimes(1);
    expect(attendanceSpy.updateAttendance).toHaveBeenCalledWith(
      jasmine.objectContaining({ memberId: 2, status: 'no' }),
    );
  });

  it('onSubmit neukládá účast, pokud se nic nezměnilo', () => {
    configure([{ eventId: 1, memberId: 1, status: 'yes' }]);
    const fixture = TestBed.createComponent(AdminEventFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();

    expect(eventsSpy.updateEvent).toHaveBeenCalled();
    expect(attendanceSpy.updateAttendance).not.toHaveBeenCalled();
  });

  it('načte cílení akce a odešle ho při uložení', () => {
    configure([], { id: '1' });
    eventsSpy.getEvent.and.returnValue(of({ ...event, targetGroupIds: [1] }));
    const fixture = TestBed.createComponent(AdminEventFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.targetGroupIds()).toEqual([1]);

    fixture.componentInstance.targetGroupIds.set([1, 2]);
    fixture.componentInstance.onSubmit();

    expect(eventsSpy.updateEvent).toHaveBeenCalledWith(1, jasmine.objectContaining({
      targetGroupIds: [1, 2],
    }));
  });
});
