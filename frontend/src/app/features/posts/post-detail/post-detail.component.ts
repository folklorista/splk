import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
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

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent, RelativeTimePipe],
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
  newCommentBody = signal('');
  mentionedMembers = signal<Member[]>([]);

  readonly mentionCandidates = computed(() => {
    const mentionedIds = new Set(this.mentionedMembers().map((m) => m.id));
    return this.visibleMembers().filter((m) => m.id !== this.currentMemberId() && !mentionedIds.has(m.id));
  });

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

  get isLeader(): boolean {
    return this.auth.currentUser()?.roles.includes('leader') ?? false;
  }

  get isAdmin(): boolean {
    return this.auth.currentUser()?.roles.includes('admin') ?? false;
  }

  get canManage(): boolean {
    const post = this.post();
    if (!post) return false;
    return post.authorId === this.currentMemberId() || this.isLeader || this.isAdmin;
  }

  authorName(post: Post): string {
    return this.allMembers().find((m) => m.id === post.authorId)?.name ?? 'Neznámý autor';
  }

  commentAuthorName(comment: PostComment): string {
    return this.allMembers().find((m) => m.id === comment.authorId)?.name ?? 'Neznámý autor';
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
          if (!board) {
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

  private loadComments(postId: number, memberId: number): void {
    this.commentsService.getComments(postId).subscribe((comments) => {
      this.comments.set(comments);
      comments
        .filter((c) => c.mentionedMemberIds.includes(memberId) && !c.seenByMemberIds.includes(memberId))
        .forEach((c) => this.commentsService.markSeen(c.id, memberId).subscribe());
    });
  }

  addMention(memberId: number): void {
    const member = this.mentionCandidates().find((m) => m.id === memberId);
    if (!member) return;
    this.mentionedMembers.update((members) => [...members, member]);
    this.newCommentBody.update((body) => `${body}${body.endsWith(' ') || !body ? '' : ' '}@${member.name} `);
  }

  removeMention(memberId: number): void {
    this.mentionedMembers.update((members) => members.filter((m) => m.id !== memberId));
  }

  submitComment(): void {
    const post = this.post();
    const memberId = this.currentMemberId();
    const body = this.newCommentBody().trim();
    if (!post || !memberId || !body) return;

    const mentionedMemberIds = this.mentionedMembers().map((m) => m.id);
    this.commentsService.addComment(post.id, memberId, body, mentionedMemberIds).subscribe((comment) => {
      // getComments() je živý stream, takže tuto změnu doručí i sám – zápis proto musí být idempotentní
      this.comments.update((comments) => [...comments.filter((c) => c.id !== comment.id), comment]);
      this.newCommentBody.set('');
      this.mentionedMembers.set([]);
    });
  }

  archivePost(): void {
    const post = this.post();
    if (!post || !this.canManage) return;
    if (!confirm('Opravdu chcete tento příspěvek archivovat?')) return;

    this.postsService.archivePost(post.id).subscribe(() => {
      this.router.navigate(['/app/boards', this.board()?.slug ?? '']);
    });
  }
}
