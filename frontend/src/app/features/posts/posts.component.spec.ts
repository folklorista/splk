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

describe('PostsComponent', () => {
  let postsSpy: jasmine.SpyObj<PostsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const boards: Group[] = [
    { id: 1, ensembleId: 1, name: 'Dospělí', slug: 'dospeli' },
    { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' },
  ];

  const user: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['leader'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, name: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true },
    { id: 2, ensembleId: 1, userId: 2, name: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true },
    { id: 3, ensembleId: 1, userId: 3, name: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isActive: true },
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
});
