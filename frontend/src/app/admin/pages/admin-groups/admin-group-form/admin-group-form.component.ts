import { Component, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { GroupsService } from '../../../../features/groups/groups.service';
import { MembersService } from '../../../../features/members/members.service';
import { Group } from '../../../../core/models/group.model';
import { Member } from '../../../../core/models/member.model';
import { IconComponent, IconName, GROUP_ICON_OPTIONS } from '../../../../shared/icon/icon.component';
import { getFullName } from '../../../../core/utils/member.utils';

@Component({
  selector: 'app-admin-group-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
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

        <div class="admin-group-form__field">
          <label>Ikona</label>
          <div class="admin-group-form__icon-grid">
            <button
              type="button"
              class="admin-group-form__icon-option"
              [class.admin-group-form__icon-option--active]="!form.value.icon"
              (click)="selectIcon(null)"
              title="Bez ikony"
            >
              —
            </button>
            @for (option of iconOptions; track option) {
              <button
                type="button"
                class="admin-group-form__icon-option"
                [class.admin-group-form__icon-option--active]="form.value.icon === option"
                (click)="selectIcon(option)"
                [title]="option"
              >
                <app-icon [name]="option" [size]="20" />
              </button>
            }
          </div>
        </div>

        @if (isEditMode) {
          <div class="admin-group-form__field">
            <label>Členové skupiny</label>
            <p class="admin-group-form__hint">Změny se uloží až po kliknutí na „Uložit“.</p>
            @if (groupMembers().length === 0) {
              <p class="admin-group-form__empty">Skupina zatím nemá žádné členy.</p>
            } @else {
              <ul class="admin-group-form__member-list">
                @for (member of groupMembers(); track member.id) {
                  <li class="admin-group-form__member-row">
                    <span>{{ fullName(member) }} <span class="admin-group-form__member-email">({{ member.nickname }})</span></span>
                    <button
                      type="button"
                      class="admin-group-form__member-remove"
                      (click)="removeMember(member.id)"
                      title="Odebrat ze skupiny"
                    >
                      <app-icon name="close" [size]="14" />
                    </button>
                  </li>
                }
              </ul>
            }

            @if (availableMembers().length > 0) {
              <div class="admin-group-form__add-member">
                <select #memberSelect class="admin-group-form__member-select">
                  @for (member of availableMembers(); track member.id) {
                    <option [value]="member.id">{{ fullName(member) }} ({{ member.nickname }})</option>
                  }
                </select>
                <button type="button" class="admin-group-form__btn-secondary" (click)="addMember(+memberSelect.value)">
                  + Přidat člena
                </button>
              </div>
            } @else {
              <p class="admin-group-form__empty">Všichni členové už jsou ve skupině.</p>
            }
          </div>
        }

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
    .admin-group-form__icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 0.5rem; max-width: 420px; }
    .admin-group-form__icon-option { display: flex; align-items: center; justify-content: center; height: 44px; border: 1px solid #ccc; border-radius: 4px; background: #fff; color: #555; cursor: pointer; }
    .admin-group-form__icon-option:hover { border-color: #0066cc; color: #0066cc; }
    .admin-group-form__icon-option--active { border-color: #0066cc; background: #e3f2fd; color: #0066cc; }
    .admin-group-form__hint { color: #999; font-size: 0.85rem; margin: 0; }
    .admin-group-form__empty { color: #999; font-style: italic; margin: 0; }
    .admin-group-form__member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .admin-group-form__member-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .admin-group-form__member-email { color: #999; font-size: 0.85rem; }
    .admin-group-form__member-remove { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: none; color: #999; cursor: pointer; border-radius: 50%; }
    .admin-group-form__member-remove:hover { color: #d32f2f; background: #ffebee; }
    .admin-group-form__add-member { display: flex; gap: 0.75rem; margin-top: 0.75rem; }
    .admin-group-form__member-select { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
  `],
})
export class AdminGroupFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  readonly iconOptions = GROUP_ICON_OPTIONS;
  private allMembers = signal<Member[]>([]);
  private pendingMemberIds = signal<Set<number>>(new Set());
  private originalMemberIds = new Set<number>();
  readonly groupMembers = computed(() => this.allMembers().filter((m) => this.pendingMemberIds().has(m.id)));
  readonly availableMembers = computed(() => this.allMembers().filter((m) => !this.pendingMemberIds().has(m.id)));
  private groupId: number | null = null;

  fullName = getFullName;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private groupsService: GroupsService,
    private membersService: MembersService,
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      slug: ['', Validators.required],
      icon: [null as IconName | null],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.groupId = parseInt(idParam, 10);
      this.loadGroup(this.groupId);
      this.loadMembers();
    }
  }

  selectIcon(icon: IconName | null): void {
    this.form.patchValue({ icon });
  }

  private loadMembers(): void {
    this.membersService.getMembers().subscribe((members) => {
      const groupId = this.groupId!;
      this.allMembers.set(members);
      const currentIds = new Set(members.filter((m) => m.groupIds.includes(groupId)).map((m) => m.id));
      this.originalMemberIds = currentIds;
      this.pendingMemberIds.set(new Set(currentIds));
    });
  }

  addMember(memberId: number): void {
    if (!memberId) return;
    this.pendingMemberIds.update((ids) => new Set(ids).add(memberId));
  }

  removeMember(memberId: number): void {
    this.pendingMemberIds.update((ids) => {
      const next = new Set(ids);
      next.delete(memberId);
      return next;
    });
  }

  private saveMembershipChanges(): Observable<unknown> {
    if (this.groupId === null) return of(null);
    const groupId = this.groupId;
    const pending = this.pendingMemberIds();

    const added = [...pending].filter((id) => !this.originalMemberIds.has(id));
    const removed = [...this.originalMemberIds].filter((id) => !pending.has(id));
    if (added.length === 0 && removed.length === 0) return of(null);

    const members = this.allMembers();
    const updates = [...added, ...removed].map((memberId) => {
      const member = members.find((m) => m.id === memberId)!;
      const { id, ...rest } = member;
      const groupIds = added.includes(memberId)
        ? [...member.groupIds, groupId]
        : member.groupIds.filter((g) => g !== groupId);
      return this.membersService.updateMember(memberId, { ...rest, groupIds });
    });
    return forkJoin(updates);
  }

  private loadGroup(id: number): void {
    this.groupsService.getGroup(id).subscribe({
      next: (group) => {
        if (group) {
          this.form.patchValue({
            name: group.name,
            slug: group.slug,
            icon: group.icon ?? null,
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
      icon: formValue.icon ?? undefined,
    };

    if (this.isEditMode && this.groupId !== null) {
      this.groupsService.updateGroup(this.groupId, groupData).subscribe({
        next: () => {
          this.saveMembershipChanges().subscribe({
            next: () => this.router.navigate(['/app/admin/groups']),
            error: () => {
              this.isSubmitting = false;
              this.submitError = 'Skupina byla uložena, ale nepodařilo se uložit členy';
            },
          });
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
