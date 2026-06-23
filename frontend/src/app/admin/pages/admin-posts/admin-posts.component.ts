import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { PostsService } from '../../../features/posts/posts.service';
import { Post } from '../../../features/posts/models/post.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-admin-posts',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="admin-posts">
      <div class="admin-posts__header">
        <h2>Příspěvky (nástěnka)</h2>
        <div class="admin-posts__actions">
          <a [routerLink]="'/app/admin/posts/new'" class="admin-posts__btn-add">+ Přidat příspěvek</a>
          <a [routerLink]="'/app/admin'" class="admin-posts__back-link">← Zpět</a>
        </div>
      </div>

      @if (loading()) {
        <p class="admin-posts__loading">Načítám...</p>
      }

      @if (!loading() && posts().length === 0) {
        <p class="admin-posts__empty">Žádné příspěvky. <a [routerLink]="'/app/admin/posts/new'">Přidejte první.</a></p>
      }

      @if (!loading() && posts().length > 0) {
        <div class="admin-posts__list">
          @for (post of posts(); track post.id) {
            <div class="admin-posts__item">
              <div class="admin-posts__item-header">
                <h3 class="admin-posts__item-title">{{ post.title }}</h3>
                @if (post.isPinned) {
                  <span class="admin-posts__badge-pinned">Připnuto</span>
                }
              </div>
              <p class="admin-posts__item-body">{{ post.body.substring(0, 100) }}{{ post.body.length > 100 ? '...' : '' }}</p>
              <div class="admin-posts__item-meta">
                <span class="admin-posts__item-date">{{ post.publishedAt | date: 'short' }}</span>
              </div>
              <div class="admin-posts__item-actions">
                <a [routerLink]="'/app/admin/posts/' + post.id + '/edit'" class="admin-posts__btn-edit">
                  Upravit
                </a>
                <button
                  type="button"
                  class="admin-posts__btn-delete"
                  (click)="onDelete(post.id)"
                >
                  Smazat
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-posts {
      max-width: 900px;
      margin: 0 auto;
    }

    .admin-posts__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
    }

    .admin-posts__header h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .admin-posts__actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .admin-posts__btn-add {
      padding: 0.5rem 1rem;
      background: #0066cc;
      color: #fff;
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background 0.2s;
    }

    .admin-posts__btn-add:hover {
      background: #0052a3;
    }

    .admin-posts__back-link {
      font-size: 0.9rem;
      color: #0066cc;
      text-decoration: none;
    }

    .admin-posts__back-link:hover {
      text-decoration: underline;
    }

    .admin-posts__loading,
    .admin-posts__empty {
      padding: 2rem;
      text-align: center;
      color: #666;
    }

    .admin-posts__empty a {
      color: #0066cc;
      text-decoration: none;
    }

    .admin-posts__empty a:hover {
      text-decoration: underline;
    }

    .admin-posts__list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .admin-posts__item {
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .admin-posts__item-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .admin-posts__item-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      flex: 1;
    }

    .admin-posts__badge-pinned {
      padding: 0.25rem 0.75rem;
      background: #fff3e0;
      color: #e65100;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .admin-posts__item-body {
      margin: 0;
      color: #666;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .admin-posts__item-meta {
      font-size: 0.85rem;
      color: #999;
    }

    .admin-posts__item-date {
      display: block;
    }

    .admin-posts__item-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .admin-posts__btn-edit,
    .admin-posts__btn-delete {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      border: 1px solid #ccc;
      background: #fff;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .admin-posts__btn-edit {
      color: #0066cc;
      text-decoration: none;
      display: inline-block;
    }

    .admin-posts__btn-edit:hover {
      background: #e6f2ff;
      border-color: #0066cc;
    }

    .admin-posts__btn-delete {
      color: #d32f2f;
    }

    .admin-posts__btn-delete:hover {
      background: #ffebee;
      border-color: #d32f2f;
    }
  `],
})
export class AdminPostsComponent implements OnInit {
  posts = signal<Post[]>([]);
  loading = signal(true);

  constructor(
    private postsService: PostsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  private loadPosts(): void {
    this.loading.set(true);
    this.postsService.getPosts().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.loading.set(false);
      },
    });
  }

  onDelete(id: number): void {
    if (!confirm('Opravdu chcete smazat tento příspěvek?')) {
      return;
    }

    this.postsService.deletePost(id).subscribe({
      next: () => {
        this.loadPosts();
      },
    });
  }
}
