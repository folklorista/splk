import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PostsService } from './posts.service';
import { MOCK_POSTS } from './data/mock-posts';

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PostsService);
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
});
