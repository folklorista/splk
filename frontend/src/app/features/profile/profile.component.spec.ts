import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';

describe('ProfileComponent', () => {
  let membersSpy: jasmine.SpyObj<MembersService>;
  let authSpy: jasmine.SpyObj<AuthService>;

  const mockUser: User = {
    id: 1,
    name: 'Jana Nováková',
    email: 'jana@soubor.cz',

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
    isActive: true,
    createdAt: '2020-01-01',
  };

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['currentUser', 'refreshFromMember']);
    authSpy.currentUser.and.returnValue(mockUser);
    membersSpy = jasmine.createSpyObj('MembersService', ['getMemberByUserId', 'updateMember']);
    membersSpy.getMemberByUserId.and.returnValue(of(mockMember));
    membersSpy.updateMember.and.callFake((id, member) => of({ ...member, id }));


    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: MembersService, useValue: membersSpy },
      ],
    }).compileComponents();
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
