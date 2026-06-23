import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { GroupsService } from '../../../features/groups/groups.service';
import { MembersService } from '../../../features/members/members.service';
import { Group } from '../../../core/models/group.model';
import { Member } from '../../../core/models/member.model';

@Component({
  selector: 'app-admin-groups',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-groups">
      <div class="admin-groups__header">
        <h2>Skupiny</h2>
        <div class="admin-groups__actions">
          <a [routerLink]="'/app/admin/groups/new'" class="admin-groups__btn-add">+ Přidat skupinu</a>
          <a [routerLink]="'/app/admin'" class="admin-groups__back-link">← Zpět</a>
        </div>
      </div>

      @if (loading()) {
        <p class="admin-groups__loading">Načítám...</p>
      }

      @if (!loading() && groups().length === 0) {
        <p class="admin-groups__empty">Žádné skupiny. <a [routerLink]="'/app/admin/groups/new'">Přidejte první.</a></p>
      }

      @if (!loading() && groups().length > 0) {
        <div class="admin-groups__list">
          @for (group of groups(); track group.id) {
            <div class="admin-groups__item">
              <div class="admin-groups__item-header">
                <h3 class="admin-groups__item-title">{{ group.name }}</h3>
              </div>
              <p class="admin-groups__item-slug">{{ group.slug }}</p>
              <p class="admin-groups__item-members">
                <strong>Členové:</strong>
                @if (getGroupMembers(group.id).length === 0) {
                  <span class="admin-groups__item-empty">(žádní)</span>
                }
                @if (getGroupMembers(group.id).length > 0) {
                  <span>{{ formatMemberNames(getGroupMembers(group.id)) }}</span>
                }
              </p>
              <div class="admin-groups__item-actions">
                <a [routerLink]="'/app/admin/groups/' + group.id + '/edit'" class="admin-groups__btn-edit">
                  Upravit
                </a>
                <button type="button" class="admin-groups__btn-delete" (click)="onDelete(group.id)">
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
    .admin-groups { max-width: 900px; margin: 0 auto; }
    .admin-groups__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
    .admin-groups__header h2 { margin: 0; font-size: 1.25rem; }
    .admin-groups__actions { display: flex; gap: 1rem; align-items: center; }
    .admin-groups__btn-add { padding: 0.5rem 1rem; background: #0066cc; color: #fff; text-decoration: none; border-radius: 4px; font-size: 0.9rem; font-weight: 500; }
    .admin-groups__btn-add:hover { background: #0052a3; }
    .admin-groups__back-link { font-size: 0.9rem; color: #0066cc; text-decoration: none; }
    .admin-groups__back-link:hover { text-decoration: underline; }
    .admin-groups__loading, .admin-groups__empty { padding: 2rem; text-align: center; color: #666; }
    .admin-groups__empty a { color: #0066cc; text-decoration: none; }
    .admin-groups__list { display: flex; flex-direction: column; gap: 1rem; }
    .admin-groups__item { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 1.5rem; }
    .admin-groups__item-header { margin-bottom: 0.75rem; }
    .admin-groups__item-title { margin: 0; font-size: 1.05rem; font-weight: 600; }
    .admin-groups__item-slug { margin: 0.5rem 0 0 0; color: #999; font-size: 0.85rem; font-family: monospace; }
    .admin-groups__item-members { margin: 0.75rem 0 0 0; color: #666; font-size: 0.9rem; }
    .admin-groups__item-empty { color: #999; font-style: italic; }
    .admin-groups__item-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
    .admin-groups__btn-edit, .admin-groups__btn-delete { padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid #ccc; background: #fff; font-size: 0.85rem; cursor: pointer; }
    .admin-groups__btn-edit { color: #0066cc; text-decoration: none; display: inline-block; }
    .admin-groups__btn-edit:hover { background: #e6f2ff; border-color: #0066cc; }
    .admin-groups__btn-delete { color: #d32f2f; }
    .admin-groups__btn-delete:hover { background: #ffebee; border-color: #d32f2f; }
  `],
})
export class AdminGroupsComponent implements OnInit {
  groups = signal<Group[]>([]);
  members = signal<Member[]>([]);
  loading = signal(true);

  constructor(
    private groupsService: GroupsService,
    private membersService: MembersService,
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

  getGroupMembers(groupId: number): Member[] {
    return this.members().filter((m) => m.groupIds.includes(groupId));
  }

  formatMemberNames(members: Member[]): string {
    return members.map((m) => m.name).join(', ');
  }

  onDelete(id: number): void {
    if (!confirm('Opravdu chcete smazat tuto skupinu?')) {
      return;
    }
    this.groupsService.deleteGroup(id).subscribe({
      next: () => {
        this.loadData();
      },
    });
  }
}
