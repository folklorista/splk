import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BoardsService } from './boards.service';
import { AuthService } from '../../core/auth/auth.service';
import { GroupsService } from '../groups/groups.service';
import { MembersService } from '../members/members.service';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../posts/comments.service';
import { User } from '../../core/auth/models/user.model';
import { Group } from '../../core/models/group.model';
import { Member } from '../../core/models/member.model';
import { Post } from '../posts/models/post.model';
import { PostComment } from '../posts/models/comment.model';

describe('BoardsService', () => {
  const groups: Group[] = [
    { id: 1, ensembleId: 1, name: 'Tanečníci a tanečnice', slug: 'tanecnici' },
    { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' },
    { id: 3, ensembleId: 1, name: 'Vedení', slug: 'vedeni' },
  ];

  // Členství se bere z člena (spravuje ho administrace), ne ze statického User.groupIds
  const member: Member = { id: 7, ensembleId: 1, userId: 1, firstName: 'Jana', lastName: '', nickname: 'Jana', email: 'jana@soubor.cz', groupIds: [1, 2], isAdmin: false, isActive: true, createdAt: '2020-01-01' };

  const basePost: Post = {
    id: 1, ensembleId: 1, title: 'P', body: 'B', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [],
  };

  let user: User;

  function configure(posts: Post[] = [], comments: PostComment[] = []): BoardsService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: GroupsService, useValue: { getGroups: () => of(groups) } },
        { provide: MembersService, useValue: { getMemberByUserId: () => of(member) } },
        { provide: PostsService, useValue: { getPosts: () => of(posts) } },
        { provide: CommentsService, useValue: { getAllComments: () => of(comments) } },
      ],
    });
    return TestBed.inject(BoardsService);
  }

  beforeEach(() => {
    user = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [], roles: ['member'] };
  });

  it('getMyBoards vrátí jen nástěnky skupin, kterých je člen členem', (done) => {
    configure().getMyBoards().subscribe((boards) => {
      expect(boards.map((b) => b.id)).toEqual([1, 2]);
      done();
    });
  });

  it('getMyBoards vrátí administrátorovi všechny nástěnky', (done) => {
    user = { ...user, roles: ['member', 'admin'] };
    configure().getMyBoards().subscribe((boards) => {
      expect(boards.map((b) => b.id)).toEqual([1, 2, 3]);
      done();
    });
  });

  it('getBoardBySlug nevrátí nástěnku cizí skupiny', (done) => {
    configure().getBoardBySlug('vedeni').subscribe((board) => {
      expect(board).toBeUndefined();
      done();
    });
  });

  it('getBoardBySlug vrátí nástěnku vlastní skupiny', (done) => {
    configure().getBoardBySlug('kluci').subscribe((board) => {
      expect(board?.id).toBe(2);
      done();
    });
  });

  it('getBoardBadges spočítá badge pro každou dostupnou nástěnku', (done) => {
    const posts = [
      { ...basePost, id: 1, groupId: 1 },
      { ...basePost, id: 2, groupId: 2, readers: [7] },
      { ...basePost, id: 3, groupId: 3 },
    ];
    configure(posts).getBoardBadges().subscribe((badges) => {
      expect([...badges.entries()]).toEqual([[1, 1], [2, 0]]);
      done();
    });
  });

  it('bez přihlášeného uživatele nevrátí žádné nástěnky', (done) => {
    configure();
    user = null as unknown as User;
    TestBed.inject(BoardsService).getMyBoards().subscribe((boards) => {
      expect(boards).toEqual([]);
      done();
    });
  });
});
