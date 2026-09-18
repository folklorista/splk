import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Post } from '../models/post.model';
import { PostsService } from '../posts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

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

  constructor(
    private route: ActivatedRoute,
    private postsService: PostsService,
    private auth: AuthService,
    private membersService: MembersService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const user = this.auth.currentUser();

    if (!user) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
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

        if (post.readers && !post.readers.includes(member.id)) {
          post.readers.push(member.id);
          this.postsService.updatePost(post.id, post).subscribe(() => {
            this.post.set(post);
            this.loading.set(false);
          });
        } else {
          this.post.set(post);
          this.loading.set(false);
        }
      });
    });
  }
}
