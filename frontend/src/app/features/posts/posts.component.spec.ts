import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { PostsComponent } from './posts.component';
import { PostsService } from './posts.service';
import { AccessService } from '../../core/access/access.service';
import { createTestAccess, testMandate } from '../../testing/access.testing';
import { MembersService } from '../members/members.service';
import { Member } from '../../core/models/member.model';
import { Post } from './models/post.model';
import { Group } from '../../core/models/group.model';
import { CommentsService } from './comments.service';
import { PostComment } from './models/comment.model';

describe('PostsComponent', () => {
  let postsSpy: jasmine.SpyObj<PostsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let comments$: BehaviorSubject<PostComment[]>;
  let env: ReturnType<typeof createTestAccess>;

  const boards: Group[] = [
    { id: 1, ensembleId: 1, name: 'Dospělí', slug: 'dospeli' },
    { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' },
  ];

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: 'Nováková', nickname: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
    { id: 2, ensembleId: 1, userId: 2, firstName: 'Petr', lastName: 'Novák', nickname: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true, createdAt: '2020-01-01' },
    { id: 3, ensembleId: 1, userId: 3, firstName: 'Karel', lastName: 'Mimo', nickname: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isActive: true, createdAt: '2020-01-01' },
  ];

  const post: Post = {
    id: 1, ensembleId: 1, title: 'Oznámení', body: 'Text', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [1],
  };

  beforeEach(() => {
    env = createTestAccess(members[0], { members, groups: boards });
  });

  function create(board = boards[0]) {
    TestBed.configureTestingModule({
      imports: [PostsComponent],
      providers: [
        provideRouter([]),
        { provide: AccessService, useValue: env.access },
        { provide: PostsService, useValue: postsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: CommentsService, useValue: { getAllComments: () => comments$ } },
      ],
    });
    const fixture = TestBed.createComponent(PostsComponent);
    fixture.componentRef.setInput('board', board);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    postsSpy = jasmine.createSpyObj('PostsService', ['getPosts']);
    postsSpy.getPosts.and.returnValue(of([post]));
    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));
    comments$ = new BehaviorSubject<PostComment[]>([]);
  });

  it('readCountLabel počítá jen členy skupiny nástěnky', () => {
    const fixture = create();
    expect(fixture.componentInstance.readCountLabel(post)).toBe('Přečteno 1 z 2');
  });

  it('statistiky čtenosti vidí jen správce skupiny, ne Správa souboru', () => {
    const fixture = create();
    expect(fixture.componentInstance.canSeeReadStats()).toBeFalse();
    env.mandates.set([testMandate(1, 'ensemble-admin')]);
    expect(fixture.componentInstance.canSeeReadStats()).toBeFalse();
    env.mandates.set([testMandate(1, 'group-deputy', { groupId: 1 })]);
    expect(fixture.componentInstance.canSeeReadStats()).toBeTrue();
  });

  it('authorName vrátí jméno autora podle authorId', () => {
    const fixture = create();
    expect(fixture.componentInstance.authorName(post)).toBe('Jana Nováková');
  });

  it('visiblePosts vynechá archivované příspěvky', () => {
    postsSpy.getPosts.and.returnValue(of([post, { ...post, id: 2, archivedAt: '2026-02-01T00:00:00' }]));
    const fixture = create();
    expect(fixture.componentInstance.visiblePosts().map((p) => p.id)).toEqual([1]);
  });

  it('cizí skrytý příspěvek vidí jen moderátor, vlastní autor', () => {
    const hidden = (id: number, authorId: number): Post => ({ ...post, id, authorId, hiddenAt: '2026-02-01T00:00:00' });
    postsSpy.getPosts.and.returnValue(of([post, hidden(2, 2), hidden(3, 1)]));
    const fixture = create();
    expect(fixture.componentInstance.visiblePosts().map((p) => p.id).sort()).toEqual([1, 3]);
    env.mandates.set([testMandate(1, 'group-owner', { groupId: 1 })]);
    expect(fixture.componentInstance.visiblePosts().map((p) => p.id).sort()).toEqual([1, 2, 3]);
  });

  it('visiblePosts zobrazí jen příspěvky aktuální nástěnky a reaguje na změnu skupiny', () => {
    postsSpy.getPosts.and.returnValue(of([post, { ...post, id: 2, groupId: 2 }]));
    const fixture = create();
    expect(fixture.componentInstance.visiblePosts().map((p) => p.id)).toEqual([1]);

    fixture.componentRef.setInput('board', boards[1]);
    expect(fixture.componentInstance.visiblePosts().map((p) => p.id)).toEqual([2]);
  });

  it('newCommentsCount reaguje na živý stream komentářů a počítá jen komentáře po poslední návštěvě', () => {
    const visited: Post = { ...post, lastVisitedAt: { 1: '2026-01-02T00:00:00Z' } };
    postsSpy.getPosts.and.returnValue(of([visited]));
    const fixture = create();

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
    const component = create().componentInstance;
    expect(component.newCommentsLabel(1)).toBe('1 nový komentář');
    expect(component.newCommentsLabel(3)).toBe('3 nové komentáře');
    expect(component.newCommentsLabel(5)).toBe('5 nových komentářů');
  });
});
