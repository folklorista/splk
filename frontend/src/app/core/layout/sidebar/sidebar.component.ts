import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Router } from '@angular/router';
import { PostsService } from '../../../features/posts/posts.service';
import { EventsService } from '../../../features/events/events.service';
import { getUnreadPostsCount, getUnconfirmedEventsCount } from '../../utils/visibility.utils';

interface NavItem {
  path: string;
  label: string;
  badge?: number | string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
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
export class SidebarComponent implements OnInit {
  navSections: NavSection[] = [
    {
      label: 'Aplikace',
      items: [
        { path: '/app/dashboard', label: 'Přehled' },
        { path: '/app/posts', label: 'Nástěnka' },
        { path: '/app/events', label: 'Akce' },
        { path: '/app/attendance', label: 'Docházka' },
        { path: '/app/members', label: 'Členové' },
        { path: '/app/costumes', label: 'Krojová databáze' },
      ],
    },
    {
      label: 'Správa',
      items: [
        { path: '/app/admin', label: 'Administrace' },
      ],
    },
  ];

  constructor(
    public auth: AuthService,
    private router: Router,
    private postsService: PostsService,
    private eventsService: EventsService,
  ) {}

  ngOnInit(): void {
    this.postsService.getPosts().subscribe((posts) => {
      const count = getUnreadPostsCount(posts, this.auth.currentUser());
      const postsItem = this.navSections[0].items.find((item) => item.path === '/app/posts');
      if (postsItem) {
        postsItem.badge = count > 0 ? count : undefined;
      }
    });

    this.eventsService.getEvents().subscribe((events) => {
      const count = getUnconfirmedEventsCount(events, this.auth.currentUser());
      const eventsItem = this.navSections[0].items.find((item) => item.path === '/app/events');
      if (eventsItem) {
        eventsItem.badge = count > 0 ? count : undefined;
      }
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
