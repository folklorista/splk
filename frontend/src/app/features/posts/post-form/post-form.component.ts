import { Component, OnInit, inject } from '@angular/core';
import { MentionInputComponent, MentionSubmit } from '../../../shared/mention-input/mention-input.component';
import { EventsService } from '../../events/events.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PostsService } from '../posts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { Member } from '../../../core/models/member.model';
import { Post } from '../models/post.model';
import { BoardsService } from '../../boards/boards.service';
import { Group } from '../../../core/models/group.model';

@Component({
  selector: 'app-post-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MentionInputComponent],
  template: `
    <div class="page">
      <a class="back-link" [routerLink]="backLink" [queryParams]="backQuery">← Zpět na nástěnku</a>

      @if (notAllowed) {
        <p class="state-note">Tento příspěvek nemůžete upravit.</p>
      } @else {
        <h1 class="page__title">{{ isEditMode ? 'Upravit příspěvek' : 'Nový příspěvek' }}@if (board) { – {{ board.name }}}</h1>

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
            <app-mention-input [candidates]="mentionable" [events]="linkableEvents()" [rows]="6" [showSubmit]="false" [initialBody]="initialBody"
              placeholder="Zadejte obsah příspěvku… (&#64; zmínit člena, # odkázat na akci)" label="Obsah" (valueChange)="onBodyChange($event)" />
            <span class="post-form__hint">Napište &#64; a vyberte člena, nebo # a vyberte akci – v příspěvku se z ní stane odkaz.</span>
            @if (form.get('body')?.invalid && form.get('body')?.touched) {
              <span class="post-form__error">Obsah je povinný</span>
            }
          </div>

          <div class="post-form__actions">
            <button type="submit" class="btn-primary" [disabled]="form.invalid || isSubmitting">
              {{ isSubmitting ? 'Ukládám...' : (isEditMode ? 'Uložit' : 'Vytvořit') }}
            </button>
            <a class="attendance-btn" [routerLink]="backLink">Zrušit</a>
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
    .post-form__error { font-size: var(--font-size-sm); color: var(--status-danger-fg); }
    .post-form__hint { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .post-form__actions { display: flex; gap: 0.75rem; align-items: center; }
    .post-form__error-message { padding: 0.75rem; background: var(--status-danger-bg); color: var(--status-danger-fg); border-radius: var(--radius-sm); border-left: 4px solid var(--status-danger-fg); }
  `],
})
export class PostFormComponent implements OnInit {
  form: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  notAllowed = false;
  board: Group | null = null;
  private postId: number | null = null;
  private originalPost: Post | null = null;
  private currentMember: Member | null = null;
  private allMembers: Member[] = [];
  private mentionedMemberIds: number[] = [];
  // Zmínit lze aktivní členy skupiny nástěnky kromě sebe; odkázat na akce, které autor vidí
  mentionable: Member[] = [];
  readonly linkableEvents = inject(EventsService).linkableEvents;
  // Uložený text s tokeny – pole ho při úpravě převede na čitelné „@Přezdívka“ / „#Akce“
  initialBody = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private authService: AuthService,
    private membersService: MembersService,
    private boardsService: BoardsService,
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
      this.currentMember = members.find((m) => m.userId === user.id) ?? null;
      this.allMembers = members;
      if (!this.currentMember) {
        this.notAllowed = true;
        return;
      }

      const idParam = this.route.snapshot.paramMap.get('id');
      if (!idParam) {
        // Nový příspěvek – přístup na nástěnku už ověřil boardGuard
        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        this.boardsService.getBoardBySlug(slug).subscribe((board) => {
          this.board = board ?? null;
          this.notAllowed = !board;
          this.updateMentionable();
        });
        return;
      }

      this.isEditMode = true;
      this.postId = parseInt(idParam, 10);
      this.postsService.getPost(this.postId).subscribe((post) => {
        if (!post) {
          this.notAllowed = true;
          return;
        }
        // Obsah upravuje jen autor – správce skupiny cizí příspěvek nepřepisuje, jen moderuje
        const canEdit = post.authorId === this.currentMember!.id;
        if (!canEdit) {
          this.notAllowed = true;
          return;
        }
        this.boardsService.getBoardById(post.groupId).subscribe((board) => {
          if (!board) {
            this.notAllowed = true;
            return;
          }
          this.board = board;
          this.originalPost = post;
          this.updateMentionable();
          this.initialBody = post.body;
          this.mentionedMemberIds = post.mentionedMemberIds ?? [];
          this.form.patchValue({ title: post.title, body: post.body });
        });
      });
    });
  }

  private updateMentionable(): void {
    const groupId = this.board?.id;
    this.mentionable = this.allMembers.filter((m) => m.isActive && groupId !== undefined && m.groupIds.includes(groupId) && m.id !== this.currentMember?.id);
  }

  onBodyChange(value: MentionSubmit): void {
    this.mentionedMemberIds = value.mentionedMemberIds;
    this.form.patchValue({ body: value.body });
    this.form.get('body')?.markAsTouched();
  }

  get backLink(): string[] {
    if (this.isEditMode && this.postId !== null) return ['/app/posts', String(this.postId)];
    return this.board ? ['/app/boards', this.board.slug] : ['/app/boards'];
  }

  get backQuery(): Record<string, string> | null {
    return this.isEditMode ? null : { tab: 'board' };
  }

  onSubmit(): void {
    if (this.form.invalid || !this.currentMember || !this.board) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    const { title, body } = this.form.value;

    if (this.isEditMode && this.postId !== null && this.originalPost) {
      const { id, ...rest } = this.originalPost;
      this.postsService.updatePost(this.postId, { ...rest, title, body, mentionedMemberIds: this.mentionedMemberIds }).subscribe({
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
        groupId: this.board.id,
        publishedAt: now,
        updatedAt: now,
        isPinned: false,
        readers: [],
        mentionedMemberIds: this.mentionedMemberIds,
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
