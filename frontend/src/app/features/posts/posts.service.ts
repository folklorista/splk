import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Post } from './models/post.model';
import { MOCK_POSTS } from './data/mock-posts';

let postsCache = [...MOCK_POSTS];

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
    const newPost: Post = { ...post, id: newId };
    postsCache.push(newPost);
    return of(newPost).pipe(delay(300));
  }

  updatePost(id: number, post: Omit<Post, 'id'>): Observable<Post | undefined> {
    const index = postsCache.findIndex((p) => p.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    const updated: Post = { ...post, id };
    postsCache[index] = updated;
    return of(updated).pipe(delay(300));
  }

  deletePost(id: number): Observable<boolean> {
    const index = postsCache.findIndex((p) => p.id === id);
    if (index === -1) {
      return of(false).pipe(delay(300));
    }
    postsCache.splice(index, 1);
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    postsCache = [...MOCK_POSTS];
  }
}
