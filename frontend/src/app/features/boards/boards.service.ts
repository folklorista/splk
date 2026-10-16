import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AccessService } from '../../core/access/access.service';
import { canReadGroupContent } from '../../core/access/access.utils';
import { Group } from '../../core/models/group.model';
import { getBoardBadgeCount, hasBoard, hasChat } from '../../core/utils/visibility.utils';
import { GroupsService } from '../groups/groups.service';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../posts/comments.service';

// Komunikační prostory skupin (chat a/nebo nástěnka). V menu jsou skupiny, kde je uživatel členem;
// otevřít lze i otevřenou skupinu, jejíž obsah smí číst. Správa souboru ani technická správa
// skupiny obsah neodemyká (docs/08 kap. 10.1).
@Injectable({ providedIn: 'root' })
export class BoardsService {
  constructor(
    private access: AccessService,
    private groupsService: GroupsService,
    private postsService: PostsService,
    private commentsService: CommentsService,
  ) {}

  private hasSpace(group: Group): boolean {
    return hasBoard(group) || hasChat(group);
  }

  getMyBoards(): Observable<Group[]> {
    return of(this.access.myGroups().filter((g) => this.hasSpace(g)));
  }

  getBoardBySlug(slug: string): Observable<Group | undefined> {
    const group = this.groupsService.groups().find((g) => g.slug === slug);
    return of(group && this.hasSpace(group) && canReadGroupContent(this.access.subject(), group) ? group : undefined);
  }

  getBoardById(groupId: number): Observable<Group | undefined> {
    const group = this.groupsService.groups().find((g) => g.id === groupId);
    return of(group && canReadGroupContent(this.access.subject(), group) ? group : undefined);
  }

  // Počet nepřečtených příspěvků a neviděných zmínek pro každou skupinu z menu
  getBoardBadges(): Observable<Map<number, number>> {
    const memberId = this.access.memberId();
    if (!memberId) return of(new Map());

    return forkJoin([this.getMyBoards(), this.postsService.getPosts(), this.commentsService.getAllComments().pipe(take(1))]).pipe(
      map(([boards, posts, comments]) => {
        const visible = posts.filter((p) => !p.hiddenAt || p.authorId === memberId);
        return new Map(boards.map((b) => [b.id, hasBoard(b) ? getBoardBadgeCount(visible, comments, b.id, memberId) : 0]));
      }),
    );
  }
}
