import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { EventsService } from '../../../features/events/events.service';
import { AuthService } from '../../auth/auth.service';
import { MembersService } from '../../../features/members/members.service';
import { BoardsService } from '../../../features/boards/boards.service';
import { Group } from '../../models/group.model';
import { getUnconfirmedEventsCount, isAdmin } from '../../utils/visibility.utils';
import { interval, Subscription } from 'rxjs';
import { IconComponent, IconName } from '../../../shared/icon/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent implements OnInit, OnDestroy {
  private boards = signal<Group[]>([]);
  private boardBadges = signal<Map<number, number>>(new Map());
  private eventsBadge = signal(0);

  // Přehled – Akce – nástěnky, kde je přihlášený členem – (Administrace pro admina).
  // Když se položky nevejdou, lišta se dá posouvat prstem do strany.
  readonly navItems = computed<NavItem[]>(() => {
    const badge = (count: number | undefined) => (count ? count : undefined);
    return [
      { path: '/app/dashboard', label: 'Přehled', icon: 'home' },
      { path: '/app/events', label: 'Akce', icon: 'calendar', badge: badge(this.eventsBadge()) },
      ...this.boards().map((b): NavItem => ({
        path: `/app/boards/${b.slug}`,
        label: b.name,
        icon: b.icon ?? 'megaphone',
        badge: badge(this.boardBadges().get(b.id)),
      })),
      ...(isAdmin(this.auth.currentUser()) ? [{ path: '/app/admin', label: 'Administrace', icon: 'settings' as IconName }] : []),
    ];
  });

  private refreshSubscription: Subscription | null = null;

  constructor(
    private eventsService: EventsService,
    private auth: AuthService,
    private membersService: MembersService,
    private boardsService: BoardsService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.membersService.getMemberByUserId(user.id).subscribe((member) => {
      if (!member) return;

      const refresh = () => {
        // Administrátor vidí všechny nástěnky, v liště má ale jen ty, kde je členem (ostatní v rozcestníku)
        this.boardsService
          .getMyBoards()
          .subscribe((boards) => this.boards.set(boards.filter((b) => member.groupIds.includes(b.id))));
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
    this.refreshSubscription?.unsubscribe();
  }
}
