import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GroupsService } from '../groups/groups.service';
import { MembersService } from '../members/members.service';
import { MandatesService } from '../mandates/mandates.service';
import { JoinRequestsService } from '../groups/join-requests.service';
import { AccessService } from '../../core/access/access.service';
import { GROUP_VISIBILITY_LABELS, Group } from '../../core/models/group.model';
import { isPendingJoinRequest } from '../groups/models/join-request.model';
import { IconComponent } from '../../shared/icon/icon.component';

// Správa → Skupiny: provozní metadata všech skupin (bez přístupu k jejich obsahu)
@Component({
  selector: 'app-manage-groups',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="cs-toolbar">
      <span class="cs-muted">{{ rows().length }} skupin</span>
      <span class="cs-toolbar__spacer"></span>
      @if (canCreate()) {
        <a class="cs-btn cs-btn--primary" routerLink="/app/manage/groups/new">+ Založit skupinu</a>
      }
    </div>
    <ul class="item-list">
      @for (row of rows(); track row.group.id) {
        <li class="item-list__item item-list__item--link" [class.item-list__item--requires-action]="!row.owner" [routerLink]="['/app/manage/groups', row.group.id]">
          <div class="item-list__row">
            <span class="item-list__title">
              @if (row.group.icon) { <app-icon [name]="row.group.icon" [size]="16" /> }
              {{ row.group.name }}
            </span>
            <div class="item-list__badges">
              <span class="badge">{{ visibilityLabel(row.group) }}</span>
              @if (row.pending) { <span class="badge badge--requires-action">{{ row.pending }} čeká</span> }
              @if (!row.owner) { <span class="badge badge--requires-action">bez správce</span> }
            </div>
          </div>
          <div class="item-list__meta">
            {{ row.members }} členů · správce: {{ row.owner ?? '—' }}
            @if (row.deputies) { · spolusprávci: {{ row.deputies }} }
            · {{ communication(row.group) }}
          </div>
        </li>
      }
    </ul>
  `,
  })
export class ManageGroupsComponent {
  private groupsService = inject(GroupsService);
  private membersService = inject(MembersService);
  private mandatesService = inject(MandatesService);
  private requests = inject(JoinRequestsService);
  readonly canCreate = inject(AccessService).canCreateGroup;

  private nickname(id: number): string | undefined {
    return this.membersService.members().find((m) => m.id === id)?.nickname;
  }

  readonly rows = computed(() =>
    this.groupsService.groups().map((group) => {
      const mandates = this.mandatesService.mandates().filter((m) => m.groupId === group.id);
      return {
        group,
        members: this.membersService.members().filter((m) => m.isActive && m.groupIds.includes(group.id)).length,
        owner: mandates.filter((m) => m.kind === 'group-owner').map((m) => this.nickname(m.memberId)).join(', ') || undefined,
        deputies: mandates.filter((m) => m.kind === 'group-deputy').map((m) => this.nickname(m.memberId)).join(', '),
        pending: this.requests.requests().filter((r) => r.groupId === group.id && isPendingJoinRequest(r)).length,
      };
    }),
  );

  visibilityLabel(group: Group): string {
    return GROUP_VISIBILITY_LABELS[group.visibility ?? 'private'];
  }

  communication(group: Group): string {
    const parts = [group.chatEnabled !== false ? 'chat' : '', group.boardEnabled !== false ? 'nástěnka' : ''].filter(Boolean);
    return parts.length ? parts.join(' + ') : 'jen organizační';
  }
}
