import { Component, DestroyRef, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Post } from '../models/post.model';
import { PostComment } from '../models/comment.model';
import { PostsService } from '../posts.service';
import { CommentsService } from '../comments.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { BoardsService } from '../../boards/boards.service';
import { Group } from '../../../core/models/group.model';
import { Member } from '../../../core/models/member.model';
import { IconComponent } from '../../../shared/icon/icon.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { AccessService } from '../../../core/access/access.service';
import { canModerateGroup, canPostInGroup, canSeeReadStats } from '../../../core/access/access.utils';
import { errorMessage } from '../../../shared/ui/form-ui';

import { RichTextComponent } from '../../../shared/rich-text/rich-text.component';
import { MentionInputComponent, MentionSubmit } from '../../../shared/mention-input/mention-input.component';
import { EventsService } from '../../events/events.service';
@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent, RelativeTimePipe, RichTextComponent, MentionInputComponent],
  templateUrl: './post-detail.component.html',
})
export class PostDetailComponent implements OnInit, OnDestroy {
  post = signal<Post | null>(null);
  board = signal<Group | null>(null);
  loading = signal(true);
  notFound = signal(false);
  allMembers = signal<Member[]>([]);
  currentMemberId = signal<number | null>(null);
  comments = signal<PostComment[]>([]);

  // Zmínit lze aktivní členy skupiny nástěnky kromě sebe
  // Akce, na které lze v komentáři odkázat (#)
  readonly linkableEvents = inject(EventsService).linkableEvents;

  readonly mentionableMembers = computed(() =>
    this.visibleMembers().filter((m) => m.isActive && m.id !== this.currentMemberId()),
  );

  // Členové skupiny, na jejíž nástěnce příspěvek visí – jen ty lze zmínit a jen u nich se sleduje přečtení
  readonly visibleMembers = computed(() => {
    const post = this.post();
    if (!post) return [];
    return this.allMembers().filter((m) => m.groupIds.includes(post.groupId));
  });

  readonly readStatus = computed(() => {
    const post = this.post();
    const readers = new Set(post?.readers ?? []);
    const read: Member[] = [];
    const unread: Member[] = [];
    for (const member of this.visibleMembers()) {
      (readers.has(member.id) ? read : unread).push(member);
    }
    return { read, unread };
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private commentsService: CommentsService,
    private auth: AuthService,
    private membersService: MembersService,
    private boardsService: BoardsService,
  ) {}

  private access = inject(AccessService);
  actionError = signal('');

  // Obsah upravuje jen autor; správce skupiny moderuje (připnout, skrýt, archivovat), nepřepisuje
  readonly isAuthor = computed(() => !!this.post() && this.post()!.authorId === this.currentMemberId());
  readonly canModerate = computed(() => !!this.board() && canModerateGroup(this.access.subject(), this.board()!));
  readonly canArchive = computed(() => this.isAuthor() || this.canModerate());
  readonly canSeeReadStats = computed(() => !!this.board() && canSeeReadStats(this.access.subject(), this.board()!));
  // Otevřenou skupinu může číst i nečlen, komentovat ale jen člen
  readonly canComment = computed(() => !!this.board() && canPostInGroup(this.access.subject(), this.board()!));

  authorName(post: Post): string {
    return this.allMembers().find((m) => m.id === post.authorId)?.nickname ?? 'Neznámý autor';
  }

  commentAuthorName(comment: PostComment): string {
    return this.allMembers().find((m) => m.id === comment.authorId)?.nickname ?? 'Neznámý autor';
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const user = this.auth.currentUser();

    if (!user) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
      this.allMembers.set(members);
      const member = members.find((m) => m.userId === user.id);
      if (!member) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.currentMemberId.set(member.id);

      this.postsService.getPost(id).subscribe((post) => {
        if (!post) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }

        this.boardsService.getBoardById(post.groupId).subscribe((board) => {
          const hiddenForMe = !!post.hiddenAt && post.authorId !== member.id && !(board && canModerateGroup(this.access.subject(), board));
          if (!board || hiddenForMe) {
            this.notFound.set(true);
            this.loading.set(false);
            return;
          }
          this.board.set(board);
          this.showPost(post, member);
        });
      });
    });
  }

  // Návštěva se zapíše při otevření i odchodu, aby komentáře přibylé během čtení nebyly potom "nové"
  ngOnDestroy(): void {
    const post = this.post();
    const memberId = this.currentMemberId();
    if (post && memberId) {
      this.postsService.markVisited(post.id, memberId).subscribe();
    }
  }

  private showPost(post: Post, member: Member): void {
    this.loadComments(post.id, member.id);
    this.postsService.markVisited(post.id, member.id).subscribe();

    const alreadyRead = post.readers?.includes(member.id) ?? false;
    if (alreadyRead) {
      this.post.set(post);
      this.loading.set(false);
      return;
    }

    this.postsService.markAsRead(post.id, member.id).subscribe(() => {
      this.post.set({ ...post, readers: [...(post.readers ?? []), member.id] });
      this.loading.set(false);
    });
  }

  // Odkaz z chatové karty (#comment-ID) otevře správné místo diskuze
  get targetFragment(): string | null {
    return this.route.snapshot?.fragment ?? null;
  }
  private destroyRef = inject(DestroyRef);
  private scrolledToTarget = false;

  private loadComments(postId: number, memberId: number): void {
    this.commentsService.getComments(postId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((comments) => {
      this.comments.set(comments);
      if (this.targetFragment && !this.scrolledToTarget) {
        this.scrolledToTarget = true;
        setTimeout(() => document.getElementById(this.targetFragment!)?.scrollIntoView({ block: 'center' }));
      }
      comments
        .filter((c) => c.mentionedMemberIds.includes(memberId) && !c.seenByMemberIds.includes(memberId))
        .forEach((c) => this.commentsService.markSeen(c.id, memberId).subscribe());
    });
  }



  submitComment(input: MentionSubmit): void {
    const post = this.post();
    const memberId = this.currentMemberId();
    if (!post || !memberId || !input.body.trim()) return;
    this.commentsService.addComment(post.id, memberId, input.body, input.mentionedMemberIds).subscribe((comment) => {
      // getComments() je živý stream, takže tuto změnu doručí i sám – zápis proto musí být idempotentní
      this.comments.update((comments) => [...comments.filter((c) => c.id !== comment.id), comment]);
    });
  }

  private moderate(action: ReturnType<PostsService['setPinned']>): void {
    this.actionError.set('');
    action.subscribe({
      next: (updated) => updated && this.post.update((p) => (p ? { ...p, ...updated, readers: p.readers } : p)),
      error: (e) => this.actionError.set(errorMessage(e)),
    });
  }

  archivePost(): void {
    const post = this.post();
    if (!post || !this.canArchive()) return;
    if (!confirm('Opravdu chcete tento příspěvek archivovat?')) return;
    this.moderate(this.postsService.archivePost(post.id));
  }

  restorePost(): void {
    const post = this.post();
    if (post) this.moderate(this.postsService.restorePost(post.id));
  }

  togglePinned(): void {
    const post = this.post();
    if (post) this.moderate(this.postsService.setPinned(post.id, !post.isPinned));
  }

  toggleHidden(): void {
    const post = this.post();
    if (!post) return;
    if (!post.hiddenAt && !confirm('Skrýt příspěvek? Uvidí ho jen autor a správci skupiny. Zásah se zapíše do historie skupiny.')) return;
    this.moderate(this.postsService.setHidden(post.id, !post.hiddenAt));
  }
}
