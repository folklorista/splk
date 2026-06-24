import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PostsService } from '../../../features/posts/posts.service';
import { EventsService } from '../../../features/events/events.service';
import { AuthService } from '../../auth/auth.service';
import { getUnreadPostsCount, getUnconfirmedEventsCount } from '../../utils/visibility.utils';

interface NavItem {
  path: string;
  label: string;
  badge?: number | string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
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
export class BottomNavComponent implements OnInit {
  navItems: NavItem[] = [
    { path: '/app/dashboard', label: 'Přehled' },
    { path: '/app/posts', label: 'Nástěnka' },
    { path: '/app/events', label: 'Akce' },
    { path: '/app/members', label: 'Členové' },
    { path: '/app/profile', label: 'Profil' },
  ];

  constructor(
    private postsService: PostsService,
    private eventsService: EventsService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.postsService.getPosts().subscribe((posts) => {
      const count = getUnreadPostsCount(posts, this.auth.currentUser());
      const postsItem = this.navItems.find((item) => item.path === '/app/posts');
      if (postsItem) {
        postsItem.badge = count > 0 ? count : undefined;
      }
    });

    this.eventsService.getEvents().subscribe((events) => {
      const count = getUnconfirmedEventsCount(events, this.auth.currentUser());
      const eventsItem = this.navItems.find((item) => item.path === '/app/events');
      if (eventsItem) {
        eventsItem.badge = count > 0 ? count : undefined;
      }
    });
  }
}
