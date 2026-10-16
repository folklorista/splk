import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BuildInfoService } from '../../build/build-info.service';
import { of } from 'rxjs';
import { MainLayoutComponent } from './main-layout.component';
import { AuthService } from '../../auth/auth.service';
import { MembersService } from '../../../features/members/members.service';
import { PostsService } from '../../../features/posts/posts.service';
import { EventsService } from '../../../features/events/events.service';
import { CommentsService } from '../../../features/posts/comments.service';
import { NotificationService } from '../../notifications/notification.service';
import { User } from '../../auth/models/user.model';
import { Member } from '../../models/member.model';
import { provideTestAccess } from '../../../testing/access.testing';
import { NavigationService } from '../navigation.service';
import { ActivityNotifierService } from '../../notifications/activity-notifier.service';

describe('MainLayoutComponent', () => {
  const user: User = { id: 1, name: 'Staňa', email: 'stana@soubor.cz' };
  const member: Member = {
    id: 5, ensembleId: 1, userId: 1, firstName: 'Staňa', lastName: '', nickname: 'Staňa', email: 'stana@soubor.cz', groupIds: [1],
    isActive: true, createdAt: '2020-01-01',
  };

  let notificationSpy: jasmine.SpyObj<NotificationService>;
  let commentsService: CommentsService;

  function configure(): void {
    const postsSpy = jasmine.createSpyObj('PostsService', ['getPosts']);
    postsSpy.getPosts.and.returnValue(of([]));
    const eventsSpy = jasmine.createSpyObj('EventsService', ['getEvents']);
    eventsSpy.getEvents.and.returnValue(of([]));
    const membersSpy = jasmine.createSpyObj('MembersService', ['getMembers', 'getMemberByUserId']);
    membersSpy.getMembers.and.returnValue(of([member]));
    membersSpy.getMemberByUserId.and.returnValue(of(member));
    notificationSpy = jasmine.createSpyObj('NotificationService', ['notify']);

    TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: BuildInfoService, useValue: { getBuildInfo: () => of(null) } },
        { provide: AuthService, useValue: { currentUser: () => user, isLoggedIn: () => true } },
        { provide: MembersService, useValue: membersSpy },
        { provide: PostsService, useValue: postsSpy },
        { provide: EventsService, useValue: eventsSpy },
        { provide: NotificationService, useValue: notificationSpy },
        provideTestAccess(member),
        { provide: ActivityNotifierService, useValue: { start: () => {} } },
        { provide: NavigationService, useValue: { start: () => {}, stop: () => {}, sections: () => [], bottomItems: () => [] } },
      ],
    });

    // Reálná CommentsService perzistuje do sdíleného localStorage – vyčistit před testem
    commentsService = TestBed.inject(CommentsService);
    // Komentáře „od jiného člena“ – oprávnění autora tu netestujeme
    spyOn(commentsService, 'addComment').and.callFake((postId, authorId, body, mentioned) => {
      (commentsService as any).commentsSubject.next([...(commentsService as any).commentsSubject.value, { id: 999 + mentioned.length, postId, authorId, body, createdAt: new Date().toISOString(), mentionedMemberIds: mentioned, seenByMemberIds: [] }]);
      return of(undefined as any);
    });
    commentsService.resetCache();
  }

  it('neupozorní na zmínky, které v datech existovaly už před spuštěním appky', fakeAsync(() => {
    configure();
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();
    tick();

    expect(notificationSpy.notify).not.toHaveBeenCalled();
  }));

  it('upozorní na novou zmínku, která se objeví během běhu appky', fakeAsync(() => {
    configure();
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();
    tick();

    commentsService.addComment(1, 2, 'Ahoj @Staňa', [member.id]).subscribe();
    tick(300);

    expect(notificationSpy.notify).toHaveBeenCalledWith('Nová zmínka', jasmine.stringMatching('zmínil'));
  }));

  it('neupozorní na komentář, který nezmiňuje přihlášeného člena', fakeAsync(() => {
    configure();
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();
    tick();

    commentsService.addComment(1, 2, 'Ahoj @Nekdo Jiny', [999]).subscribe();
    tick(300);

    expect(notificationSpy.notify).not.toHaveBeenCalled();
  }));
});
