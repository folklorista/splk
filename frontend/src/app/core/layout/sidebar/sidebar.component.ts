import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Router } from '@angular/router';
import { PostsService } from '../../../features/posts/posts.service';
import { EventsService } from '../../../features/events/events.service';
import { CommentsService } from '../../../features/posts/comments.service';
import { MembersService } from '../../../features/members/members.service';
import { getUnreadPostsCount, getUnconfirmedEventsCount, getUnseenMentionsCount } from '../../utils/visibility.utils';
import { interval, Subscription } from 'rxjs';
import { IconComponent, IconName } from '../../../shared/icon/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number | string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
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
  navSections: NavSection[] = [
    {
      label: 'Aplikace',
      items: [
        { path: '/app/dashboard', label: 'Přehled', icon: 'home' },
        { path: '/app/posts', label: 'Nástěnka', icon: 'megaphone' },
        { path: '/app/events', label: 'Akce', icon: 'calendar' },
        { path: '/app/members', label: 'Členové', icon: 'users' },
        { path: '/app/costumes', label: 'Krojová databáze', icon: 'shirt' },
        { path: '/app/profile', label: 'Můj profil', icon: 'user' },
      ],
    },
    {
      label: 'Správa',
      items: [
        { path: '/app/admin', label: 'Administrace', icon: 'settings' },
      ],
    },
  ];

  private refreshSubscription: Subscription | null = null;

  constructor(
    public auth: AuthService,
    private router: Router,
    private postsService: PostsService,
    private eventsService: EventsService,
    private commentsService: CommentsService,
    private membersService: MembersService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.membersService.getMembers().subscribe((members) => {
      const member = members.find((m) => m.email === user.email);
      if (!member) return;

      const updateBadges = () => {
        this.postsService.getPosts().subscribe((posts) => {
          this.commentsService.getAllComments().subscribe((comments) => {
            const count = getUnreadPostsCount(posts, user, member.id) + getUnseenMentionsCount(comments, member.id);
            const postsItem = this.navSections[0].items.find((item) => item.path === '/app/posts');
            if (postsItem) {
              postsItem.badge = count > 0 ? count : undefined;
            }
          });
        });

        this.eventsService.getEvents().subscribe((events) => {
          const count = getUnconfirmedEventsCount(events, user, member.id);
          const eventsItem = this.navSections[0].items.find((item) => item.path === '/app/events');
          if (eventsItem) {
            eventsItem.badge = count > 0 ? count : undefined;
          }
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

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
