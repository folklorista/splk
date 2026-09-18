import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EventsComponent } from './events.component';
import { EventsService } from './events.service';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';
import { AppEvent } from './models/event.model';

describe('EventsComponent', () => {
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;

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

  function configure(): void {
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
});
