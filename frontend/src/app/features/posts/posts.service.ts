import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Post } from './models/post.model';
import { MOCK_POSTS } from './data/mock-posts';

@Injectable({ providedIn: 'root' })
export class PostsService {
  getPosts(): Observable<Post[]> {
    return of([...MOCK_POSTS]).pipe(delay(300));
  }

  getPost(id: number): Observable<Post | undefined> {
    return of(MOCK_POSTS.find((p) => p.id === id)).pipe(delay(300));
  }
}
