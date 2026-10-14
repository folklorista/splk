import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { EventsService } from '../events/events.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';
import { AppEvent } from '../events/models/event.model';

describe('ProfileComponent', () => {
  let membersSpy: jasmine.SpyObj<MembersService>;
  let eventsSpy: jasmine.SpyObj<EventsService>;
  let authSpy: jasmine.SpyObj<AuthService>;

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
    firstName: 'Jana',
    lastName: 'Nováková',
    nickname: 'Jana Nováková',
    email: 'jana@soubor.cz',
    groupIds: [1, 2],
    isAdmin: false,
    isActive: true,
    createdAt: '2020-01-01',
  };

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['currentUser', 'refreshFromMember']);
    authSpy.currentUser.and.returnValue(mockUser);
    membersSpy = jasmine.createSpyObj('MembersService', ['getMemberByUserId', 'updateMember']);
    membersSpy.getMemberByUserId.and.returnValue(of(mockMember));
    membersSpy.updateMember.and.callFake((id, member) => of({ ...member, id }));

    eventsSpy = jasmine.createSpyObj('EventsService', ['getEvents']);
    eventsSpy.getEvents.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: EventsService, useValue: eventsSpy },
      ],
    }).compileComponents();
  });

  it('pendingEventCount napočítá nepotvrzené akce podle ID člena, ne uživatele', () => {
    const events: AppEvent[] = [
      { id: 1, ensembleId: 1, title: 'Bez odpovědi', type: 'rehearsal', startsAt: '2099-01-01T18:00:00', endsAt: '2099-01-01T20:00:00', location: '', targetGroupIds: [], attendance: [] },
      { id: 2, ensembleId: 1, title: 'Potvrzeno', type: 'rehearsal', startsAt: '2099-01-01T18:00:00', endsAt: '2099-01-01T20:00:00', location: '', targetGroupIds: [], attendance: [{ eventId: 2, memberId: mockMember.id, status: 'yes' }] },
    ];
    eventsSpy.getEvents.and.returnValue(of(events));

    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    expect(eventsSpy.getEvents).toHaveBeenCalled();
    expect(fixture.componentInstance.pendingEventCount).toBe(1);
  });

  it('pendingEventCount zůstane 0, když jsou všechny akce potvrzené', () => {
    const events: AppEvent[] = [
      { id: 1, ensembleId: 1, title: 'Potvrzeno', type: 'rehearsal', startsAt: '2099-01-01T18:00:00', endsAt: '2099-01-01T20:00:00', location: '', targetGroupIds: [], attendance: [{ eventId: 1, memberId: mockMember.id, status: 'no' }] },
    ];
    eventsSpy.getEvents.and.returnValue(of(events));

    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingEventCount).toBe(0);
  });

  it('předvyplní kontaktní údaje člena', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    expect(membersSpy.getMemberByUserId).toHaveBeenCalledWith(mockUser.id);
    expect(fixture.componentInstance.contactForm.value).toEqual({ nickname: 'Jana Nováková', email: 'jana@soubor.cz', phone: '' });
  });

  it('saveContact uloží změněnou přezdívku, e-mail a telefon a zbytek člena ponechá', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.contactForm.setValue({ nickname: ' Janička ', email: 'nova@soubor.cz', phone: ' 777 888 999 ' });
    component.saveContact();

    const { id, ...rest } = mockMember;
    expect(membersSpy.updateMember).toHaveBeenCalledWith(7, { ...rest, nickname: 'Janička', email: 'nova@soubor.cz', phone: '777 888 999' });
    expect(authSpy.refreshFromMember).toHaveBeenCalledWith(jasmine.objectContaining({ id: 7, nickname: 'Janička' }));
    expect(component.saved).toBeTrue();
  });

  it('saveContact povolí prázdný e-mail, ale ne prázdnou přezdívku', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.contactForm.setValue({ nickname: 'Jana', email: '', phone: '' });
    expect(component.contactForm.valid).toBeTrue();

    component.contactForm.setValue({ nickname: '', email: '', phone: '' });
    component.saveContact();
    expect(membersSpy.updateMember).not.toHaveBeenCalled();
  });

  it('saveContact neuloží neplatný e-mail', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.contactForm.setValue({ nickname: 'Jana', email: 'neplatny', phone: '' });
    component.saveContact();

    expect(membersSpy.updateMember).not.toHaveBeenCalled();
  });
});
