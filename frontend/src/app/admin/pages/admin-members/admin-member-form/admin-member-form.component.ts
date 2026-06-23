import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MembersService } from '../../../../features/members/members.service';
import { GroupsService } from '../../../../features/groups/groups.service';
import { Member } from '../../../../core/models/member.model';
import { Group } from '../../../../core/models/group.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-member-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  template: `
    <div class="admin-member-form">
      <div class="admin-member-form__header">
        <h2>{{ isEditMode ? 'Upravit člena' : 'Nový člen' }}</h2>
        <a [routerLink]="'/app/admin/members'" class="admin-member-form__back-link">← Zpět na seznam</a>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="admin-member-form__form">
        <div class="admin-member-form__field">
          <label for="name">Jméno *</label>
          <input id="name" type="text" formControlName="name" placeholder="Jméno člena" required />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <span class="admin-member-form__error">Jméno je povinné</span>
          }
        </div>

        <div class="admin-member-form__field">
          <label for="email">Email *</label>
          <input id="email" type="email" formControlName="email" placeholder="email@example.cz" required />
          @if (form.get('email')?.invalid && form.get('email')?.touched) {
            <span class="admin-member-form__error">Zadejte platný email</span>
          }
        </div>

        <div class="admin-member-form__field">
          <label for="phone">Telefon</label>
          <input id="phone" type="tel" formControlName="phone" placeholder="+420 123 456 789" />
        </div>

        <div class="admin-member-form__field">
          <label for="isActive">
            <input id="isActive" type="checkbox" formControlName="isActive" />
            Aktivní člen
          </label>
        </div>

        <div class="admin-member-form__field">
          <label>Skupiny</label>
          <div class="admin-member-form__group-checkboxes">
            @for (group of availableGroups(); track group.id) {
              <label class="admin-member-form__group-checkbox">
                <input
                  type="checkbox"
                  [checked]="selectedGroupIds().includes(group.id)"
                  (change)="onGroupChange(group.id, $event)"
                />
                {{ group.name }}
              </label>
            }
          </div>
        </div>

        <div class="admin-member-form__actions">
          <button type="submit" class="admin-member-form__btn-primary" [disabled]="form.invalid || isSubmitting">
            {{ isSubmitting ? 'Ukládám...' : (isEditMode ? 'Uložit' : 'Vytvořit') }}
          </button>
          <a [routerLink]="'/app/admin/members'" class="admin-member-form__btn-secondary">Zrušit</a>
        </div>

        @if (submitError) {
          <div class="admin-member-form__error-message">{{ submitError }}</div>
        }
      </form>
    </div>
  `,
  styles: [`
    .admin-member-form { max-width: 600px; margin: 0 auto; }
    .admin-member-form__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
    .admin-member-form__header h2 { margin: 0; font-size: 1.25rem; }
    .admin-member-form__back-link { font-size: 0.9rem; color: #0066cc; text-decoration: none; }
    .admin-member-form__back-link:hover { text-decoration: underline; }
    .admin-member-form__form { display: flex; flex-direction: column; gap: 1.5rem; }
    .admin-member-form__field { display: flex; flex-direction: column; gap: 0.5rem; }
    .admin-member-form__field label { font-weight: 500; color: #333; font-size: 0.95rem; }
    .admin-member-form__field input[type="text"],
    .admin-member-form__field input[type="email"],
    .admin-member-form__field input[type="tel"] { padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; outline: none; }
    .admin-member-form__field input:focus { border-color: #0066cc; }
    .admin-member-form__field input[type="checkbox"] { width: auto; margin-right: 0.5rem; }
    .admin-member-form__error { font-size: 0.85rem; color: #d32f2f; }
    .admin-member-form__group-checkboxes { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; background: #f9f9f9; border-radius: 4px; border: 1px solid #ddd; }
    .admin-member-form__group-checkbox { display: flex; align-items: center; font-size: 0.95rem; cursor: pointer; }
    .admin-member-form__group-checkbox input { margin-right: 0.5rem; }
    .admin-member-form__actions { display: flex; gap: 1rem; margin-top: 1rem; }
    .admin-member-form__btn-primary, .admin-member-form__btn-secondary { padding: 0.75rem 1.5rem; border-radius: 4px; font-size: 0.95rem; font-weight: 500; border: none; cursor: pointer; }
    .admin-member-form__btn-primary { background: #0066cc; color: #fff; }
    .admin-member-form__btn-primary:hover:not(:disabled) { background: #0052a3; }
    .admin-member-form__btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .admin-member-form__btn-secondary { background: #f0f0f0; color: #333; text-decoration: none; display: inline-block; text-align: center; }
    .admin-member-form__btn-secondary:hover { background: #e0e0e0; }
    .admin-member-form__error-message { padding: 0.75rem; background: #ffebee; color: #d32f2f; border-radius: 4px; border-left: 4px solid #d32f2f; }
  `],
})
export class AdminMemberFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  availableGroups = signal<Group[]>([]);
  selectedGroupIds = signal<number[]>([]);
  private memberId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private membersService: MembersService,
    private groupsService: GroupsService,
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      isActive: [true],
    });
  }

  ngOnInit(): void {
    this.loadGroups();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.memberId = parseInt(idParam, 10);
      this.loadMember(this.memberId);
    }
  }

  private loadGroups(): void {
    this.groupsService.getGroups().subscribe({
      next: (groups) => {
        this.availableGroups.set(groups);
      },
    });
  }

  private loadMember(id: number): void {
    this.membersService.getMember(id).subscribe({
      next: (member) => {
        if (member) {
          this.form.patchValue({
            name: member.name,
            email: member.email,
            phone: member.phone || '',
            isActive: member.isActive,
          });
          this.selectedGroupIds.set([...member.groupIds]);
        }
      },
    });
  }

  onGroupChange(groupId: number, event: any): void {
    const isChecked = event.target.checked;
    const currentIds = this.selectedGroupIds();

    if (isChecked) {
      this.selectedGroupIds.set([...currentIds, groupId]);
    } else {
      this.selectedGroupIds.set(currentIds.filter((id) => id !== groupId));
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const formValue = this.form.value;
    const memberData: Omit<Member, 'id'> = {
      ensembleId: 1,
      userId: this.memberId || 999,
      name: formValue.name,
      email: formValue.email,
      phone: formValue.phone || undefined,
      groupIds: this.selectedGroupIds(),
      isActive: formValue.isActive,
    };

    if (this.isEditMode && this.memberId !== null) {
      this.membersService.updateMember(this.memberId, memberData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/members']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se uložit člena';
        },
      });
    } else {
      this.membersService.createMember(memberData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/members']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se vytvořit člena';
        },
      });
    }
  }
}
