import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Post } from './models/post.model';
import { PostsService } from './posts.service';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './posts.component.html',
})
export class PostsComponent implements OnInit {
  posts = signal<Post[]>([]);
  loading = signal(true);

  constructor(private postsService: PostsService) {}

  ngOnInit(): void {
    this.postsService.getPosts().subscribe((posts) => {
      this.posts.set(posts);
      this.loading.set(false);
    });
  }
}
