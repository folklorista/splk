import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { AccessService } from '../../../core/access/access.service';
import { canEditGroupCommunication, canManageGroupMembership, canReadGroupContent, isGroupMember } from '../../../core/access/access.utils';
import { GroupsService } from '../groups.service';
import { PostsComponent } from '../../posts/posts.component';
import { GroupMembersComponent } from './group-members.component';
import { GroupAdminPanelComponent } from '../group-admin/group-admin-panel.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { GroupSpaceTab, groupTabs, resolveGroupTab } from './group-tabs';
import { GroupChatComponent } from '../../chat/group-chat/group-chat.component';
import { ChatService } from '../../chat/chat.service';
import { unreadChatCount } from '../../chat/utils/chat-timeline';
import { GroupNotificationsService } from '../../../core/notifications/group-notifications.service';
import { GROUP_NOTIFY_LABELS, GroupNotifyMode } from '../../../core/notifications/group-notifications';

const TAB_LABELS: Record<GroupSpaceTab, string> = {
  chat: 'Chat',
  board: 'Nástěnka',
  members: 'Členové',
  manage: 'Správa',
};

// Prostor skupiny (/app/boards/:slug): Chat, Nástěnka, Členové a Správa skupiny (jen správcům).
// Výchozí záložku určuje nastavení skupiny; záložka je v URL (?tab=), aby šla sdílet a vrátit se na ni.
@Component({
  selector: 'app-group-space',
  standalone: true,
  imports: [RouterLink, GroupChatComponent, PostsComponent, GroupMembersComponent, GroupAdminPanelComponent, IconComponent],
  template: `
    <div class="page">
      @if (group(); as g) {
        <div class="page__header group-space__header">
          <h1 class="page__title">
            @if (g.icon) { <app-icon [name]="g.icon" [size]="20" /> }
            {{ g.name }}
          </h1>
          @if (!isMember()) {
            <span class="badge">Otevřená skupina – jen čtení</span>
          } @else {
            <label class="group-space__notify">
              <select [value]="notifyMode()" (change)="setNotifyMode($any($event.target).value)" aria-label="Upozornění ze skupiny">
                @for (option of notifyOptions; track option[0]) {
                  <option [value]="option[0]" [selected]="notifyMode() === option[0]">🔔 {{ option[1] }}</option>
                }
              </select>
            </label>
          }
        </div>
        @if (g.description) {
          <p class="group-space__description">{{ g.description }}</p>
        }

        <nav class="group-tabs" aria-label="Části skupiny">
          @for (t of tabs(); track t) {
            <a class="group-tabs__link" [class.group-tabs__link--active]="tab() === t" [routerLink]="[]" [queryParams]="{ tab: t }" [attr.aria-current]="tab() === t ? 'page' : null">
              {{ label(t) }}
              @if (t === 'chat' && tab() !== 'chat' && unreadChat()) {
                <span class="group-tabs__badge">{{ unreadChat() }}</span>
              }
            </a>
          }
        </nav>

        @switch (tab()) {
          @case ('chat') { <app-group-chat [group]="g" /> }
          @case ('board') { <app-posts [board]="g" /> }
          @case ('members') { <app-group-members [group]="g" /> }
          @case ('manage') { <app-group-admin-panel [groupId]="g.id" /> }
        }
      } @else {
        <p class="state-note">Skupina nebyla nalezena nebo do ní nemáte přístup.</p>
        <a class="back-link" routerLink="/app/boards">← Skupiny</a>
      }
    </div>
  `,
  styles: [`
    .group-space__header { margin-bottom: 0; }
    .group-space__header .page__title { display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
    .group-space__description { color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--spacing-sm); }
    .group-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); margin-bottom: var(--spacing-md); overflow-x: auto; }
    .group-tabs__link { padding: 8px 12px; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-muted); border-bottom: 2px solid transparent; white-space: nowrap; }
    .group-tabs__link:hover { color: var(--color-text); }
    .group-tabs__link--active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
    .group-space__notify select { padding: 4px 6px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-sm); }
    .group-tabs__badge { margin-left: 4px; min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-primary); color: #fff; font-size: 11px; display: inline-block; text-align: center; }
  `],
})
export class GroupSpaceComponent {
  private route = inject(ActivatedRoute);
  private access = inject(AccessService);
  private groupsService = inject(GroupsService);

  private slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), { initialValue: '' });
  private requestedTab = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('tab'))), { initialValue: null });

  // Obsah skupiny jen pro ty, kdo ho smí číst (i při přímé URL)
  readonly group = computed(() => {
    const group = this.groupsService.groups().find((g) => g.slug === this.slug());
    return group && canReadGroupContent(this.access.subject(), group) ? group : undefined;
  });

  readonly isMember = computed(() => !!this.group() && isGroupMember(this.access.subject(), this.group()!.id));
  private canManage = computed(() => {
    const g = this.group();
    return !!g && (canManageGroupMembership(this.access.subject(), g.id) || canEditGroupCommunication(this.access.subject(), g.id));
  });

  readonly tabs = computed(() => (this.group() ? groupTabs(this.group()!, this.canManage()) : []));
  readonly tab = computed(() => (this.group() ? resolveGroupTab(this.requestedTab(), this.group()!, this.canManage()) : 'members'));

  private chat = inject(ChatService);
  private notify = inject(GroupNotificationsService);
  readonly notifyOptions = Object.entries(GROUP_NOTIFY_LABELS) as [GroupNotifyMode, string][];
  readonly notifyMode = computed(() => this.notify.modeFor(this.access.memberId(), this.group()?.id ?? 0));

  setNotifyMode(mode: GroupNotifyMode): void {
    const memberId = this.access.memberId();
    const g = this.group();
    if (memberId && g) this.notify.setMode(memberId, g.id, mode);
  }

  // Nepřečtené zprávy chatu – jen běžné zprávy (aktivitu příspěvků ukazuje nástěnka)
  readonly unreadChat = computed(() => {
    const g = this.group();
    const memberId = this.access.memberId();
    if (!g || !memberId) return 0;
    return unreadChatCount(this.chat.messages(), g.id, memberId, this.chat.lastReadAt(g.id), this.access.currentMember()?.groupJoinedAt?.[g.id]);
  });

  label(tab: GroupSpaceTab): string {
    return TAB_LABELS[tab];
  }
}
