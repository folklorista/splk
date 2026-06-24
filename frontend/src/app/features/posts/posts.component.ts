import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Post } from './models/post.model';
import { PostsService } from './posts.service';
import { AuthService } from '../../core/auth/auth.service';
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

  visiblePosts = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    return this.posts().filter(p => isItemVisibleToUser(p.targetGroupIds, user.groups));
  });

  isUnread = (post: Post): boolean => {
    const user = this.auth.currentUser();
    return user ? !post.readers || !post.readers.includes(user.id) : false;
  };

  constructor(
    private postsService: PostsService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.postsService.getPosts().subscribe((posts) => {
      this.posts.set(posts);
      this.loading.set(false);
    });
  }
}
