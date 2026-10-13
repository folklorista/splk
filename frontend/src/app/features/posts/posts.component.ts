import { Component, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Post } from './models/post.model';
import { PostsService } from './posts.service';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { BoardsService } from '../boards/boards.service';
import { Member } from '../../core/models/member.model';
import { Group } from '../../core/models/group.model';

// Nástěnka jedné skupiny (/app/boards/:slug)
@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './posts.component.html',
})
export class PostsComponent implements OnInit {
  board = signal<Group | null>(null);
  posts = signal<Post[]>([]);
  loading = signal(true);
  currentMemberId = signal<number | null>(null);
  allMembers = signal<Member[]>([]);

  visiblePosts = computed(() => {
    const board = this.board();
    if (!board) return [];
    return this.posts()
      .filter(p => p.groupId === board.id)
      .filter(p => !p.archivedAt);
  });

  isUnread = (post: Post): boolean => {
    const memberId = this.currentMemberId();
    return memberId ? !post.readers || !post.readers.includes(memberId) : false;
  };

  get isLeader(): boolean {
    return this.auth.currentUser()?.roles.includes('leader') ?? false;
  }

  get isAdmin(): boolean {
    return this.auth.currentUser()?.roles.includes('admin') ?? false;
  }

  readCountLabel(post: Post): string {
    const boardMembers = this.allMembers().filter((m) => m.groupIds.includes(post.groupId));
    const readCount = boardMembers.filter((m) => post.readers?.includes(m.id)).length;
    return `Přečteno ${readCount} z ${boardMembers.length}`;
  }

  authorName(post: Post): string {
    return this.allMembers().find((m) => m.id === post.authorId)?.name ?? 'Neznámý autor';
  }

  constructor(
    private route: ActivatedRoute,
    private postsService: PostsService,
    private auth: AuthService,
    private membersService: MembersService,
    private boardsService: BoardsService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    // Komponenta se při přechodu mezi nástěnkami znovu nevytváří, proto sledujeme změnu :slug
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        switchMap((slug) => {
          this.loading.set(true);
          return forkJoin([
            this.boardsService.getBoardBySlug(slug),
            this.membersService.getMembers(),
            this.postsService.getPosts(),
          ]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([board, members, posts]) => {
        this.board.set(board ?? null);
        this.allMembers.set(members);
        this.currentMemberId.set(members.find((m) => m.userId === user.id)?.id ?? null);
        this.posts.set(posts);
        this.loading.set(false);
      });
  }
}
