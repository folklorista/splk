import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { PostComment } from './models/comment.model';
import { MOCK_COMMENTS } from './data/mock-comments';
import { demoStorageKey, loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { canPostInGroup } from '../../core/access/access.utils';
import { PostsService } from './posts.service';
import { GroupsService } from '../groups/groups.service';

// Bez backendu je jediný způsob, jak si dvě záložky/přihlášení na stejném
// zařízení mohou "poslat" nový komentář (a tedy i zmínku), sdílet stav přes
// localStorage – "storage" event se vyvolá jen v OSTATNÍCH záložkách, což se
// tu hodí jako jednoduchá náhrada reálné synchronizace.
const STORAGE_NAME = 'comments';
const STORAGE_KEY = demoStorageKey(STORAGE_NAME);

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private commentsSubject = new BehaviorSubject<PostComment[]>(this.loadFromStorage());

  readonly comments$ = this.commentsSubject.asObservable();

  private access = inject(AccessService);
  private posts = inject(PostsService);
  private groups = inject(GroupsService);

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      this.commentsSubject.next(JSON.parse(event.newValue));
    });
  }

  private loadFromStorage(): PostComment[] {
    return loadDemoData(STORAGE_NAME, () => [...MOCK_COMMENTS]);
  }

  private persist(comments: PostComment[]): void {
    saveDemoData(STORAGE_NAME, comments);
  }

  getComments(postId: number): Observable<PostComment[]> {
    return this.comments$.pipe(
      delay(300),
      map((comments) => comments.filter((c) => c.postId === postId)),
    );
  }

  getAllComments(): Observable<PostComment[]> {
    return this.comments$.pipe(delay(300));
  }

  // Komentovat smí jen člen skupiny příspěvku a jen sám za sebe (i při odpovědi z chatové karty)
  addComment(postId: number, authorId: number, body: string, mentionedMemberIds: number[]): Observable<PostComment> {
    const post = this.posts.findPost(postId);
    const group = post && this.groups.findGroup(post.groupId);
    if (!group || authorId !== this.access.memberId() || !canPostInGroup(this.access.subject(), group)) {
      return throwError(() => new AccessDeniedError('Komentovat mohou jen členové skupiny.'));
    }
    const comments = this.commentsSubject.value;
    const newComment: PostComment = {
      id: Math.max(0, ...comments.map((c) => c.id)) + 1,
      postId,
      authorId,
      body,
      createdAt: new Date().toISOString(),
      mentionedMemberIds,
      seenByMemberIds: [],
    };
    const updated = [...comments, newComment];
    this.commentsSubject.next(updated);
    this.persist(updated);
    return of(newComment).pipe(delay(300));
  }

  // Označí, že daný člen komentář (a tedy i zmínku v něm) viděl
  markSeen(commentId: number, memberId: number): Observable<void> {
    const comments = this.commentsSubject.value;
    const index = comments.findIndex((c) => c.id === commentId);
    if (index !== -1 && !comments[index].seenByMemberIds.includes(memberId)) {
      const updated = [...comments];
      updated[index] = { ...updated[index], seenByMemberIds: [...updated[index].seenByMemberIds, memberId] };
      this.commentsSubject.next(updated);
      this.persist(updated);
    }
    return of(undefined).pipe(delay(300));
  }

  // Komentáře smazaných příspěvků (smazání archivované skupiny)
  purgePosts(postIds: number[]): void {
    const next = this.commentsSubject.value.filter((c) => !postIds.includes(c.postId));
    this.commentsSubject.next(next);
    this.persist(next);
  }

  resetCache(): void {
    const initial = [...MOCK_COMMENTS];
    this.commentsSubject.next(initial);
    this.persist(initial);
  }
}
