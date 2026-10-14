import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BottomNavComponent } from './bottom-nav.component';
import { AuthService } from '../../auth/auth.service';
import { EventsService } from '../../../features/events/events.service';
import { MembersService } from '../../../features/members/members.service';
import { BoardsService } from '../../../features/boards/boards.service';
import { User } from '../../auth/models/user.model';
import { Group } from '../../models/group.model';
import { Member } from '../../models/member.model';

describe('BottomNavComponent', () => {
  const boards: Group[] = [
    { id: 1, ensembleId: 1, name: 'Výbor', slug: 'vybor' },
    { id: 2, ensembleId: 1, name: 'Taneční', slug: 'tanecni' },
    { id: 3, ensembleId: 1, name: 'Sklad', slug: 'sklad' },
  ];
  const member: Member = {
    id: 7, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'N', nickname: 'Jana', groupIds: [2],
    isAdmin: false, isActive: true, createdAt: '2020-01-01',
  };

  function create(user: User): BottomNavComponent {
    TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: MembersService, useValue: { getMemberByUserId: () => of(member) } },
        { provide: EventsService, useValue: { getEvents: () => of([]) } },
        // Admin dostane od služby všechny nástěnky
        { provide: BoardsService, useValue: { getMyBoards: () => of(boards), getBoardBadges: () => of(new Map([[2, 3]])) } },
      ],
    });
    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('ukáže jednotlivé nástěnky, kde je člen členem, s badge – bez profilu a rozcestníku', fakeAsync(() => {
    const nav = create({ id: 1, name: 'Jana', email: '', groupIds: [2], roles: ['member'] });
    tick();
    expect(nav.navItems().map((i) => i.path)).toEqual(['/app/dashboard', '/app/events', '/app/boards/tanecni']);
    expect(nav.navItems()[2].badge).toBe(3);
    discardPeriodicTasks();
  }));

  it('administrátor má navíc Administraci, ale jen nástěnky, kde je členem', fakeAsync(() => {
    const nav = create({ id: 1, name: 'Jana', email: '', groupIds: [2], roles: ['member', 'admin'] });
    tick();
    expect(nav.navItems().map((i) => i.path)).toEqual(['/app/dashboard', '/app/events', '/app/boards/tanecni', '/app/admin']);
    discardPeriodicTasks();
  }));
});
