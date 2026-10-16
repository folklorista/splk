import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BoardsService } from './boards.service';
import { AccessService } from '../../core/access/access.service';
import { GroupsService } from '../groups/groups.service';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../posts/comments.service';
import { Group } from '../../core/models/group.model';
import { Post } from '../posts/models/post.model';
import { PostComment } from '../posts/models/comment.model';
import { createTestAccess, testMandate, testMember } from '../../testing/access.testing';

describe('BoardsService', () => {
  const groups: Group[] = [
    { id: 1, ensembleId: 1, name: 'Tanečníci a tanečnice', slug: 'tanecnici' },
    { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' },
    { id: 3, ensembleId: 1, name: 'Vedení', slug: 'vedeni' },
    { id: 4, ensembleId: 1, name: 'Otevřená', slug: 'otevrena', visibility: 'open' },
  ];
  const member = testMember({ id: 7, groupIds: [1, 2] });

  const basePost: Post = {
    id: 1, ensembleId: 1, title: 'P', body: 'B', authorId: 1, groupId: 1,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [],
  };

  let env: ReturnType<typeof createTestAccess>;

  function configure(posts: Post[] = [], comments: PostComment[] = []): BoardsService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessService, useValue: env.access },
        { provide: GroupsService, useValue: { groups: env.groups } },
        { provide: PostsService, useValue: { getPosts: () => of(posts) } },
        { provide: CommentsService, useValue: { getAllComments: () => of(comments) } },
      ],
    });
    return TestBed.inject(BoardsService);
  }

  beforeEach(() => {
    env = createTestAccess(member, { groups: groups.map((g) => ({ ...g })) });
  });

  it('getMyBoards vrátí jen skupiny, kterých je člen členem', (done) => {
    configure().getMyBoards().subscribe((boards) => {
      expect(boards.map((b) => b.id)).toEqual([1, 2]);
      done();
    });
  });

  it('Správa souboru nevidí obsah cizích soukromých skupin', (done) => {
    env.mandates.set([testMandate(7, 'ensemble-admin'), testMandate(7, 'group-owner', { groupId: 3 })]);
    const service = configure();
    service.getMyBoards().subscribe((boards) => {
      expect(boards.map((b) => b.id)).toEqual([1, 2]);
      service.getBoardBySlug('vedeni').subscribe((board) => {
        expect(board).toBeUndefined();
        done();
      });
    });
  });

  it('getBoardBySlug pustí do otevřené skupiny i nečlena (čtení)', (done) => {
    configure().getBoardBySlug('otevrena').subscribe((board) => {
      expect(board?.id).toBe(4);
      done();
    });
  });

  it('getBoardBySlug vrátí vlastní skupinu', (done) => {
    configure().getBoardBySlug('kluci').subscribe((board) => {
      expect(board?.id).toBe(2);
      done();
    });
  });

  it('getBoardBadges spočítá badge pro každou skupinu z menu (bez cizích skrytých příspěvků)', (done) => {
    const posts = [
      { ...basePost, id: 1, groupId: 1 },
      { ...basePost, id: 2, groupId: 2, readers: [7] },
      { ...basePost, id: 3, groupId: 3 },
      { ...basePost, id: 4, groupId: 1, hiddenAt: '2026-01-02T00:00:00' },
    ];
    configure(posts).getBoardBadges().subscribe((badges) => {
      expect([...badges.entries()]).toEqual([[1, 1], [2, 0]]);
      done();
    });
  });

  it('bez přihlášeného uživatele nevrátí žádné skupiny', (done) => {
    env = createTestAccess(null, { groups });
    configure().getMyBoards().subscribe((boards) => {
      expect(boards).toEqual([]);
      done();
    });
  });

  it('skupina bez chatu i nástěnky není komunikační prostor', (done) => {
    env.groups.update((list) => list.map((g) => (g.id === 2 ? { ...g, boardEnabled: false, chatEnabled: false } : g)));
    configure().getMyBoards().subscribe((boards) => {
      expect(boards.map((b) => b.id)).toEqual([1]);
      done();
    });
  });
});
