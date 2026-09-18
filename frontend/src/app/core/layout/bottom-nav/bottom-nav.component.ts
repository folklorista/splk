import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PostsService } from '../../../features/posts/posts.service';
import { EventsService } from '../../../features/events/events.service';
import { CommentsService } from '../../../features/posts/comments.service';
import { AuthService } from '../../auth/auth.service';
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
  navItems: NavItem[] = [
    { path: '/app/dashboard', label: 'Přehled', icon: 'home' },
    { path: '/app/posts', label: 'Nástěnka', icon: 'megaphone' },
    { path: '/app/events', label: 'Akce', icon: 'calendar' },
    { path: '/app/members', label: 'Členové', icon: 'users' },
    { path: '/app/profile', label: 'Profil', icon: 'user' },
  ];

  currentMemberId = signal<number | null>(null);
  private refreshSubscription: Subscription | null = null;

  constructor(
    private postsService: PostsService,
    private eventsService: EventsService,
    private commentsService: CommentsService,
    private auth: AuthService,
    private membersService: MembersService
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.membersService.getMembers().subscribe((members) => {
      const member = members.find((m) => m.email === user.email);
      if (member) {
        this.currentMemberId.set(member.id);

        const updateBadges = () => {
          this.postsService.getPosts().subscribe((posts) => {
            this.commentsService.getAllComments().subscribe((comments) => {
              const count = getUnreadPostsCount(posts, user, member.id) + getUnseenMentionsCount(comments, member.id);
              const postsItem = this.navItems.find((item) => item.path === '/app/posts');
              if (postsItem) {
                postsItem.badge = count > 0 ? count : undefined;
              }
            });
          });

          this.eventsService.getEvents().subscribe((events) => {
            const count = getUnconfirmedEventsCount(events, user, member.id);
            const eventsItem = this.navItems.find((item) => item.path === '/app/events');
            if (eventsItem) {
              eventsItem.badge = count > 0 ? count : undefined;
            }
          });
        };

        updateBadges();
        this.refreshSubscription = interval(2000).subscribe(() => updateBadges());
      }
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }
}
