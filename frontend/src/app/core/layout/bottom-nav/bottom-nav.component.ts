import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { EventsService } from '../../../features/events/events.service';
import { AuthService } from '../../auth/auth.service';
import { MembersService } from '../../../features/members/members.service';
import { BoardsService } from '../../../features/boards/boards.service';
import { getUnconfirmedEventsCount } from '../../utils/visibility.utils';
import { interval, Subscription } from 'rxjs';
import { IconComponent, IconName } from '../../../shared/icon/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number | string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './bottom-nav.component.html',
  styles: [`
    .bottom-nav__item {
      position: relative;
    }

    .bottom-nav__badge {
      position: absolute;
      top: -8px;
      right: 6px;
      min-width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary);
      color: #fff;
      border-radius: 50%;
      font-size: 10px;
      font-weight: 700;
      padding: 0 4px;
    }
  `],
})
export class BottomNavComponent implements OnInit, OnDestroy {
  // Na mobilu není místo na každou nástěnku zvlášť – položka Nástěnky vede na rozcestník
  navItems: NavItem[] = [
    { path: '/app/dashboard', label: 'Přehled', icon: 'home' },
    { path: '/app/events', label: 'Akce', icon: 'calendar' },
    { path: '/app/boards', label: 'Nástěnky', icon: 'megaphone' },
    { path: '/app/profile', label: 'Profil', icon: 'user' },
  ];

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

      const updateBadges = () => {
        this.boardsService.getBoardBadges().subscribe((badges) => {
          const count = [...badges.values()].reduce((sum, c) => sum + c, 0);
          this.setBadge('/app/boards', count);
        });

        this.eventsService.getEvents().subscribe((events) => {
          this.setBadge('/app/events', getUnconfirmedEventsCount(events, user, member.id));
        });
      };

      updateBadges();
      this.refreshSubscription = interval(2000).subscribe(() => updateBadges());
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private setBadge(path: string, count: number): void {
    const item = this.navItems.find((i) => i.path === path);
    if (item) {
      item.badge = count > 0 ? count : undefined;
    }
  }
}
