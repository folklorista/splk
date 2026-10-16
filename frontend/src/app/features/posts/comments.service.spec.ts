import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { demoStorageKey } from '../../core/data/demo-storage';
import { CommentsService } from './comments.service';
import { PostComment } from './models/comment.model';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';

describe('CommentsService', () => {
  let service: CommentsService;
  // Přihlášený autor je členem všech skupin (oprávnění testuje samostatný test níže)
  let actor = 1;
  let groupIds = [1, 2, 3, 4, 5, 6, 7];

  beforeEach(() => {
    actor = 1;
    groupIds = [1, 2, 3, 4, 5, 6, 7];
    const access = { memberId: () => actor, subject: () => ({ memberId: actor, groupIds, isExternal: false, mandates: [] }) };
    TestBed.configureTestingModule({ providers: [{ provide: AccessService, useValue: access }] });
    service = TestBed.inject(CommentsService);
    service.resetCache();
  });

  it('getComments vrátí jen komentáře daného příspěvku', fakeAsync(() => {
    let result: PostComment[] = [];
    service.getComments(1).subscribe((comments) => (result = comments));
    tick(300);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.postId === 1)).toBeTrue();
  }));

  it('getComments vrátí prázdné pole pro příspěvek bez komentářů', fakeAsync(() => {
    let result: PostComment[] = [];
    service.getComments(9999).subscribe((comments) => (result = comments));
    tick(300);
    expect(result.length).toBe(0);
  }));

  it('addComment přidá nový komentář se správnými zmínkami', fakeAsync(() => {
    let created: PostComment | undefined;
    actor = 5;
    service.addComment(2, 5, 'Ahoj @Petr', [7]).subscribe((c) => (created = c));
    tick(300);

    expect(created?.postId).toBe(2);
    expect(created?.authorId).toBe(5);
    expect(created?.mentionedMemberIds).toEqual([7]);
    expect(created?.seenByMemberIds).toEqual([]);

    let comments: PostComment[] = [];
    service.getComments(2).subscribe((c) => (comments = c));
    tick(300);
    expect(comments.some((c) => c.id === created?.id)).toBeTrue();
  }));

  it('markSeen přidá člena mezi ty, kteří komentář viděli', fakeAsync(() => {
    let created: PostComment | undefined;
    actor = 1;
    service.addComment(3, 1, 'Test @Osoba', [8]).subscribe((c) => (created = c));
    tick(300);

    service.markSeen(created!.id, 8).subscribe();
    tick(300);

    let comments: PostComment[] = [];
    service.getComments(3).subscribe((c) => (comments = c));
    tick(300);
    expect(comments.find((c) => c.id === created!.id)?.seenByMemberIds).toContain(8);
  }));

  it('markSeen podruhé nepřidá člena duplicitně', fakeAsync(() => {
    let created: PostComment | undefined;
    actor = 1;
    service.addComment(3, 1, 'Test @Osoba', [8]).subscribe((c) => (created = c));
    tick(300);

    service.markSeen(created!.id, 8).subscribe();
    tick(300);
    service.markSeen(created!.id, 8).subscribe();
    tick(300);

    let comments: PostComment[] = [];
    service.getComments(3).subscribe((c) => (comments = c));
    tick(300);
    expect(comments.find((c) => c.id === created!.id)?.seenByMemberIds.filter((id) => id === 8).length).toBe(1);
  }));

  it('addComment uloží stav do localStorage, aby ho viděly i jiné záložky', fakeAsync(() => {
    actor = 1;
    service.addComment(4, 1, 'Persistovaný komentář', []).subscribe();
    tick(300);

    const stored: PostComment[] = JSON.parse(localStorage.getItem(demoStorageKey('comments'))!);
    expect(stored.some((c) => c.body === 'Persistovaný komentář')).toBeTrue();
  }));

  it('promítne změnu z jiné záložky doručenou přes "storage" event', fakeAsync(() => {
    const fromOtherTab: PostComment[] = [
      { id: 999, postId: 7, authorId: 1, body: 'Z jiné záložky', createdAt: '2026-01-01T00:00:00', mentionedMemberIds: [], seenByMemberIds: [] },
    ];

    window.dispatchEvent(new StorageEvent('storage', {
      key: demoStorageKey('comments'),
      newValue: JSON.stringify(fromOtherTab),
    }));

    let comments: PostComment[] = [];
    service.getComments(7).subscribe((c) => (comments = c));
    tick(300);
    expect(comments.some((c) => c.id === 999)).toBeTrue();
  }));

  it('ignoruje "storage" event pro jiný klíč', fakeAsync(() => {
    let comments: PostComment[] = [];
    service.getComments(1).subscribe((c) => (comments = c));
    tick(300);
    const before = comments.length;

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'nejaky-jiny-klic',
      newValue: JSON.stringify([]),
    }));

    service.getComments(1).subscribe((c) => (comments = c));
    tick(300);
    expect(comments.length).toBe(before);
  }));

  it('nečlen skupiny ani cizím jménem komentovat nemůže', fakeAsync(() => {
    let error: unknown;
    groupIds = [];
    service.addComment(1, 1, 'Ahoj', []).subscribe({ error: (e) => (error = e) });
    expect(error).toEqual(jasmine.any(AccessDeniedError));

    groupIds = [1, 2, 3, 4, 5, 6, 7];
    error = undefined;
    service.addComment(1, 99, 'Za někoho', []).subscribe({ error: (e) => (error = e) });
    expect(error).toEqual(jasmine.any(AccessDeniedError));
  }));
});
