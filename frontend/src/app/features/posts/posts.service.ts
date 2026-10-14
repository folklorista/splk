import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Post } from './models/post.model';
import { MOCK_POSTS } from './data/mock-posts';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

let postsCache = loadDemoData('posts', () => [...MOCK_POSTS]);
const persist = () => saveDemoData('posts', postsCache);

@Injectable({ providedIn: 'root' })
export class PostsService {
  getPosts(): Observable<Post[]> {
    return of([...postsCache]).pipe(delay(300));
  }

  getPost(id: number): Observable<Post | undefined> {
    return of(postsCache.find((p) => p.id === id)).pipe(delay(300));
  }

  createPost(post: Omit<Post, 'id'>): Observable<Post> {
    const newId = Math.max(...postsCache.map((p) => p.id), 0) + 1;
    const now = new Date().toISOString();
    const newPost: Post = { ...post, id: newId, publishedAt: now, updatedAt: now };
    postsCache.push(newPost);
    persist();
    return of(newPost).pipe(delay(300));
  }

  updatePost(id: number, post: Omit<Post, 'id'>): Observable<Post | undefined> {
    const index = postsCache.findIndex((p) => p.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    // publishedAt se editací nemění – to by muselo jít přes samostatnou akci "znovu publikovat"
    const updated: Post = {
      ...post,
      id,
      publishedAt: postsCache[index].publishedAt,
      updatedAt: new Date().toISOString(),
    };
    postsCache[index] = updated;
    persist();
    return of(updated).pipe(delay(300));
  }

  // Označí příspěvek za přečtený daným členem, beze změny updatedAt
  markAsRead(postId: number, memberId: number): Observable<void> {
    const index = postsCache.findIndex((p) => p.id === postId);
    if (index !== -1) {
      const readers = postsCache[index].readers ?? [];
      if (!readers.includes(memberId)) {
        postsCache = [...postsCache];
        postsCache[index] = { ...postsCache[index], readers: [...readers, memberId] };
      }
    }
    persist();
    return of(undefined).pipe(delay(300));
  }

  // Zaznamená návštěvu příspěvku členem – komentáře vytvořené před tímto okamžikem už nejsou "nové"
  markVisited(postId: number, memberId: number): Observable<void> {
    const index = postsCache.findIndex((p) => p.id === postId);
    if (index !== -1) {
      const lastVisitedAt = { ...postsCache[index].lastVisitedAt, [memberId]: new Date().toISOString() };
      postsCache = [...postsCache];
      postsCache[index] = { ...postsCache[index], lastVisitedAt };
    }
    persist();
    return of(undefined).pipe(delay(300));
  }

  // Archivace je vratná (na rozdíl od trvalého smazání, které je jen v administraci)
  archivePost(id: number): Observable<Post | undefined> {
    const index = postsCache.findIndex((p) => p.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    postsCache = [...postsCache];
    postsCache[index] = { ...postsCache[index], archivedAt: new Date().toISOString() };
    persist();
    return of(postsCache[index]).pipe(delay(300));
  }

  deletePost(id: number): Observable<boolean> {
    const index = postsCache.findIndex((p) => p.id === id);
    if (index === -1) {
      return of(false).pipe(delay(300));
    }
    postsCache.splice(index, 1);
    persist();
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    postsCache = [...MOCK_POSTS];
  }
}
