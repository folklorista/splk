import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GroupsService } from '../../../../features/groups/groups.service';
import { Group } from '../../../../core/models/group.model';

@Component({
  selector: 'app-admin-group-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="admin-group-form">
      <div class="admin-group-form__header">
        <h2>{{ isEditMode ? 'Upravit skupinu' : 'Nová skupina' }}</h2>
        <a [routerLink]="'/app/admin/groups'" class="admin-group-form__back-link">← Zpět na seznam</a>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="admin-group-form__form">
        <div class="admin-group-form__field">
          <label for="name">Název *</label>
          <input id="name" type="text" formControlName="name" placeholder="Název skupiny" required />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <span class="admin-group-form__error">Název je povinný</span>
          }
        </div>

        <div class="admin-group-form__field">
          <label for="slug">Slug *</label>
          <input id="slug" type="text" formControlName="slug" placeholder="skupiny-slug" required />
          @if (form.get('slug')?.invalid && form.get('slug')?.touched) {
            <span class="admin-group-form__error">Slug je povinný</span>
          }
        </div>

        <div class="admin-group-form__actions">
          <button type="submit" class="admin-group-form__btn-primary" [disabled]="form.invalid || isSubmitting">
            {{ isSubmitting ? 'Ukládám...' : (isEditMode ? 'Uložit' : 'Vytvořit') }}
          </button>
          <a [routerLink]="'/app/admin/groups'" class="admin-group-form__btn-secondary">Zrušit</a>
        </div>

        @if (submitError) {
          <div class="admin-group-form__error-message">{{ submitError }}</div>
        }
      </form>
    </div>
  `,
  styles: [`
    .admin-group-form { max-width: 600px; margin: 0 auto; }
    .admin-group-form__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
    .admin-group-form__header h2 { margin: 0; font-size: 1.25rem; }
    .admin-group-form__back-link { font-size: 0.9rem; color: #0066cc; text-decoration: none; }
    .admin-group-form__back-link:hover { text-decoration: underline; }
    .admin-group-form__form { display: flex; flex-direction: column; gap: 1.5rem; }
    .admin-group-form__field { display: flex; flex-direction: column; gap: 0.5rem; }
    .admin-group-form__field label { font-weight: 500; color: #333; font-size: 0.95rem; }
    .admin-group-form__field input { padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; outline: none; }
    .admin-group-form__field input:focus { border-color: #0066cc; }
    .admin-group-form__error { font-size: 0.85rem; color: #d32f2f; }
    .admin-group-form__actions { display: flex; gap: 1rem; margin-top: 1rem; }
    .admin-group-form__btn-primary, .admin-group-form__btn-secondary { padding: 0.75rem 1.5rem; border-radius: 4px; font-size: 0.95rem; font-weight: 500; border: none; cursor: pointer; }
    .admin-group-form__btn-primary { background: #0066cc; color: #fff; }
    .admin-group-form__btn-primary:hover:not(:disabled) { background: #0052a3; }
    .admin-group-form__btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .admin-group-form__btn-secondary { background: #f0f0f0; color: #333; text-decoration: none; display: inline-block; text-align: center; }
    .admin-group-form__btn-secondary:hover { background: #e0e0e0; }
    .admin-group-form__error-message { padding: 0.75rem; background: #ffebee; color: #d32f2f; border-radius: 4px; border-left: 4px solid #d32f2f; }
  `],
})
export class AdminGroupFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  private groupId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private groupsService: GroupsService,
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      slug: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.groupId = parseInt(idParam, 10);
      this.loadGroup(this.groupId);
    }
  }

  private loadGroup(id: number): void {
    this.groupsService.getGroup(id).subscribe({
      next: (group) => {
        if (group) {
          this.form.patchValue({
            name: group.name,
            slug: group.slug,
          });
        }
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
    const groupData: Omit<Group, 'id'> = {
      ensembleId: 1,
      name: formValue.name,
      slug: formValue.slug,
    };

    if (this.isEditMode && this.groupId !== null) {
      this.groupsService.updateGroup(this.groupId, groupData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/groups']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se uložit skupinu';
        },
      });
    } else {
      this.groupsService.createGroup(groupData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/groups']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se vytvořit skupinu';
        },
      });
    }
  }
}
