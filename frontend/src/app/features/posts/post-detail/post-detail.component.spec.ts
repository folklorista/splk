import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { PostDetailComponent } from './post-detail.component';
import { PostsService } from '../posts.service';
import { CommentsService } from '../comments.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessService } from '../../../core/access/access.service';
import { createTestAccess, testMandate } from '../../../testing/access.testing';
import { MembersService } from '../../members/members.service';
import { User } from '../../../core/auth/models/user.model';
import { Member } from '../../../core/models/member.model';
import { Post } from '../models/post.model';
import { PostComment } from '../models/comment.model';
import { BoardsService } from '../../boards/boards.service';
import { Group } from '../../../core/models/group.model';
import { ConfirmService } from '../../../shared/dialog/confirm.service';

const board: Group = { id: 1, ensembleId: 1, name: 'Dospělí', slug: 'dospeli' };

describe('PostDetailComponent', () => {
  let postsSpy: jasmine.SpyObj<PostsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let commentsSpy: jasmine.SpyObj<CommentsService>;
  let boardsSpy: jasmine.SpyObj<BoardsService>;
  let currentUser: User;

  const authorUser: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz' };
  const otherMemberUser: User = { id: 2, name: 'Petr', email: 'petr@soubor.cz' };
  let env: ReturnType<typeof createTestAccess>;

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
    { id: 2, ensembleId: 1, userId: 2, firstName: 'Petr', lastName: 'Novák', nickname: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
    { id: 3, ensembleId: 1, userId: 3, firstName: 'Karel', lastName: 'Mimo', nickname: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isActive: true, createdAt: '2020-01-01' },
    { id: 4, ensembleId: 1, userId: 4, firstName: 'Eva', lastName: 'Svobodová', nickname: 'Eva Svobodová', email: 'eva@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
  ];

  const post: Post = {
    id: 5, ensembleId: 1, title: 'Oznámení', body: 'Text', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [2],
  };

  function configure(user: User = authorUser, accessibleBoard: Group | null = board): void {
    currentUser = user;
    env = createTestAccess(members.find((m) => m.userId === user.id)!, { members, mandates: env?.mandates() ?? [] });
    postsSpy = jasmine.createSpyObj('PostsService', ['getPost', 'markAsRead', 'markVisited', 'archivePost']);
    postsSpy.markVisited.and.returnValue(of(undefined));
    postsSpy.getPost.and.returnValue(of(post));
    postsSpy.markAsRead.and.returnValue(of(undefined));
    postsSpy.archivePost.and.returnValue(of(post));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    commentsSpy = jasmine.createSpyObj('CommentsService', ['getComments', 'addComment', 'markSeen']);
    commentsSpy.getComments.and.returnValue(of([]));
    commentsSpy.markSeen.and.returnValue(of(undefined));

    boardsSpy = jasmine.createSpyObj('BoardsService', ['getBoardById']);
    boardsSpy.getBoardById.and.returnValue(of(accessibleBoard ?? undefined));

    TestBed.configureTestingModule({
      imports: [PostDetailComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => currentUser } },
        { provide: AccessService, useValue: env.access },
        { provide: PostsService, useValue: postsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: CommentsService, useValue: commentsSpy },
        { provide: BoardsService, useValue: boardsSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
      ],
    });
  }

  it('rozdělí viditelné členy na ty, co četli, a ty, co nečetli (přihlášený je po otevření automaticky mezi čtenáři)', () => {
    configure();
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    const status = fixture.componentInstance.readStatus();
    expect(status.read.map((m) => m.nickname).sort()).toEqual(['Jana Nováková', 'Petr Novák']);
    expect(status.unread.map((m) => m.nickname)).toEqual(['Eva Svobodová']);
  });

  it('příspěvek z nástěnky, kam uživatel nemá přístup, se nezobrazí ani neoznačí za přečtený', () => {
    configure(authorUser, null);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(boardsSpy.getBoardById).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.componentInstance.post()).toBeNull();
    expect(postsSpy.markAsRead).not.toHaveBeenCalled();
    expect(postsSpy.markVisited).not.toHaveBeenCalled();
  });

  it('nezahrne do přehledu člena mimo skupinu nástěnky', () => {
    configure();
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    const names = fixture.componentInstance.visibleMembers().map((m) => m.nickname);
    expect(names).not.toContain('Karel Mimo');
  });

  it('označí příspěvek za přečtený přihlášeným členem, pokud ho ještě nečetl', () => {
    configure();
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(postsSpy.markAsRead).toHaveBeenCalledWith(5, 1);
  });

  it('zaznamená návštěvu při otevření i při opuštění detailu', () => {
    configure();
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(postsSpy.markVisited).toHaveBeenCalledTimes(1);
    expect(postsSpy.markVisited).toHaveBeenCalledWith(5, 1);

    fixture.destroy();
    expect(postsSpy.markVisited).toHaveBeenCalledTimes(2);
  });

  it('nevolá markAsRead, pokud už člen příspěvek přečetl', () => {
    configure();
    postsSpy.getPost.and.returnValue(of({ ...post, readers: [1, 2] }));
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(postsSpy.markAsRead).not.toHaveBeenCalled();
  });

  it('autor smí upravit a archivovat, ale nemoderuje', () => {
    configure(authorUser);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isAuthor()).toBeTrue();
    expect(fixture.componentInstance.canArchive()).toBeTrue();
    expect(fixture.componentInstance.canModerate()).toBeFalse();
  });

  it('běžný člen cizí příspěvek neupraví ani nearchivuje', () => {
    configure(otherMemberUser);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isAuthor()).toBeFalse();
    expect(fixture.componentInstance.canArchive()).toBeFalse();
  });

  it('spolusprávce skupiny moderuje cizí příspěvek, ale neupravuje ho', () => {
    configure(otherMemberUser);
    env.mandates.set([testMandate(2, 'group-deputy', { groupId: 1 })]);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.canModerate()).toBeTrue();
    expect(fixture.componentInstance.canArchive()).toBeTrue();
    expect(fixture.componentInstance.isAuthor()).toBeFalse();
    expect(fixture.componentInstance.canSeeReadStats()).toBeTrue();
    env.mandates.set([]);
  });

  it('archivePost po potvrzení zavolá archivaci a příspěvek zůstane otevřený jako archivovaný', async () => {
    configure(authorUser);
    postsSpy.archivePost.and.returnValue(of({ ...post, archivedAt: '2026-02-01T00:00:00' }));
    spyOn(TestBed.inject(ConfirmService), 'confirm').and.resolveTo(true);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    await fixture.componentInstance.archivePost();

    expect(postsSpy.archivePost).toHaveBeenCalledWith(5);
    expect(fixture.componentInstance.post()?.archivedAt).toBeTruthy();
  });

  it('cizí skrytý příspěvek běžnému členovi nezobrazí', () => {
    configure(otherMemberUser);
    postsSpy.getPost.and.returnValue(of({ ...post, hiddenAt: '2026-02-01T00:00:00' }));
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.notFound()).toBeTrue();
  });

  it('archivePost nic neudělá bez potvrzení', async () => {
    configure(authorUser);
    spyOn(TestBed.inject(ConfirmService), 'confirm').and.resolveTo(false);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    await fixture.componentInstance.archivePost();

    expect(postsSpy.archivePost).not.toHaveBeenCalled();
  });

  it('při zobrazení označí nezobrazené zmínky přihlášeného člena jako viděné', () => {
    configure(authorUser);
    const comment: PostComment = {
      id: 10, postId: 5, authorId: 2, body: 'Ahoj @Jana', createdAt: '2026-01-02T00:00:00',
      mentionedMemberIds: [1], seenByMemberIds: [],
    };
    commentsSpy.getComments.and.returnValue(of([comment]));

    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(commentsSpy.markSeen).toHaveBeenCalledWith(10, 1);
  });

  it('neoznačí zmínku jiného člena jako viděnou', () => {
    configure(authorUser);
    const comment: PostComment = {
      id: 11, postId: 5, authorId: 2, body: 'Ahoj @Petr', createdAt: '2026-01-02T00:00:00',
      mentionedMemberIds: [2], seenByMemberIds: [],
    };
    commentsSpy.getComments.and.returnValue(of([comment]));

    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(commentsSpy.markSeen).not.toHaveBeenCalled();
  });

  it('zmínit lze členy nástěnky kromě sebe; nečlen skupiny v nabídce není', () => {
    configure(authorUser);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    const ids = fixture.componentInstance.mentionableMembers().map((m) => m.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(3);
    expect(ids).toEqual(jasmine.arrayContaining([2, 4]));
  });

  it('odeslaný komentář (už se zakódovanými odkazy) se uloží a zobrazí', () => {
    configure(authorUser);
    const newComment: PostComment = {
      id: 20, postId: 5, authorId: 1, body: 'Test @[member:2] #[event:4]', createdAt: '2026-01-03T00:00:00',
      mentionedMemberIds: [2], seenByMemberIds: [],
    };
    commentsSpy.addComment.and.returnValue(of(newComment));
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.submitComment({ body: 'Test @[member:2] #[event:4]', mentionedMemberIds: [2] });
    expect(commentsSpy.addComment).toHaveBeenCalledWith(5, 1, 'Test @[member:2] #[event:4]', [2]);
    expect(component.comments()).toContain(newComment);
  });
});

describe('PostDetailComponent s reálnou CommentsService (živý stream)', () => {
  // Regrese: getComments() je živý stream, který se znovu spustí i po vlastním
  // addComment() volání – zápis do this.comments musí zůstat idempotentní.
  const authorUser: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz' };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
  ];

  const post: Post = {
    id: 5, ensembleId: 1, title: 'Oznámení', body: 'Text', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [1],
  };

  it('nepřidá právě odeslaný komentář dvakrát', fakeAsync(() => {
    const postsSpy = jasmine.createSpyObj('PostsService', ['getPost', 'markAsRead', 'markVisited', 'findPost']);
    postsSpy.findPost.and.returnValue(post);
    postsSpy.markVisited.and.returnValue(of(undefined));
    postsSpy.getPost.and.returnValue(of(post));
    postsSpy.markAsRead.and.returnValue(of(undefined));

    const membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    TestBed.configureTestingModule({
      imports: [PostDetailComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => authorUser } },
        { provide: AccessService, useValue: createTestAccess(members[0], { members }).access },
        { provide: PostsService, useValue: postsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: BoardsService, useValue: { getBoardById: () => of(board) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
      ],
    });

    // Reálná CommentsService teď perzistuje do localStorage sdíleného napříč
    // celou testovací sadou – bez resetu by test mohl vidět pozůstatky z jiných testů.
    TestBed.inject(CommentsService).resetCache();

    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    tick(300);

    fixture.componentInstance.submitComment({ body: 'Ahoj všem', mentionedMemberIds: [] });
    tick(300);

    const matching = fixture.componentInstance.comments().filter((c) => c.body === 'Ahoj všem');
    expect(matching.length).toBe(1);
  }));
});
