import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Post } from '../models/post.model';
import { PostsService } from '../posts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { Member } from '../../../core/models/member.model';
import { IconComponent } from '../../../shared/icon/icon.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { isItemVisibleToUser } from '../../../core/utils/visibility.utils';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent, RelativeTimePipe],
  templateUrl: './post-detail.component.html',
})
export class PostDetailComponent implements OnInit {
  post = signal<Post | null>(null);
  loading = signal(true);
  notFound = signal(false);
  allMembers = signal<Member[]>([]);

  readonly visibleMembers = computed(() => {
    const post = this.post();
    if (!post) return [];
    return this.allMembers().filter((m) => isItemVisibleToUser(post.targetGroupIds, m.groupIds));
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
    private postsService: PostsService,
    private auth: AuthService,
    private membersService: MembersService,
  ) {}

  get isLeader(): boolean {
    return this.auth.currentUser()?.roles.includes('leader') ?? false;
  }

  get isAdmin(): boolean {
    return this.auth.currentUser()?.roles.includes('admin') ?? false;
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
      const member = members.find((m) => m.email === user.email);
      if (!member) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }

      this.postsService.getPost(id).subscribe((post) => {
        if (!post) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }

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
      });
    });
  }
}
