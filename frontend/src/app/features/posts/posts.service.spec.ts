import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PostsService } from './posts.service';
import { MOCK_POSTS } from './data/mock-posts';
import { Post } from './models/post.model';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { AuditService } from '../audit/audit.service';
import { createTestAccess, testMandate, testMember } from '../../testing/access.testing';

describe('PostsService', () => {
  let service: PostsService;
  let env: ReturnType<typeof createTestAccess>;
  // Přihlášený je autor příspěvku 1 a člen jeho skupiny i skupiny 1
  const post1 = MOCK_POSTS.find((p) => p.id === 1)!;
  const author = testMember({ id: post1.authorId, userId: post1.authorId, groupIds: [1, post1.groupId] });

  beforeEach(() => {
    env = createTestAccess(author);
    TestBed.configureTestingModule({ providers: [{ provide: AccessService, useValue: env.access }] });
    service = TestBed.inject(PostsService);
    service.resetCache();
  });

  it('getPosts vrátí všechny příspěvky', fakeAsync(() => {
    let result: unknown;
    service.getPosts().subscribe((posts) => (result = posts));
    tick(300);
    expect(Array.isArray(result)).toBeTrue();
    expect((result as unknown[]).length).toBe(MOCK_POSTS.length);
  }));

  it('getPosts vrátí kopii pole, ne referenci na mock data', fakeAsync(() => {
    let result: unknown[];
    service.getPosts().subscribe((posts) => (result = posts));
    tick(300);
    expect(result!).not.toBe(MOCK_POSTS);
  }));

  it('getPost vrátí příspěvek se správným id', fakeAsync(() => {
    let result: unknown;
    service.getPost(1).subscribe((post) => (result = post));
    tick(300);
    expect((result as { id: number }).id).toBe(1);
  }));

  it('getPost vrátí undefined pro neexistující id', fakeAsync(() => {
    let result: unknown = 'not-called';
    service.getPost(9999).subscribe((post) => (result = post));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('getPosts obsahuje alespoň jeden pinned příspěvek', fakeAsync(() => {
    let result: { isPinned: boolean }[] = [];
    service.getPosts().subscribe((posts) => (result = posts));
    tick(300);
    expect(result.some((p) => p.isPinned)).toBeTrue();
  }));

  it('createPost přidá nový příspěvek', fakeAsync(() => {
    const newPost: Omit<Post, 'id'> = {
      ensembleId: 1,
      title: 'Nový příspěvek',
      body: 'Obsah',
      authorId: author.id,
      groupId: 1,
      publishedAt: '2026-06-23T10:00:00',
      updatedAt: '2026-06-23T10:00:00',
      isPinned: false,
    };
    let created: Post | undefined;
    service.createPost(newPost).subscribe((p) => (created = p));
    tick(300);
    expect(created).toBeDefined();
    expect(created?.id).toBeGreaterThan(0);
    expect(created?.title).toBe('Nový příspěvek');

    let allPosts: Post[] = [];
    service.getPosts().subscribe((p) => (allPosts = p));
    tick(300);
    expect(allPosts.length).toBeGreaterThan(MOCK_POSTS.length);
  }));

  it('updatePost upraví existující příspěvek', fakeAsync(() => {
    const updated: Omit<Post, 'id'> = {
      ensembleId: 1,
      title: 'Upravený nadpis',
      body: 'Upravený obsah',
      authorId: 1,
      groupId: 1,
      publishedAt: '2026-06-23T10:00:00',
      updatedAt: '2026-06-23T10:00:00',
      isPinned: true,
    };
    let result: Post | undefined;
    service.updatePost(1, updated).subscribe((p) => (result = p));
    tick(300);
    expect(result?.id).toBe(1);
    expect(result?.title).toBe('Upravený nadpis');
    // Připnutí je moderátorský zásah (setPinned), úprava obsahu ho nemění
    expect(result?.isPinned).toBe(post1.isPinned);
  }));

  it('updatePost nezmění původní publishedAt, i když je v datech jiné', fakeAsync(() => {
    const original = MOCK_POSTS.find((p) => p.id === 1)!;
    const updated: Omit<Post, 'id'> = {
      ensembleId: 1,
      title: 'Upravený nadpis',
      body: 'Upravený obsah',
      authorId: 1,
      groupId: 1,
      publishedAt: '2099-01-01T00:00:00',
      updatedAt: '2099-01-01T00:00:00',
      isPinned: true,
    };
    let result: Post | undefined;
    service.updatePost(1, updated).subscribe((p) => (result = p));
    tick(300);
    expect(result?.publishedAt).toBe(original.publishedAt);
    expect(result?.updatedAt).not.toBe(original.updatedAt);
  }));

  it('updatePost vrátí undefined pro neexistující id', fakeAsync(() => {
    const updated: Omit<Post, 'id'> = {
      ensembleId: 1,
      title: 'Něco',
      body: 'Obsah',
      authorId: 1,
      groupId: 1,
      publishedAt: '2026-06-23T10:00:00',
      updatedAt: '2026-06-23T10:00:00',
      isPinned: false,
    };
    let result: Post | undefined = {} as Post;
    service.updatePost(9999, updated).subscribe((p) => (result = p));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('createPost odmítne příspěvek do skupiny, kde autor není členem', fakeAsync(() => {
    let error: unknown;
    service.createPost({ ...post1, groupId: 7, authorId: author.id }).subscribe({ error: (e) => (error = e) });
    tick(300);
    expect(error).toEqual(jasmine.any(AccessDeniedError));
  }));

  it('updatePost cizího příspěvku odmítne i správci skupiny', fakeAsync(() => {
    env.members.set([{ ...author, id: 999, userId: author.userId }]);
    env.mandates.set([testMandate(999, 'group-owner', { groupId: post1.groupId })]);
    let error: unknown;
    service.updatePost(1, { ...post1, title: 'Přepsáno' }).subscribe({ error: (e) => (error = e) });
    tick(300);
    expect(error).toEqual(jasmine.any(AccessDeniedError));
  }));

  it('setPinned a setHidden smí jen správce skupiny a zásah se zapíše do historie', fakeAsync(() => {
    let error: unknown;
    service.setPinned(1, true).subscribe({ error: (e) => (error = e) });
    tick(300);
    expect(error).toEqual(jasmine.any(AccessDeniedError));

    env.mandates.set([testMandate(author.id, 'group-deputy', { groupId: post1.groupId })]);
    let hidden: Post | undefined;
    service.setHidden(1, true).subscribe((p) => (hidden = p));
    tick(300);
    expect(hidden?.hiddenAt).toBeTruthy();
    expect(hidden?.hiddenById).toBe(author.id);
    const audit = TestBed.inject(AuditService).entries();
    expect(audit[audit.length - 1].action).toBe('post-hidden');
  }));

  it('restorePost vrátí archivovaný příspěvek', fakeAsync(() => {
    service.archivePost(1).subscribe();
    tick(300);
    let restored: Post | undefined;
    service.restorePost(1).subscribe((p) => (restored = p));
    tick(300);
    expect(restored?.archivedAt).toBeUndefined();
  }));

  it('markAsRead přidá člena mezi readers, beze změny updatedAt', fakeAsync(() => {
    const original = MOCK_POSTS.find((p) => p.id === 3)!;
    service.markAsRead(3, 99).subscribe();
    tick(300);

    let result: Post | undefined;
    service.getPost(3).subscribe((p) => (result = p));
    tick(300);

    expect(result?.readers).toContain(99);
    expect(result?.updatedAt).toBe(original.updatedAt);
  }));

  it('markAsRead nepřidá člena podruhé', fakeAsync(() => {
    service.markAsRead(3, 99).subscribe();
    tick(300);
    service.markAsRead(3, 99).subscribe();
    tick(300);

    let result: Post | undefined;
    service.getPost(3).subscribe((p) => (result = p));
    tick(300);

    expect(result?.readers?.filter((id) => id === 99).length).toBe(1);
  }));

  it('markVisited zaznamená čas návštěvy člena a zachová návštěvy ostatních', fakeAsync(() => {
    service.markVisited(3, 99).subscribe();
    tick(300);
    service.markVisited(3, 98).subscribe();
    tick(300);

    let result: Post | undefined;
    service.getPost(3).subscribe((p) => (result = p));
    tick(300);

    expect(Object.keys(result?.lastVisitedAt ?? {}).sort()).toEqual(['98', '99']);
    expect(Date.parse(result!.lastVisitedAt![99])).not.toBeNaN();
  }));

  it('archivePost nastaví archivedAt a zachová ostatní pole', fakeAsync(() => {
    const original = MOCK_POSTS.find((p) => p.id === 1)!;
    let result: Post | undefined;
    service.archivePost(1).subscribe((p) => (result = p));
    tick(300);

    expect(result?.archivedAt).toBeTruthy();
    expect(result?.title).toBe(original.title);
    expect(result?.authorId).toBe(original.authorId);
  }));

  it('archivePost vrátí undefined pro neexistující id', fakeAsync(() => {
    let result: Post | undefined = {} as Post;
    service.archivePost(9999).subscribe((p) => (result = p));
    tick(300);
    expect(result).toBeUndefined();
  }));
});
