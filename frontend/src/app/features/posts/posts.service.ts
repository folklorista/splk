import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Post } from './models/post.model';
import { MOCK_POSTS } from './data/mock-posts';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { canModerateGroup, canPostInGroup } from '../../core/access/access.utils';
import { GroupsService } from '../groups/groups.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.model';

let postsCache = loadDemoData('posts', () => [...MOCK_POSTS]);
const persist = () => saveDemoData('posts', postsCache);

// Návrat k výchozím demo příspěvkům (testy, obnovení dema)
export function resetPostsCache(): void {
  postsCache = [...MOCK_POSTS];
}

// Příspěvky nástěnek. Psát smí členové skupiny, upravovat jen autor (správce nepřepisuje cizí obsah),
// moderovat (připnout, skrýt, archivovat, obnovit) správce skupiny, který obsah čte.
// Moderátorské zásahy se zapisují do historie skupiny.
@Injectable({ providedIn: 'root' })
export class PostsService {
  constructor(
    private access: AccessService,
    private groupsService: GroupsService,
    private audit: AuditService,
  ) {}

  getPosts(): Observable<Post[]> {
    return of([...postsCache]).pipe(delay(300));
  }

  getPost(id: number): Observable<Post | undefined> {
    return of(postsCache.find((p) => p.id === id)).pipe(delay(300));
  }

  // Synchronní dotaz pro jiné služby (kontrola oprávnění u komentářů)
  findPost(id: number): Post | undefined {
    return postsCache.find((p) => p.id === id);
  }

  private canModerate(post: Post): boolean {
    const group = this.groupsService.findGroup(post.groupId);
    return !!group && canModerateGroup(this.access.subject(), group);
  }

  private isAuthor(post: Post): boolean {
    return post.authorId === this.access.memberId();
  }

  createPost(post: Omit<Post, 'id'>): Observable<Post> {
    const group = this.groupsService.findGroup(post.groupId);
    if (!group || !canPostInGroup(this.access.subject(), group) || post.authorId !== this.access.memberId()) {
      return throwError(() => new AccessDeniedError('Na nástěnku píší jen členové skupiny.'));
    }
    const newId = Math.max(...postsCache.map((p) => p.id), 0) + 1;
    const now = new Date().toISOString();
    const newPost: Post = { ...post, id: newId, publishedAt: now, updatedAt: now };
    postsCache = [...postsCache, newPost];
    persist();
    return of(newPost).pipe(delay(300));
  }

  // Obsah upravuje jen autor
  updatePost(id: number, post: Omit<Post, 'id'>): Observable<Post | undefined> {
    const index = postsCache.findIndex((p) => p.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    if (!this.isAuthor(postsCache[index])) {
      return throwError(() => new AccessDeniedError('Příspěvek upravuje jen jeho autor.'));
    }
    // publishedAt se editací nemění – to by muselo jít přes samostatnou akci "znovu publikovat"
    const updated: Post = {
      ...postsCache[index],
      title: post.title,
      body: post.body,
      requiresAction: post.requiresAction,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.replace(index, updated);
    return of(updated).pipe(delay(300));
  }

  private replace(index: number, post: Post): void {
    postsCache = [...postsCache];
    postsCache[index] = post;
    persist();
  }

  // Označí příspěvek za přečtený daným členem, beze změny updatedAt
  markAsRead(postId: number, memberId: number): Observable<void> {
    const index = postsCache.findIndex((p) => p.id === postId);
    if (index !== -1) {
      const readers = postsCache[index].readers ?? [];
      if (!readers.includes(memberId)) {
        this.replace(index, { ...postsCache[index], readers: [...readers, memberId] });
      }
    }
    return of(undefined).pipe(delay(300));
  }

  // Zaznamená návštěvu příspěvku členem – komentáře vytvořené před tímto okamžikem už nejsou "nové"
  markVisited(postId: number, memberId: number): Observable<void> {
    const index = postsCache.findIndex((p) => p.id === postId);
    if (index !== -1) {
      const lastVisitedAt = { ...postsCache[index].lastVisitedAt, [memberId]: new Date().toISOString() };
      this.replace(index, { ...postsCache[index], lastVisitedAt });
    }
    return of(undefined).pipe(delay(300));
  }

  // Moderátorská / autorská změna stavu příspěvku se záznamem do historie skupiny
  private changeState(id: number, allowed: (post: Post) => boolean, change: (post: Post) => Partial<Post>, action: AuditAction): Observable<Post | undefined> {
    const index = postsCache.findIndex((p) => p.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    const post = postsCache[index];
    if (!allowed(post)) {
      return throwError(() => new AccessDeniedError('Tento zásah může udělat jen správce skupiny.'));
    }
    const updated = { ...post, ...change(post) };
    this.replace(index, updated);
    this.audit.record({ action, actorId: this.access.memberId() ?? 0, groupIds: [post.groupId], postId: id, memberId: post.authorId });
    return of(updated).pipe(delay(300));
  }

  setPinned(id: number, isPinned: boolean): Observable<Post | undefined> {
    return this.changeState(id, (p) => this.canModerate(p), () => ({ isPinned }), isPinned ? 'post-pinned' : 'post-unpinned');
  }

  // Skrytý příspěvek vidí jen autor a správci skupiny; z chatu zmizí
  setHidden(id: number, hidden: boolean): Observable<Post | undefined> {
    const by = this.access.memberId() ?? undefined;
    return this.changeState(
      id,
      (p) => this.canModerate(p),
      () => (hidden ? { hiddenAt: new Date().toISOString(), hiddenById: by } : { hiddenAt: undefined, hiddenById: undefined }),
      hidden ? 'post-hidden' : 'post-unhidden',
    );
  }

  // Archivace je vratná – archivovat a obnovit smí autor i správce skupiny
  archivePost(id: number): Observable<Post | undefined> {
    return this.changeState(id, (p) => this.isAuthor(p) || this.canModerate(p), () => ({ archivedAt: new Date().toISOString(), isPinned: false }), 'post-archived');
  }

  restorePost(id: number): Observable<Post | undefined> {
    return this.changeState(id, (p) => this.isAuthor(p) || this.canModerate(p), () => ({ archivedAt: undefined }), 'post-restored');
  }

  // Smazání archivované skupiny: odstraní její příspěvky (oprávnění ověřuje MembershipService)
  purgeGroup(groupId: number): number[] {
    const removed = postsCache.filter((p) => p.groupId === groupId).map((p) => p.id);
    postsCache = postsCache.filter((p) => p.groupId !== groupId);
    persist();
    return removed;
  }

  resetCache(): void {
    resetPostsCache();
  }
}
