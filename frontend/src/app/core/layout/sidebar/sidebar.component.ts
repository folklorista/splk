import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Router } from '@angular/router';
import { EventsService } from '../../../features/events/events.service';
import { MembersService } from '../../../features/members/members.service';
import { BoardsService } from '../../../features/boards/boards.service';
import { Group } from '../../models/group.model';
import { getUnconfirmedEventsCount, isAdmin } from '../../utils/visibility.utils';
import { interval, Subscription } from 'rxjs';
import { IconComponent, IconName } from '../../../shared/icon/icon.component';
import { VersionLabelComponent } from '../../../shared/version-label/version-label.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number | string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, VersionLabelComponent],
  templateUrl: './sidebar.component.html',
  styles: [`
    .sidebar__nav-item {
      position: relative;
    }

    .sidebar__badge {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary);
      color: #fff;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      padding: 0 4px;
    }
  `],
})
export class SidebarComponent implements OnInit, OnDestroy {
  private boards = signal<Group[]>([]);
  private boardBadges = signal<Map<number, number>>(new Map());
  private eventsBadge = signal(0);

  // Hlavní část: Přehled – Akce – nástěnky skupin uživatele – Kroje; Správa jen pro admina.
  // Na profil se jde kliknutím na jméno v patičce.
  readonly navSections = computed<NavSection[]>(() => {
    const badge = (count: number | undefined) => (count ? count : undefined);
    const adminItems: NavItem[] = isAdmin(this.auth.currentUser())
      ? [{ path: '/app/admin', label: 'Administrace', icon: 'settings' }]
      : [];

    return [
      {
        items: [
          { path: '/app/dashboard', label: 'Přehled', icon: 'home' },
          { path: '/app/events', label: 'Akce', icon: 'calendar', badge: badge(this.eventsBadge()) },
          ...this.boards().map((b): NavItem => ({
            path: `/app/boards/${b.slug}`,
            label: b.name,
            icon: b.icon ?? 'megaphone',
            badge: badge(this.boardBadges().get(b.id)),
          })),
          { path: '/app/costumes', label: 'Kroje', icon: 'shirt' },
        ],
      },
      ...(adminItems.length ? [{ label: 'Správa', items: adminItems }] : []),
    ];
  });

  private refreshSubscription: Subscription | null = null;

  constructor(
    public auth: AuthService,
    private router: Router,
    private eventsService: EventsService,
    private membersService: MembersService,
    private boardsService: BoardsService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.membersService.getMemberByUserId(user.id).subscribe((member) => {
      if (!member) return;

      const refresh = () => {
        this.boardsService.getMyBoards().subscribe((boards) => this.boards.set(boards));
        this.boardsService.getBoardBadges().subscribe((badges) => this.boardBadges.set(badges));
        this.eventsService.getEvents().subscribe((events) => {
          this.eventsBadge.set(getUnconfirmedEventsCount(events, user, member.id));
        });
      };

      refresh();
      this.refreshSubscription = interval(2000).subscribe(() => refresh());
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
