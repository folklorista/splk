import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { PostsComponent } from './posts.component';
import { PostsService } from './posts.service';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { User } from '../../core/auth/models/user.model';
import { Member } from '../../core/models/member.model';
import { Post } from './models/post.model';
import { BoardsService } from '../boards/boards.service';
import { Group } from '../../core/models/group.model';
import { CommentsService } from './comments.service';
import { PostComment } from './models/comment.model';

describe('PostsComponent', () => {
  let postsSpy: jasmine.SpyObj<PostsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let comments$: BehaviorSubject<PostComment[]>;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const boards: Group[] = [
    { id: 1, ensembleId: 1, name: 'Dospělí', slug: 'dospeli' },
    { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' },
  ];

  const user: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['leader'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    { id: 2, ensembleId: 1, userId: 2, firstName: 'Petr', lastName: 'Novák', nickname: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
    { id: 3, ensembleId: 1, userId: 3, firstName: 'Karel', lastName: 'Mimo', nickname: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isAdmin: false, isActive: true, createdAt: '2020-01-01' },
  ];

  const post: Post = {
    id: 1, ensembleId: 1, title: 'Oznámení', body: 'Text', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [1],
  };

  function configure(): void {
    postsSpy = jasmine.createSpyObj('PostsService', ['getPosts']);
    postsSpy.getPosts.and.returnValue(of([post]));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    comments$ = new BehaviorSubject<PostComment[]>([]);
    paramMap$ = new BehaviorSubject(convertToParamMap({ slug: 'dospeli' }));

    TestBed.configureTestingModule({
      imports: [PostsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: PostsService, useValue: postsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: BoardsService, useValue: { getBoardBySlug: (slug: string) => of(boards.find((b) => b.slug === slug)) } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
        { provide: CommentsService, useValue: { getAllComments: () => comments$ } },
      ],
    });
  }

  it('readCountLabel počítá jen členy skupiny nástěnky', () => {
    configure();
    const fixture = TestBed.createComponent(PostsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.readCountLabel(post)).toBe('Přečteno 1 z 2');
  });

  it('authorName vrátí jméno autora podle authorId', () => {
    configure();
    const fixture = TestBed.createComponent(PostsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.authorName(post)).toBe('Jana Nováková');
  });

  it('visiblePosts vynechá archivované příspěvky', () => {
    configure();
    postsSpy.getPosts.and.returnValue(of([post, { ...post, id: 2, archivedAt: '2026-02-01T00:00:00' }]));
    const fixture = TestBed.createComponent(PostsComponent);
    fixture.detectChanges();

    const ids = fixture.componentInstance.visiblePosts().map((p) => p.id);
    expect(ids).toEqual([1]);
  });

  it('visiblePosts zobrazí jen příspěvky aktuální nástěnky a reaguje na změnu :slug', () => {
    configure();
    postsSpy.getPosts.and.returnValue(of([post, { ...post, id: 2, groupId: 2 }]));
    const fixture = TestBed.createComponent(PostsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.visiblePosts().map((p) => p.id)).toEqual([1]);

    paramMap$.next(convertToParamMap({ slug: 'kluci' }));
    expect(fixture.componentInstance.board()?.name).toBe('Kluci');
    expect(fixture.componentInstance.visiblePosts().map((p) => p.id)).toEqual([2]);
  });

  it('newCommentsCount reaguje na živý stream komentářů a počítá jen komentáře po poslední návštěvě', () => {
    configure();
    const visited: Post = { ...post, lastVisitedAt: { 1: '2026-01-02T00:00:00Z' } };
    postsSpy.getPosts.and.returnValue(of([visited]));
    const fixture = TestBed.createComponent(PostsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.newCommentsCount(visited)).toBe(0);

    const comment = (id: number, createdAt: string, authorId = 2): PostComment => ({
      id, postId: 1, authorId, body: 'x', createdAt, mentionedMemberIds: [], seenByMemberIds: [],
    });
    comments$.next([
      comment(1, '2026-01-01T10:00:00Z'),
      comment(2, '2026-01-03T10:00:00Z'),
      comment(3, '2026-01-04T10:00:00Z', 1),
    ]);

    expect(fixture.componentInstance.newCommentsCount(visited)).toBe(1);
  });

  it('newCommentsLabel skloňuje počet komentářů', () => {
    configure();
    const component = TestBed.createComponent(PostsComponent).componentInstance;

    expect(component.newCommentsLabel(1)).toBe('1 nový komentář');
    expect(component.newCommentsLabel(3)).toBe('3 nové komentáře');
    expect(component.newCommentsLabel(5)).toBe('5 nových komentářů');
  });
});
