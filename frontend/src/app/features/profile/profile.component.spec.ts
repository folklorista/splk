import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { GroupsService } from '../groups/groups.service';
import { User } from '../../core/auth/models/user.model';
import { Group } from '../../core/models/group.model';

describe('ProfileComponent', () => {
  let membersSpy: jasmine.SpyObj<MembersService>;
  let groupsSpy: jasmine.SpyObj<GroupsService>;

  const mockUser: User = {
    id: 1,
    name: 'Jana Nováková',
    email: 'jana@soubor.cz',
    groupIds: [1, 2],
    roles: ['member'],
  };

  const mockGroups: Group[] = [
    { id: 1, ensembleId: 1, name: 'Mladší soubor', slug: 'mladsi-soubor' },
    { id: 2, ensembleId: 1, name: 'Kapela', slug: 'kapela' },
  ];

  beforeEach(async () => {
    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of([]));

    groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroups']);
    groupsSpy.getGroups.and.returnValue(of(mockGroups));

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => mockUser } },
        { provide: MembersService, useValue: membersSpy },
        { provide: GroupsService, useValue: groupsSpy },
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
});
