import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
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
import { CostumesService } from '../costumes/costumes.service';
import { AccessService } from '../../core/access/access.service';
import { canReadGroupContent, isEventAudience } from '../../core/access/access.utils';
import { GroupsService } from '../groups/groups.service';
import { JoinRequestsService } from '../groups/join-requests.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActualAttendanceService } from '../attendance/actual-attendance.service';
import { PendingAction, attendanceRecordActions, costumeActions, eventChangeActions, eventResponseActions, groupRequestActions, sortPendingActions } from './pending-actions';

// Kolik nejbližších akcí se na přehledu zobrazí s rychlým potvrzením účasti
export const DASHBOARD_EVENT_LIMIT = 5;

export interface UpcomingEventRow {
  event: AppEvent;
  status: AttendanceStatus;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, EventRsvpRowComponent],
  templateUrl: './dashboard.component.html',
  styles: [`
    .pending { margin-bottom: var(--spacing-lg); border-left: 4px solid var(--color-primary); background: var(--color-surface-alt); border-radius: 8px; padding: var(--spacing-sm) var(--spacing-md); }
    .pending__title { font-size: var(--font-size-sm); font-weight: 700; margin: 0 0 var(--spacing-xs); }
    .pending__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .pending__item { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); flex-wrap: wrap; padding: 6px 0; border-top: 1px solid var(--color-border); }
    .pending__item:first-child { border-top: none; }
    .pending__link { display: flex; flex-direction: column; color: var(--color-text); text-decoration: none; min-width: 0; flex: 1 1 200px; }
    .pending__link:hover .pending__text { color: var(--color-primary); }
    .pending__detail { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .pending__actions { display: flex; gap: 6px; }
  `],
})
export class DashboardComponent implements OnInit {
  upcomingEvents = signal<UpcomingEventRow[]>([]);
  pinnedPosts = signal<Post[] | null>(null);
  loading = signal(true);
  currentMemberId = signal<number | null>(null);

  private destroyRef = inject(DestroyRef);
  private requests = inject(JoinRequestsService);
  private allEvents = signal<AppEvent[]>([]);
  private costumeState = toSignal(inject(CostumesService).state$);
  private actualAttendance = toSignal(inject(ActualAttendanceService).records$, { initialValue: [] });

  // „Čeká na vás“: povinnosti napříč moduly, nejdřív to, co hoří (docs/10 kap. 7.2)
  readonly pendingActions = computed<PendingAction[]>(() => {
    const member = this.access.currentMember();
    const subject = this.access.subject();
    if (!member) return [];
    const modules = this.access.modules();
    const state = this.costumeState();
    return sortPendingActions([
      ...(modules.events ? eventChangeActions(this.allEvents(), member) : []),
      ...(modules.events ? eventResponseActions(this.allEvents(), member) : []),
      ...groupRequestActions(this.requests.requests(), subject, this.groupsService.groups()),
      ...(modules.costumes && state ? costumeActions(state, member.id) : []),
      ...(modules.events ? attendanceRecordActions(this.allEvents(), this.actualAttendance(), subject) : []),
    ]);
  });

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
    private access: AccessService,
    private groupsService: GroupsService,
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

      this.postsService.getPosts().subscribe((posts) => {
        this.pinnedPosts.set(
          posts
            .filter((p) => !p.archivedAt && !p.hiddenAt && member.groupIds.includes(p.groupId))
            .filter((p) => {
              const group = this.groupsService.findGroup(p.groupId);
              return !!group && canReadGroupContent(this.access.subject(), group);
            })
            .filter((p) => p.isPinned)
            .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
        );
        postsLoaded = true;
        done();
      });

      // Stream akcí obsahuje i účast, takže se po rychlém potvrzení řádky samy aktualizují
      this.eventsService.getEvents().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((events) => {
        this.allEvents.set(events);
        const now = new Date();
        this.upcomingEvents.set(
          events
            .filter((e) => isEventAudience(member, e))
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
