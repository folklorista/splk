import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MembersService } from '../members/members.service';
import { MandatesService } from '../mandates/mandates.service';
import { GroupsService } from '../groups/groups.service';
import { MANDATE_LABELS } from '../../core/models/mandate.model';
import { Member } from '../../core/models/member.model';
import { getFullName, nicknameKey } from '../../core/utils/member.utils';

type StatusFilter = 'active' | 'external' | 'former' | 'all';

// Správa → Členové: evidované osoby včetně externistů a bývalých členů (nemažou se)
@Component({
  selector: 'app-manage-members',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="cs-toolbar">
      <input class="cs-input mm__search" type="search" placeholder="Hledat jméno, přezdívku nebo funkci…" aria-label="Hledat osobu"
        [value]="query()" (input)="query.set($any($event.target).value)" />
      <select class="cs-input mm__filter" aria-label="Stav" (change)="status.set($any($event.target).value)">
        <option value="active">Aktivní členové</option>
        <option value="external">Externisté</option>
        <option value="former">Bývalí členové</option>
        <option value="all">Všichni</option>
      </select>
      <span class="cs-toolbar__spacer"></span>
      <a class="cs-btn cs-btn--primary" routerLink="/app/manage/members/new">+ Přidat osobu</a>
    </div>

    <p class="cs-muted">{{ rows().length }} osob</p>
    <ul class="item-list item-list--rows">
      @for (member of rows(); track member.id) {
        <li class="item-list__item item-list__item--link" [routerLink]="['/app/manage/members', member.id]">
          <div class="item-list__row">
            <span class="item-list__title">{{ member.nickname }} <span class="cs-muted">{{ fullName(member) }}</span></span>
            <div class="item-list__badges">
              @if (!member.isActive) { <span class="badge">{{ member.isExternal ? 'vyřazený externista' : 'bývalý člen' }}</span> }
              @else if (member.isExternal) { <span class="badge">externista</span> }
              @for (label of mandateLabels(member.id); track label) {
                <span class="badge badge--pinned">{{ label }}</span>
              }
            </div>
          </div>
          <div class="item-list__meta">
            @if (member.functionTitle) { {{ member.functionTitle }} · }
            {{ groupNames(member) || 'bez skupiny' }}
          </div>
        </li>
      }
    </ul>
  `,
  styles: [`.mm__search { flex: 1; min-width: 200px; width: auto; } .mm__filter { width: auto; }`],
})
export class ManageMembersComponent {
  private membersService = inject(MembersService);
  private mandatesService = inject(MandatesService);
  private groupsService = inject(GroupsService);

  readonly query = signal('');
  readonly status = signal<StatusFilter>('active');
  readonly fullName = getFullName;

  readonly rows = computed(() => {
    const q = nicknameKey(this.query());
    return this.membersService
      .members()
      .filter((m) => {
        switch (this.status()) {
          case 'active': return m.isActive && !m.isExternal;
          case 'external': return m.isActive && !!m.isExternal;
          case 'former': return !m.isActive;
          default: return true;
        }
      })
      .filter((m) => !q || nicknameKey(`${m.nickname} ${getFullName(m)} ${m.functionTitle ?? ''}`).includes(q))
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'cs'));
  });

  // Celosouborová a modulová pověření – správu skupin ukazuje detail
  mandateLabels(memberId: number): string[] {
    const kinds = this.mandatesService
      .mandates()
      .filter((m) => m.memberId === memberId && m.kind !== 'group-owner' && m.kind !== 'group-deputy')
      .map((m) => MANDATE_LABELS[m.kind]);
    return [...new Set(kinds)];
  }

  groupNames(member: Member): string {
    return member.groupIds
      .map((id) => this.groupsService.groups().find((g) => g.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }
}
