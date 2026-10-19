import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { AccessService } from '../access/access.service';
import { IconName } from '../../shared/icon/icon.component';
import { isGroupArchived } from '../models/group.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { CostumesService } from '../../features/costumes/costumes.service';
import { myCostumeRows } from '../../features/costumes/utils/costume-logic';
import { SettingsService } from '../settings/settings.service';
import { GROUPS_HUB_KEY, Place, orderPlaces, resolveBar, sumBadges } from './bottom-bar';
import { SidebarSectionKey, resolveSidebar } from './sidebar-menu';
import { BoardsService } from '../../features/boards/boards.service';
import { EventsService } from '../../features/events/events.service';
import { getUnconfirmedEventsCount, hasBoard, hasChat } from '../utils/visibility.utils';
import { JoinRequestsService } from '../../features/groups/join-requests.service';
import { isGroupManager } from '../access/access.utils';
import { isPendingJoinRequest } from '../../features/groups/models/join-request.model';
import { ChatService } from '../../features/chat/chat.service';
import { GroupNotificationsService } from '../notifications/group-notifications.service';
import { isChatSilenced } from '../notifications/group-notifications';
import { unreadChatCount } from '../../features/chat/utils/chat-timeline';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export interface NavSection {
  key: SidebarSectionKey;
  label?: string;
  items: NavItem[];
  // Položky schované uživatelem – v sidebaru pod „Další“
  hidden: NavItem[];
}

const BADGE_REFRESH_MS = 2000;

// Menu podle skutečných přístupů a zapnutých modulů (docs/08 kap. 4, docs/10 kap. 6) – společné pro sidebar,
// spodní lištu, stránku Více a „Moje místa“. Skupiny jen ty, kde je uživatel členem; agendy jen s pověřením.
import { chatVisibility } from '../../features/chat/utils/chat-history';
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private eventsBadge = signal(0);
  private groupBadges = signal<Map<number, number>>(new Map());
  private users = 0;
  private refresh?: Subscription;
  private eventsSubscription?: Subscription;

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
    if (!member || isChatSilenced(this.notify.modeFor(member.id, groupId))) return 0;
    const group = this.access.myGroups().find((g) => g.id === groupId);
    return unreadChatCount(this.chat.messages(), groupId, member.id, this.chat.lastReadAt(groupId, member.id), group ? chatVisibility(group, member) : undefined);
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

  // Jediný zdroj počtů nepřečteného ve skupinách: nástěnka (nepřečtené příspěvky + zmínky) a chat.
  // Záložky skupiny, seznam skupin, položka skupiny v menu i badge „Skupiny“ z něj počítají stejně.
  readonly groupBadgeParts = computed(() => {
    const parts = new Map<number, { board: number; chat: number }>();
    for (const g of this.access.myGroups().filter((x) => !isGroupArchived(x))) {
      parts.set(g.id, { board: hasBoard(g) ? (this.groupBadges().get(g.id) ?? 0) : 0, chat: hasChat(g) ? this.chatBadge(g.id) : 0 });
    }
    return parts;
  });

  groupBadge(groupId: number): number {
    const part = this.groupBadgeParts().get(groupId);
    return part ? part.board + part.chat : 0;
  }

  // Badge „Skupiny“ = součet všech skupin + žádosti a pozvánky (v rozcestníku má každá položka své číslo)
  readonly groupsHubBadge = computed(() => this.pendingRequests() + [...this.groupBadgeParts().values()].reduce((sum, p) => sum + p.board + p.chat, 0));

  readonly groupItems = computed<NavItem[]>(() =>
    this.access
      .myGroups()
      .filter((g) => (hasBoard(g) || hasChat(g)) && !isGroupArchived(g))
      .map((g) => ({ path: `/app/boards/${g.slug}`, label: g.name, icon: g.icon ?? 'megaphone', badge: this.groupBadge(g.id) || undefined })),
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
          ...(this.access.canViewCostumeStock() ? [{ path: '/app/wardrobe', label: 'Správa krojů', icon: 'hanger' as IconName }] : []),
        ]
      : [],
  );

  readonly groupsHub = computed<NavItem>(() => ({ path: '/app/boards', label: 'Skupiny', icon: 'users', badge: this.groupsHubBadge() || undefined }));

  readonly manageItems = computed<NavItem[]>(() =>
    this.access.isEnsembleAdmin() ? [{ path: '/app/manage', label: 'Správa', icon: 'settings' }] : [],
  );

  // --- Osobní spodní lišta a pořadí míst (docs/10 kap. 6) ---

  private settings = inject(SettingsService);
  private costumeState = toSignal(inject(CostumesService).state$);
  // Moje kroje navrhujeme do lišty jen tomu, kdo má něco zapůjčeno
  private hasCostumeLoan = computed(() => {
    const state = this.costumeState();
    const memberId = this.access.memberId();
    return !!state && !!memberId && myCostumeRows(state, memberId).length > 0;
  });

  // Všechna místa, kam smí přihlášený vstoupit (kromě Přehledu) – nabídka pro lištu, sidebar a „Moje místa“
  readonly places = computed<Place[]>(() => {
    const modules = this.access.modules();
    const groups = this.access.myGroups().filter((g) => (hasBoard(g) || hasChat(g)) && !isGroupArchived(g));
    return [
      ...(modules.events ? [{ key: 'events', path: '/app/events', label: 'Akce', icon: 'calendar' as IconName, badge: this.eventsBadge() || undefined, category: 'main' as const }] : []),
      ...groups.map((g): Place => ({
        key: `group-${g.id}`,
        path: `/app/boards/${g.slug}`,
        label: g.name,
        icon: g.icon ?? 'megaphone',
        badge: this.groupBadge(g.id) || undefined,
        category: 'group',
      })),
      { key: GROUPS_HUB_KEY, path: '/app/boards', label: 'Skupiny', icon: 'users', badge: this.groupsHubBadge() || undefined, category: 'hub' },
      ...(modules.events && this.access.canViewAttendanceReport() ? [{ key: 'attendance', path: '/app/attendance', label: 'Docházka', icon: 'clipboard-check' as IconName, category: 'agenda' as const, writes: true }] : []),
      ...(modules.costumes ? [{ key: 'costumes', path: '/app/costumes', label: 'Moje kroje', icon: 'shirt' as IconName, category: 'costumes' as const, suggest: this.hasCostumeLoan() }] : []),
      ...(modules.costumes && this.access.canViewCostumeStock() ? [{ key: 'wardrobe', path: '/app/wardrobe', label: 'Správa krojů', icon: 'hanger' as IconName, category: 'agenda' as const, writes: this.access.canManageCostumes() }] : []),
      ...(this.access.isEnsembleAdmin() ? [{ key: 'manage', path: '/app/manage', label: 'Správa', icon: 'settings' as IconName, category: 'agenda' as const }] : []),
      { key: 'search', path: '/app/search', label: 'Hledat', icon: 'search', category: 'tool' },
    ];
  });

  private chosenBar = computed(() => this.settings.settings().bottomBar ?? null);

  readonly resolvedBar = computed(() => resolveBar(this.places(), this.chosenBar()));

  // Místa v pořadí lišty a pak ostatní (sidebar, „Moje místa“ na Přehledu)
  readonly orderedPlaces = computed(() => orderPlaces(this.places(), this.chosenBar()));

  // Sidebar (desktop): Přehled + Akce, Moje skupiny, Agendy, Soubor. Vlastní pořadí a skrytí jen ve skupinách
  // a agendách, nezávisle na spodní liště. Prázdné sekce se nezobrazují.
  readonly sections = computed<NavSection[]>(() => {
    const dashboard: NavItem = { path: '/app/dashboard', label: 'Přehled', icon: 'home' };
    return resolveSidebar(this.places(), this.settings.settings().sidebarMenu)
      .map((s) => (s.key === 'main' ? { ...s, items: [dashboard, ...s.items] } : s))
      .filter((s) => s.items.length || s.hidden.length);
  });

  // Lišta na mobilu: Přehled + osobní výběr (nejvýš 4 pozice), přetečení pod „Více“. Neposouvá se.
  readonly bottomItems = computed<NavItem[]>(() => {
    const { bar, overflow } = this.resolvedBar();
    return [
      { path: '/app/dashboard', label: 'Přehled', icon: 'home' },
      ...bar,
      ...(overflow.length ? [{ path: '/app/more', label: 'Více', icon: 'menu' as IconName, badge: sumBadges(overflow) || undefined }] : []),
    ];
  });

  // Počítání badge běží, dokud je zobrazená aspoň jedna navigace
  // Akce jsou živý proud (akce + účast) – stačí jeden odběr po celou dobu zobrazení navigace.
  // Nástěnky se dopočítávají periodicky (jednorázový dotaz, který vždy skončí).
  start(): void {
    if (this.users++ > 0) return;
    this.eventsSubscription = this.eventsService.getEvents().subscribe((events) => this.eventsBadge.set(getUnconfirmedEventsCount(events, this.access.subject())));
    const update = () => this.boardsService.getBoardBadges().subscribe((badges) => this.groupBadges.set(badges));
    update();
    this.refresh = interval(BADGE_REFRESH_MS).subscribe(update);
  }

  stop(): void {
    if (--this.users > 0) return;
    this.users = 0;
    this.refresh?.unsubscribe();
    this.eventsSubscription?.unsubscribe();
  }
}
