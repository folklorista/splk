import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PostsService } from '../../../../features/posts/posts.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Post } from '../../../../features/posts/models/post.model';

@Component({
  selector: 'app-admin-post-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="admin-post-form">
      <div class="admin-post-form__header">
        <h2>{{ isEditMode ? 'Upravit příspěvek' : 'Nový příspěvek' }}</h2>
        <a [routerLink]="'/app/admin/posts'" class="admin-post-form__back-link">← Zpět na seznam</a>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="admin-post-form__form">
        <div class="admin-post-form__field">
          <label for="title">Nadpis *</label>
          <input
            id="title"
            type="text"
            formControlName="title"
            placeholder="Zadejte nadpis příspěvku"
            required
          />
          @if (form.get('title')?.invalid && form.get('title')?.touched) {
            <span class="admin-post-form__error">Nadpis je povinný</span>
          }
        </div>

        <div class="admin-post-form__field">
          <label for="body">Obsah *</label>
          <textarea
            id="body"
            formControlName="body"
            placeholder="Zadejte obsah příspěvku"
            rows="6"
            required
          ></textarea>
          @if (form.get('body')?.invalid && form.get('body')?.touched) {
            <span class="admin-post-form__error">Obsah je povinný</span>
          }
        </div>

        <div class="admin-post-form__field">
          <label for="isPinned">
            <input
              id="isPinned"
              type="checkbox"
              formControlName="isPinned"
            />
            Připnout na nástěnku
          </label>
        </div>

        <div class="admin-post-form__actions">
          <button type="submit" class="admin-post-form__btn-primary" [disabled]="form.invalid || isSubmitting">
            {{ isSubmitting ? 'Ukládám...' : (isEditMode ? 'Uložit' : 'Vytvořit') }}
          </button>
          <a [routerLink]="'/app/admin/posts'" class="admin-post-form__btn-secondary">Zrušit</a>
        </div>

        @if (submitError) {
          <div class="admin-post-form__error-message">
            {{ submitError }}
          </div>
        }
      </form>
    </div>
  `,
  styles: [`
    .admin-post-form {
      max-width: 600px;
      margin: 0 auto;
    }

    .admin-post-form__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
    }

    .admin-post-form__header h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .admin-post-form__back-link {
      font-size: 0.9rem;
      color: #0066cc;
      text-decoration: none;
    }

    .admin-post-form__back-link:hover {
      text-decoration: underline;
    }

    .admin-post-form__form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .admin-post-form__field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .admin-post-form__field label {
      font-weight: 500;
      color: #333;
      font-size: 0.95rem;
    }

    .admin-post-form__field input[type="text"],
    .admin-post-form__field textarea {
      padding: 0.75rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }

    .admin-post-form__field input[type="text"]:focus,
    .admin-post-form__field textarea:focus {
      border-color: #0066cc;
    }

    .admin-post-form__field input[type="checkbox"] {
      width: auto;
      margin-right: 0.5rem;
    }

    .admin-post-form__error {
      font-size: 0.85rem;
      color: #d32f2f;
    }

    .admin-post-form__actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .admin-post-form__btn-primary,
    .admin-post-form__btn-secondary {
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-size: 0.95rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .admin-post-form__btn-primary {
      background: #0066cc;
      color: #fff;
    }

    .admin-post-form__btn-primary:hover:not(:disabled) {
      background: #0052a3;
    }

    .admin-post-form__btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .admin-post-form__btn-secondary {
      background: #f0f0f0;
      color: #333;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }

    .admin-post-form__btn-secondary:hover {
      background: #e0e0e0;
    }

    .admin-post-form__error-message {
      padding: 0.75rem;
      background: #ffebee;
      color: #d32f2f;
      border-radius: 4px;
      border-left: 4px solid #d32f2f;
    }
  `],
})
export class AdminPostFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  private postId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private authService: AuthService,
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      body: ['', Validators.required],
      isPinned: [false],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.postId = parseInt(idParam, 10);
      this.loadPost(this.postId);
    }
  }

  private loadPost(id: number): void {
    this.postsService.getPost(id).subscribe({
      next: (post) => {
        if (post) {
          this.form.patchValue({
            title: post.title,
            body: post.body,
            isPinned: post.isPinned,
          });
        }
      },
      error: () => {
        this.submitError = 'Nepodařilo se načíst příspěvek';
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const formValue = this.form.value;
    const user = this.authService.currentUser();

    const postData: Omit<Post, 'id'> = {
      ensembleId: 1,
      title: formValue.title,
      body: formValue.body,
      authorId: user?.id ?? 0,
      targetGroupIds: [],
      publishedAt: new Date().toISOString(),
      isPinned: formValue.isPinned,
    };

    if (this.isEditMode && this.postId !== null) {
      this.postsService.updatePost(this.postId, postData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/posts']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se uložit příspěvek';
        },
      });
    } else {
      this.postsService.createPost(postData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/posts']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se vytvořit příspěvek';
        },
      });
    }
  }
}
