import { Injectable, computed, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { AccessService } from '../access/access.service';
import { IconName } from '../../shared/icon/icon.component';
import { BoardsService } from '../../features/boards/boards.service';
import { EventsService } from '../../features/events/events.service';
import { getUnconfirmedEventsCount, hasBoard, hasChat } from '../utils/visibility.utils';
import { JoinRequestsService } from '../../features/groups/join-requests.service';
import { isGroupManager } from '../access/access.utils';
import { isPendingJoinRequest } from '../../features/groups/models/join-request.model';
import { ChatService } from '../../features/chat/chat.service';
import { GroupNotificationsService } from '../notifications/group-notifications.service';
import { unreadChatCount } from '../../features/chat/utils/chat-timeline';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

const BADGE_REFRESH_MS = 2000;

// Menu podle skutečných přístupů a zapnutých modulů (docs/08 kap. 4) – společné pro sidebar i spodní lištu.
// Skupiny jen ty, kde je uživatel členem; Správa jen se pověřením Správa souboru.
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private eventsBadge = signal(0);
  private groupBadges = signal<Map<number, number>>(new Map());
  private users = 0;
  private refresh?: Subscription;

  constructor(
    private access: AccessService,
    private boardsService: BoardsService,
    private eventsService: EventsService,
    private requestsService: JoinRequestsService,
    private chat: ChatService,
    private notify: GroupNotificationsService,
  ) {}

  // Badge skupiny = nepřečtené příspěvky + neviděné zmínky (nástěnka) + nepřečtené zprávy chatu.
  // Aktivita komentářů v chatu se nezapočítává znovu (je už v nástěnce).
  private chatBadge(groupId: number): number {
    const member = this.access.currentMember();
    // Ztlumený chat do badge nepočítáme (zprávy jsou dál vidět v záložce Chat)
    if (!member || this.notify.modeFor(member.id, groupId) === 'muted') return 0;
    return unreadChatCount(this.chat.messages(), groupId, member.id, this.chat.lastReadAt(groupId, member.id), member.groupJoinedAt?.[groupId]);
  }

  // Co čeká na mě: žádosti a návrhy ve skupinách, které spravuji, a pozvánky pro mě
  readonly pendingRequests = computed(() => {
    const s = this.access.subject();
    if (!s) return 0;
    return this.requestsService
      .requests()
      .filter(isPendingJoinRequest)
      .filter((r) => (r.status === 'awaiting-manager' ? isGroupManager(s, r.groupId) : r.memberId === s.memberId)).length;
  });

  readonly groupItems = computed<NavItem[]>(() =>
    this.access
      .myGroups()
      .filter((g) => hasBoard(g) || hasChat(g))
      .map((g) => ({ path: `/app/boards/${g.slug}`, label: g.name, icon: g.icon ?? 'megaphone', badge: (this.groupBadges().get(g.id) ?? 0) + (hasChat(g) ? this.chatBadge(g.id) : 0) || undefined })),
  );

  readonly mainItems = computed<NavItem[]>(() => {
    const modules = this.access.modules();
    return [
      { path: '/app/dashboard', label: 'Přehled', icon: 'home' },
      ...(modules.events ? [{ path: '/app/events', label: 'Akce', icon: 'calendar' as IconName, badge: this.eventsBadge() || undefined }] : []),
      ...(modules.events && this.access.canViewAttendanceReport() ? [{ path: '/app/attendance', label: 'Docházka', icon: 'clipboard-check' as IconName }] : []),
    ];
  });

  readonly moduleItems = computed<NavItem[]>(() =>
    this.access.modules().costumes
      ? [
          { path: '/app/costumes', label: 'Moje kroje', icon: 'shirt' },
          ...(this.access.canViewCostumeStock() ? [{ path: '/app/wardrobe', label: 'Správa krojů', icon: 'clipboard-check' as IconName }] : []),
        ]
      : [],
  );

  readonly groupsHub = computed<NavItem>(() => ({ path: '/app/boards', label: 'Skupiny', icon: 'users', badge: this.pendingRequests() || undefined }));

  readonly manageItems = computed<NavItem[]>(() =>
    this.access.isEnsembleAdmin() ? [{ path: '/app/manage', label: 'Správa', icon: 'settings' }] : [],
  );

  readonly sections = computed<NavSection[]>(() => [
    { items: [...this.mainItems(), ...this.groupItems(), ...this.moduleItems()] },
    { label: 'Soubor', items: [this.groupsHub(), { path: '/app/search', label: 'Hledat', icon: 'search' }, ...this.manageItems()] },
  ]);

  // Lišta na mobilu: Přehled, Akce, skupiny, rozcestník skupin, Správa (posouvá se do strany)
  readonly bottomItems = computed<NavItem[]>(() => [
    ...this.mainItems().filter((i) => i.path !== '/app/attendance'),
    ...this.groupItems(),
    this.groupsHub(),
    ...this.manageItems(),
  ]);

  // Počítání badge běží, dokud je zobrazená aspoň jedna navigace
  start(): void {
    if (this.users++ > 0) return;
    const update = () => {
      this.boardsService.getBoardBadges().subscribe((badges) => this.groupBadges.set(badges));
      this.eventsService.getEvents().subscribe((events) => this.eventsBadge.set(getUnconfirmedEventsCount(events, this.access.subject())));
    };
    update();
    this.refresh = interval(BADGE_REFRESH_MS).subscribe(update);
  }

  stop(): void {
    if (--this.users > 0) return;
    this.users = 0;
    this.refresh?.unsubscribe();
  }
}
