import { Component, OnInit, signal } from '@angular/core';
import { AppEvent } from '../events/models/event.model';
import { Post } from '../posts/models/post.model';
import { AttendanceStatus } from '../attendance/models/attendance.model';
import { EventsService } from '../events/events.service';
import { PostsService } from '../posts/posts.service';
import { AttendanceService } from '../attendance/attendance.service';
import { MembersService } from '../members/members.service';
import { AuthService } from '../../core/auth/auth.service';
import { RouterLink } from '@angular/router';
import { EventRsvpRowComponent } from '../events/event-rsvp-row/event-rsvp-row.component';
import { MyCostumesComponent } from '../costumes/my-costumes/my-costumes.component';
import { CostumesService } from '../costumes/costumes.service';
import { myCostumeRows } from '../costumes/utils/costume-logic';
import { canAccessBoard, isAdmin, isItemVisibleToUser } from '../../core/utils/visibility.utils';

// Kolik nejbližších akcí se na přehledu zobrazí s rychlým potvrzením účasti
export const DASHBOARD_EVENT_LIMIT = 5;

export interface UpcomingEventRow {
  event: AppEvent;
  status: AttendanceStatus;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, EventRsvpRowComponent, MyCostumesComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  upcomingEvents = signal<UpcomingEventRow[]>([]);
  pinnedPosts = signal<Post[] | null>(null);
  loading = signal(true);
  currentMemberId = signal<number | null>(null);
  // Sekce „Moje kroje“ se ukáže jen tomu, kdo má něco svěřeno
  hasCostumes = signal(false);

  isUnread = (post: Post): boolean => {
    const memberId = this.currentMemberId();
    return memberId ? !post.readers || !post.readers.includes(memberId) : false;
  };

  constructor(
    private auth: AuthService,
    private eventsService: EventsService,
    private postsService: PostsService,
    private attendanceService: AttendanceService,
    private membersService: MembersService,
    private costumesService: CostumesService,
  ) { }

  ngOnInit(): void {
    let postsLoaded = false;
    let eventsLoaded = false;
    const done = () => { if (postsLoaded && eventsLoaded) this.loading.set(false); };

    const user = this.auth.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
      const member = members.find((m) => m.userId === user.id);
      if (!member) {
        this.loading.set(false);
        return;
      }
      this.currentMemberId.set(member.id);
      this.costumesService.getState().subscribe((state) => this.hasCostumes.set(myCostumeRows(state, member.id).length > 0));

      this.postsService.getPosts().subscribe((posts) => {
        this.pinnedPosts.set(
          posts
            .filter((p) => !p.archivedAt && canAccessBoard(p.groupId, member.groupIds, isAdmin(user)))
            .filter((p) => p.isPinned)
            .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
        );
        postsLoaded = true;
        done();
      });

      // Stream akcí obsahuje i účast, takže se po rychlém potvrzení řádky samy aktualizují
      this.eventsService.getEvents().subscribe((events) => {
        const now = new Date();
        this.upcomingEvents.set(
          events
            .filter((e) => isItemVisibleToUser(e.targetGroupIds, user.groupIds))
            .filter((e) => new Date(e.startsAt) >= now)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            .slice(0, DASHBOARD_EVENT_LIMIT)
            .map((event) => ({
              event,
              status: event.attendance?.find((r) => r.memberId === member.id)?.status ?? 'pending',
            })),
        );
        eventsLoaded = true;
        done();
      });
    });
  }

  setStatus(eventId: number, status: AttendanceStatus): void {
    const memberId = this.currentMemberId();
    if (!memberId) return;
    this.upcomingEvents.update((rows) => rows.map((row) => (row.event.id === eventId ? { ...row, status } : row)));
    this.attendanceService.setStatus(eventId, memberId, status).subscribe();
  }
}
