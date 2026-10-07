import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { PostComment } from './models/comment.model';
import { MOCK_COMMENTS } from './data/mock-comments';

// Bez backendu je jediný způsob, jak si dvě záložky/přihlášení na stejném
// zařízení mohou "poslat" nový komentář (a tedy i zmínku), sdílet stav přes
// localStorage – "storage" event se vyvolá jen v OSTATNÍCH záložkách, což se
// tu hodí jako jednoduchá náhrada reálné synchronizace.
const STORAGE_KEY = 'splk_comments';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private commentsSubject = new BehaviorSubject<PostComment[]>(this.loadFromStorage());

  readonly comments$ = this.commentsSubject.asObservable();

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      this.commentsSubject.next(JSON.parse(event.newValue));
    });
  }

  private loadFromStorage(): PostComment[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // poškozená data v localStorage – spadneme zpátky na mock data
      }
    }
    return [...MOCK_COMMENTS];
  }

  private persist(comments: PostComment[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
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

  addComment(postId: number, authorId: number, body: string, mentionedMemberIds: number[]): Observable<PostComment> {
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

  resetCache(): void {
    const initial = [...MOCK_COMMENTS];
    this.commentsSubject.next(initial);
    this.persist(initial);
  }
}
