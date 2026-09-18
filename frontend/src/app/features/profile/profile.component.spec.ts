import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { GroupsService } from '../groups/groups.service';
import { EventsService } from '../events/events.service';
import { User } from '../../core/auth/models/user.model';
import { Group } from '../../core/models/group.model';
import { Member } from '../../core/models/member.model';
import { AppEvent } from '../events/models/event.model';

describe('ProfileComponent', () => {
  let membersSpy: jasmine.SpyObj<MembersService>;
  let groupsSpy: jasmine.SpyObj<GroupsService>;
  let eventsSpy: jasmine.SpyObj<EventsService>;

  const mockUser: User = {
    id: 1,
    name: 'Jana Nováková',
    email: 'jana@soubor.cz',
    groupIds: [1, 2],
    roles: ['member'],
  };

  // ID člena záměrně odlišné od ID uživatele, aby test odhalil záměnu obou identifikátorů
  const mockMember: Member = {
    id: 7,
    ensembleId: 1,
    userId: 1,
    name: 'Jana Nováková',
    email: 'jana@soubor.cz',
    groupIds: [1, 2],
    isActive: true,
  };

  const mockGroups: Group[] = [
    { id: 1, ensembleId: 1, name: 'Mladší soubor', slug: 'mladsi-soubor' },
    { id: 2, ensembleId: 1, name: 'Kapela', slug: 'kapela' },
  ];

  beforeEach(async () => {
    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of([mockMember]));

    groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroups']);
    groupsSpy.getGroups.and.returnValue(of(mockGroups));

    eventsSpy = jasmine.createSpyObj('EventsService', ['getEvents']);
    eventsSpy.getEvents.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => mockUser } },
        { provide: MembersService, useValue: membersSpy },
        { provide: GroupsService, useValue: groupsSpy },
        { provide: EventsService, useValue: eventsSpy },
      ],
    }).compileComponents();
  });

  it('getGroupLabel vrátí název skupiny podle ID', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;

    expect(component.getGroupLabel(1)).toBe('Mladší soubor');
    expect(component.getGroupLabel(2)).toBe('Kapela');
  });

  it('getGroupLabel vrátí náhradní text pro neznámé ID', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;

    expect(component.getGroupLabel(99)).toBe('Neznámá skupina (ID: 99)');
  });

  it('pendingEventCount napočítá nepotvrzené akce podle ID člena, ne uživatele', () => {
    const events: AppEvent[] = [
      { id: 1, ensembleId: 1, title: 'Bez odpovědi', type: 'rehearsal', startsAt: '', endsAt: '', location: '', targetGroupIds: [], attendance: [] },
      { id: 2, ensembleId: 1, title: 'Potvrzeno', type: 'rehearsal', startsAt: '', endsAt: '', location: '', targetGroupIds: [], attendance: [{ eventId: 2, memberId: mockMember.id, status: 'yes' }] },
    ];
    eventsSpy.getEvents.and.returnValue(of(events));

    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    expect(eventsSpy.getEvents).toHaveBeenCalled();
    expect(fixture.componentInstance.pendingEventCount).toBe(1);
  });

  it('pendingEventCount zůstane 0, když jsou všechny akce potvrzené', () => {
    const events: AppEvent[] = [
      { id: 1, ensembleId: 1, title: 'Potvrzeno', type: 'rehearsal', startsAt: '', endsAt: '', location: '', targetGroupIds: [], attendance: [{ eventId: 1, memberId: mockMember.id, status: 'no' }] },
    ];
    eventsSpy.getEvents.and.returnValue(of(events));

    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingEventCount).toBe(0);
  });
});
