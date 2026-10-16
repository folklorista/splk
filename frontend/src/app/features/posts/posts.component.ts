import { Component, OnInit, signal, computed, DestroyRef, input, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Post } from './models/post.model';
import { PostsService } from './posts.service';
import { MembersService } from '../members/members.service';
import { Member } from '../../core/models/member.model';
import { PostComment } from './models/comment.model';
import { CommentsService } from './comments.service';
import { getNewCommentsCount } from '../../core/utils/visibility.utils';
import { Group } from '../../core/models/group.model';
import { hasUnseenMention, sortArchivedPosts, sortBoardPosts } from './utils/board-posts';
import { AccessService } from '../../core/access/access.service';
import { canModerateGroup, canPostInGroup, canSeeReadStats } from '../../core/access/access.utils';

// Nástěnka jedné skupiny – záložka v prostoru skupiny (/app/boards/:slug)
@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [DatePipe, RouterLink, NgTemplateOutlet],
  templateUrl: './posts.component.html',
})
export class PostsComponent implements OnInit {
  readonly board = input.required<Group>();

  private access = inject(AccessService);
  posts = signal<Post[]>([]);
  loading = signal(true);
  allMembers = signal<Member[]>([]);
  comments = signal<PostComment[]>([]);
  readonly currentMemberId = this.access.memberId;

  showArchived = signal(false);

  readonly canPost = computed(() => canPostInGroup(this.access.subject(), this.board()));
  readonly canModerate = computed(() => canModerateGroup(this.access.subject(), this.board()));
  // Statistiky čtenosti jen pro správce skupiny, který obsah čte (ne pro Správu souboru)
  readonly canSeeReadStats = computed(() => canSeeReadStats(this.access.subject(), this.board()));

  // Skrytý příspěvek vidí jen autor a moderátoři
  private boardPosts = computed(() => {
    const board = this.board();
    return this.posts()
      .filter((p) => p.groupId === board.id)
      .filter((p) => !p.hiddenAt || p.authorId === this.currentMemberId() || this.canModerate());
  });

  visiblePosts = computed(() => sortBoardPosts(this.boardPosts().filter(p => !p.archivedAt)));
  archivedPosts = computed(() => sortArchivedPosts(this.boardPosts().filter(p => !!p.archivedAt)));

  hasMention = (post: Post): boolean => hasUnseenMention(post, this.comments(), this.currentMemberId());

  isUnread = (post: Post): boolean => {
    const memberId = this.currentMemberId();
    return memberId ? !post.readers || !post.readers.includes(memberId) : false;
  };

  newCommentsCount(post: Post): number {
    return getNewCommentsCount(this.comments(), post, this.currentMemberId());
  }

  newCommentsLabel(count: number): string {
    if (count === 1) return '1 nový komentář';
    if (count < 5) return `${count} nové komentáře`;
    return `${count} nových komentářů`;
  }

  readCountLabel(post: Post): string {
    const boardMembers = this.allMembers().filter((m) => m.isActive && m.groupIds.includes(post.groupId));
    const readCount = boardMembers.filter((m) => post.readers?.includes(m.id)).length;
    return `Přečteno ${readCount} z ${boardMembers.length}`;
  }

  authorName(post: Post): string {
    return this.allMembers().find((m) => m.id === post.authorId)?.nickname ?? 'Neznámý autor';
  }

  constructor(
    private postsService: PostsService,
    private membersService: MembersService,
    private commentsService: CommentsService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    // Živý stream – počty nových komentářů se aktualizují i bez znovunačtení stránky
    this.commentsService
      .getAllComments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((comments) => this.comments.set(comments));

    forkJoin([this.membersService.getMembers(), this.postsService.getPosts()]).subscribe(([members, posts]) => {
      this.allMembers.set(members);
      this.posts.set(posts);
      this.loading.set(false);
    });
  }
}
