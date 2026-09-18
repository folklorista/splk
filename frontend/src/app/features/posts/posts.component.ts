import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Post } from './models/post.model';
import { PostsService } from './posts.service';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { isItemVisibleToUser } from '../../core/utils/visibility.utils';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './posts.component.html',
})
export class PostsComponent implements OnInit {
  posts = signal<Post[]>([]);
  loading = signal(true);
  currentMemberId = signal<number | null>(null);

  visiblePosts = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    return this.posts().filter(p => isItemVisibleToUser(p.targetGroupIds, user.groupIds));
  });

  isUnread = (post: Post): boolean => {
    const memberId = this.currentMemberId();
    return memberId ? !post.readers || !post.readers.includes(memberId) : false;
  };

  constructor(
    private postsService: PostsService,
    private auth: AuthService,
    private membersService: MembersService
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
      const member = members.find((m) => m.email === user.email);
      if (member) {
        this.currentMemberId.set(member.id);
      }

      this.postsService.getPosts().subscribe((posts) => {
        this.posts.set(posts);
        this.loading.set(false);
      });
    });
  }
}
