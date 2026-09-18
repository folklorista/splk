import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PostsService } from '../posts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { Member } from '../../../core/models/member.model';
import { Post } from '../models/post.model';

@Component({
  selector: 'app-post-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <a class="back-link" routerLink="/app/posts">← Zpět na nástěnku</a>

      @if (notAllowed) {
        <p class="state-note">Tento příspěvek nemůžete upravit.</p>
      } @else {
        <h1 class="page__title">{{ isEditMode ? 'Upravit příspěvek' : 'Nový příspěvek' }}</h1>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="post-form">
          <div class="post-form__field">
            <label for="title">Nadpis *</label>
            <input id="title" type="text" formControlName="title" placeholder="Zadejte nadpis příspěvku" required />
            @if (form.get('title')?.invalid && form.get('title')?.touched) {
              <span class="post-form__error">Nadpis je povinný</span>
            }
          </div>

          <div class="post-form__field">
            <label for="body">Obsah *</label>
            <textarea id="body" formControlName="body" placeholder="Zadejte obsah příspěvku" rows="6" required></textarea>
            @if (form.get('body')?.invalid && form.get('body')?.touched) {
              <span class="post-form__error">Obsah je povinný</span>
            }
          </div>

          <div class="post-form__actions">
            <button type="submit" class="btn-primary" [disabled]="form.invalid || isSubmitting">
              {{ isSubmitting ? 'Ukládám...' : (isEditMode ? 'Uložit' : 'Vytvořit') }}
            </button>
            <a class="attendance-btn" routerLink="/app/posts">Zrušit</a>
          </div>

          @if (submitError) {
            <div class="post-form__error-message">{{ submitError }}</div>
          }
        </form>
      }
    </div>
  `,
  styles: [`
    .post-form { display: flex; flex-direction: column; gap: 1.25rem; max-width: 600px; }
    .post-form__field { display: flex; flex-direction: column; gap: 0.5rem; }
    .post-form__field label { font-weight: 500; color: var(--color-text); font-size: var(--font-size-sm); }
    .post-form__field input, .post-form__field textarea {
      padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 4px;
      font-size: var(--font-size-base); font-family: inherit; outline: none;
    }
    .post-form__field input:focus, .post-form__field textarea:focus { border-color: var(--color-primary); }
    .post-form__error { font-size: var(--font-size-sm); color: #d32f2f; }
    .post-form__actions { display: flex; gap: 0.75rem; align-items: center; }
    .post-form__error-message { padding: 0.75rem; background: #ffebee; color: #d32f2f; border-radius: 4px; border-left: 4px solid #d32f2f; }
  `],
})
export class PostFormComponent implements OnInit {
  form: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  notAllowed = false;
  private postId: number | null = null;
  private originalPost: Post | null = null;
  private currentMember: Member | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private authService: AuthService,
    private membersService: MembersService,
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      body: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.notAllowed = true;
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
      this.currentMember = members.find((m) => m.email === user.email) ?? null;
      if (!this.currentMember) {
        this.notAllowed = true;
        return;
      }

      const idParam = this.route.snapshot.paramMap.get('id');
      if (!idParam) return;

      this.isEditMode = true;
      this.postId = parseInt(idParam, 10);
      this.postsService.getPost(this.postId).subscribe((post) => {
        if (!post) {
          this.notAllowed = true;
          return;
        }
        const canEdit = post.authorId === this.currentMember!.id || user.roles.includes('leader') || user.roles.includes('admin');
        if (!canEdit) {
          this.notAllowed = true;
          return;
        }
        this.originalPost = post;
        this.form.patchValue({ title: post.title, body: post.body });
      });
    });
  }

  onSubmit(): void {
    if (this.form.invalid || !this.currentMember) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    const { title, body } = this.form.value;

    if (this.isEditMode && this.postId !== null && this.originalPost) {
      const { id, ...rest } = this.originalPost;
      this.postsService.updatePost(this.postId, { ...rest, title, body }).subscribe({
        next: () => this.router.navigate(['/app/posts', this.postId]),
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se uložit příspěvek';
        },
      });
    } else {
      const now = new Date().toISOString();
      const newPost: Omit<Post, 'id'> = {
        ensembleId: 1,
        title,
        body,
        authorId: this.currentMember.id,
        targetGroupIds: [],
        publishedAt: now,
        updatedAt: now,
        isPinned: false,
        readers: [],
      };
      this.postsService.createPost(newPost).subscribe({
        next: (created) => this.router.navigate(['/app/posts', created.id]),
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se vytvořit příspěvek';
        },
      });
    }
  }
}
