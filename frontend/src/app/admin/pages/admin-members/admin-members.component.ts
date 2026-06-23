import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MembersService } from '../../../features/members/members.service';
import { GroupsService } from '../../../features/groups/groups.service';
import { Member } from '../../../core/models/member.model';
import { Group } from '../../../core/models/group.model';

@Component({
  selector: 'app-admin-members',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-members">
      <div class="admin-members__header">
        <h2>Členové</h2>
        <div class="admin-members__actions">
          <a [routerLink]="'/app/admin/members/new'" class="admin-members__btn-add">+ Přidat člena</a>
          <a [routerLink]="'/app/admin'" class="admin-members__back-link">← Zpět</a>
        </div>
      </div>

      @if (loading()) {
        <p class="admin-members__loading">Načítám...</p>
      }

      @if (!loading() && members().length === 0) {
        <p class="admin-members__empty">Žádní členové. <a [routerLink]="'/app/admin/members/new'">Přidejte první.</a></p>
      }

      @if (!loading() && members().length > 0) {
        <div class="admin-members__list">
          @for (member of members(); track member.id) {
            <div class="admin-members__item">
              <div class="admin-members__item-header">
                <h3 class="admin-members__item-title">{{ member.name }}</h3>
                @if (!member.isActive) {
                  <span class="admin-members__badge-inactive">Neaktivní</span>
                }
              </div>
              <p class="admin-members__item-contact">
                <span>📧 {{ member.email }}</span>
                @if (member.phone) {
                  <span>📱 {{ member.phone }}</span>
                }
              </p>
              <p class="admin-members__item-groups">
                <strong>Skupiny:</strong>
                @if (getMemberGroupNames(member.id).length === 0) {
                  <span class="admin-members__item-empty">(žádné)</span>
                }
                @if (getMemberGroupNames(member.id).length > 0) {
                  <span>{{ getMemberGroupNames(member.id).join(', ') }}</span>
                }
              </p>
              <div class="admin-members__item-actions">
                <a [routerLink]="'/app/admin/members/' + member.id + '/edit'" class="admin-members__btn-edit">
                  Upravit
                </a>
                <button type="button" class="admin-members__btn-delete" (click)="onDelete(member.id)">
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
    .admin-members { max-width: 900px; margin: 0 auto; }
    .admin-members__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
    .admin-members__header h2 { margin: 0; font-size: 1.25rem; }
    .admin-members__actions { display: flex; gap: 1rem; align-items: center; }
    .admin-members__btn-add { padding: 0.5rem 1rem; background: #0066cc; color: #fff; text-decoration: none; border-radius: 4px; font-size: 0.9rem; font-weight: 500; }
    .admin-members__btn-add:hover { background: #0052a3; }
    .admin-members__back-link { font-size: 0.9rem; color: #0066cc; text-decoration: none; }
    .admin-members__back-link:hover { text-decoration: underline; }
    .admin-members__loading, .admin-members__empty { padding: 2rem; text-align: center; color: #666; }
    .admin-members__empty a { color: #0066cc; text-decoration: none; }
    .admin-members__list { display: flex; flex-direction: column; gap: 1rem; }
    .admin-members__item { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 1.5rem; }
    .admin-members__item-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
    .admin-members__item-title { margin: 0; font-size: 1.05rem; font-weight: 600; flex: 1; }
    .admin-members__badge-inactive { padding: 0.25rem 0.75rem; background: #f0f0f0; color: #999; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .admin-members__item-contact { margin: 0.5rem 0; color: #666; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .admin-members__item-groups { margin: 0.75rem 0 0 0; color: #666; font-size: 0.9rem; }
    .admin-members__item-empty { color: #999; font-style: italic; }
    .admin-members__item-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
    .admin-members__btn-edit, .admin-members__btn-delete { padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid #ccc; background: #fff; font-size: 0.85rem; cursor: pointer; }
    .admin-members__btn-edit { color: #0066cc; text-decoration: none; display: inline-block; }
    .admin-members__btn-edit:hover { background: #e6f2ff; border-color: #0066cc; }
    .admin-members__btn-delete { color: #d32f2f; }
    .admin-members__btn-delete:hover { background: #ffebee; border-color: #d32f2f; }
  `],
})
export class AdminMembersComponent implements OnInit {
  members = signal<Member[]>([]);
  groups = signal<Group[]>([]);
  loading = signal(true);

  constructor(
    private membersService: MembersService,
    private groupsService: GroupsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.groupsService.getGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.membersService.getMembers().subscribe({
          next: (members) => {
            this.members.set(members);
            this.loading.set(false);
          },
        });
      },
    });
  }

  getMemberGroupNames(memberId: number): string[] {
    const member = this.members().find((m) => m.id === memberId);
    if (!member) return [];
    return member.groupIds
      .map((groupId) => this.groups().find((g) => g.id === groupId)?.name)
      .filter((name): name is string => name !== undefined);
  }

  onDelete(id: number): void {
    if (!confirm('Opravdu chcete smazat tohoto člena?')) {
      return;
    }
    this.membersService.deleteMember(id).subscribe({
      next: () => {
        this.loadData();
      },
    });
  }
}
