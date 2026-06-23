import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Post } from '../models/post.model';
import { PostsService } from '../posts.service';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './post-detail.component.html',
})
export class PostDetailComponent implements OnInit {
  post = signal<Post | null>(null);
  loading = signal(true);
  notFound = signal(false);

  constructor(
    private route: ActivatedRoute,
    private postsService: PostsService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.postsService.getPost(id).subscribe((post) => {
      if (!post) { this.notFound.set(true); this.loading.set(false); return; }
      this.post.set(post);
      this.loading.set(false);
    });
  }
}
