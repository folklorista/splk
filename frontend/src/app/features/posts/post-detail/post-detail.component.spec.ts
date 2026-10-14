import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { PostDetailComponent } from './post-detail.component';
import { PostsService } from '../posts.service';
import { CommentsService } from '../comments.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { User } from '../../../core/auth/models/user.model';
import { Member } from '../../../core/models/member.model';
import { Post } from '../models/post.model';
import { PostComment } from '../models/comment.model';
import { BoardsService } from '../../boards/boards.service';
import { Group } from '../../../core/models/group.model';

const board: Group = { id: 1, ensembleId: 1, name: 'Dospělí', slug: 'dospeli' };

describe('PostDetailComponent', () => {
  let postsSpy: jasmine.SpyObj<PostsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let commentsSpy: jasmine.SpyObj<CommentsService>;
  let boardsSpy: jasmine.SpyObj<BoardsService>;
  let currentUser: User;

  const authorUser: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['leader'] };
  const otherMemberUser: User = { id: 2, name: 'Petr', email: 'petr@soubor.cz', groupIds: [1], roles: ['member'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    { id: 2, ensembleId: 1, userId: 2, firstName: 'Petr', lastName: 'Novák', nickname: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    { id: 3, ensembleId: 1, userId: 3, firstName: 'Karel', lastName: 'Mimo', nickname: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    { id: 4, ensembleId: 1, userId: 4, firstName: 'Eva', lastName: 'Svobodová', nickname: 'Eva Svobodová', email: 'eva@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
  ];

  const post: Post = {
    id: 5, ensembleId: 1, title: 'Oznámení', body: 'Text', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [2],
  };

  function configure(user: User = authorUser, accessibleBoard: Group | null = board): void {
    currentUser = user;
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

  it('canManage je true pro autora příspěvku', () => {
    configure(authorUser);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.canManage).toBeTrue();
  });

  it('canManage je false pro člena, který není autor ani vedoucí/admin', () => {
    configure(otherMemberUser);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.canManage).toBeFalse();
  });

  it('archivePost zavolá archivaci a přesměruje na nástěnku, po potvrzení', () => {
    configure(authorUser);
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.archivePost();

    expect(postsSpy.archivePost).toHaveBeenCalledWith(5);
    expect(router.navigate).toHaveBeenCalledWith(['/app/boards', 'dospeli']);
  });

  it('archivePost nic neudělá bez potvrzení', () => {
    configure(authorUser);
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.archivePost();

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

  function typeInto(fixture: { componentInstance: PostDetailComponent }, text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setSelectionRange(text.length, text.length);
    fixture.componentInstance.onCommentInput(textarea);
  }

  it('po napsání „@“ nabídne členy nástěnky kromě sebe, filtrované textem za „@“', () => {
    configure(authorUser);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    typeInto(fixture, 'Ahoj @');
    const all = fixture.componentInstance.mentionSuggestions().map((m) => m.id);
    expect(all).not.toContain(1); // přihlášený sám sebe
    expect(all).not.toContain(3); // není členem skupiny nástěnky
    expect(all).toEqual(jasmine.arrayContaining([2, 4]));

    typeInto(fixture, 'Ahoj @petr');
    expect(fixture.componentInstance.mentionSuggestions().map((m) => m.id)).toEqual([2]);
  });

  it('výběr z nabídky doplní přezdívku a odeslání ji uloží jako token se zmínkou', () => {
    configure(authorUser);
    const newComment: PostComment = {
      id: 20, postId: 5, authorId: 1, body: 'Test @[member:2] ', createdAt: '2026-01-03T00:00:00',
      mentionedMemberIds: [2], seenByMemberIds: [],
    };
    commentsSpy.addComment.and.returnValue(of(newComment));
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    typeInto(fixture, 'Test @Pe');
    component.chooseMention(component.mentionSuggestions()[0]);
    expect(component.newCommentBody()).toBe('Test @Petr Novák ');
    expect(component.mentionSuggestions()).toEqual([]);

    component.submitComment();

    expect(commentsSpy.addComment).toHaveBeenCalledWith(5, 1, 'Test @[member:2]', [2]);
    expect(component.comments()).toContain(newComment);
    expect(component.newCommentBody()).toBe('');
    expect(component.selectedMentions()).toEqual([]);
  });

  it('když uživatel jméno po výběru přepíše, zmínka se neuloží', () => {
    configure(authorUser);
    commentsSpy.addComment.and.returnValue(of({ id: 21, postId: 5, authorId: 1, body: '', createdAt: '', mentionedMemberIds: [], seenByMemberIds: [] }));
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    typeInto(fixture, '@Pe');
    component.chooseMention(component.mentionSuggestions()[0]);
    component.newCommentBody.set('@Petře pojď');
    component.submitComment();

    expect(commentsSpy.addComment).toHaveBeenCalledWith(5, 1, '@Petře pojď', []);
  });

  it('komentář se zmínkou vykreslí jménem člena podle tokenu', () => {
    configure(authorUser);
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const segments = component.commentSegments({ id: 1, postId: 5, authorId: 1, body: 'Díky @[member:2]!', createdAt: '', mentionedMemberIds: [2], seenByMemberIds: [] });
    expect(segments.length).toBe(3);
    expect(component.memberNickname(2)).toBe('Petr Novák');
  });
});

describe('PostDetailComponent s reálnou CommentsService (živý stream)', () => {
  // Regrese: getComments() je živý stream, který se znovu spustí i po vlastním
  // addComment() volání – zápis do this.comments musí zůstat idempotentní.
  const authorUser: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['member'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
  ];

  const post: Post = {
    id: 5, ensembleId: 1, title: 'Oznámení', body: 'Text', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [1],
  };

  it('nepřidá právě odeslaný komentář dvakrát', fakeAsync(() => {
    const postsSpy = jasmine.createSpyObj('PostsService', ['getPost', 'markAsRead', 'markVisited']);
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

    fixture.componentInstance.newCommentBody.set('Ahoj všem');
    fixture.componentInstance.submitComment();
    tick(300);

    const matching = fixture.componentInstance.comments().filter((c) => c.body === 'Ahoj všem');
    expect(matching.length).toBe(1);
  }));
});
