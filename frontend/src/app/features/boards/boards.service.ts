import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { Group } from '../../core/models/group.model';
import { canAccessBoard, getBoardBadgeCount, hasBoard, isAdmin } from '../../core/utils/visibility.utils';
import { GroupsService } from '../groups/groups.service';
import { MembersService } from '../members/members.service';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../posts/comments.service';

// Každá skupina má (pokud ji nemá vypnutou) jednu nástěnku. Uživatel vidí nástěnky svých skupin, administrátor všechny.
@Injectable({ providedIn: 'root' })
export class BoardsService {
  constructor(
    private auth: AuthService,
    private groupsService: GroupsService,
    private membersService: MembersService,
    private postsService: PostsService,
    private commentsService: CommentsService,
  ) {}

  getMyBoards(): Observable<Group[]> {
    const user = this.auth.currentUser();
    if (!user) return of([]);

    return forkJoin([this.groupsService.getGroups(), this.membersService.getMemberByUserId(user.id)]).pipe(
      map(([groups, member]) =>
        groups.filter((g) => hasBoard(g) && canAccessBoard(g.id, member?.groupIds ?? [], isAdmin(user))),
      ),
    );
  }

  getBoardBySlug(slug: string): Observable<Group | undefined> {
    return this.getMyBoards().pipe(map((boards) => boards.find((b) => b.slug === slug)));
  }

  getBoardById(groupId: number): Observable<Group | undefined> {
    return this.getMyBoards().pipe(map((boards) => boards.find((b) => b.id === groupId)));
  }

  // Počet nepřečtených příspěvků a neviděných zmínek pro každou dostupnou nástěnku
  getBoardBadges(): Observable<Map<number, number>> {
    const user = this.auth.currentUser();
    if (!user) return of(new Map());

    return forkJoin([
      this.getMyBoards(),
      this.membersService.getMemberByUserId(user.id),
      this.postsService.getPosts(),
      this.commentsService.getAllComments().pipe(take(1)),
    ]).pipe(
      map(([boards, member, posts, comments]) =>
        new Map(boards.map((b) => [b.id, getBoardBadgeCount(posts, comments, b.id, member?.id ?? null)])),
      ),
    );
  }
}
