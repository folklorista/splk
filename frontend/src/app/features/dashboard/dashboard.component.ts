import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AppEvent } from '../events/models/event.model';
import { Post } from '../posts/models/post.model';
import { AttendanceRecord } from '../attendance/models/attendance.model';
import { EventsService } from '../events/events.service';
import { PostsService } from '../posts/posts.service';
import { AttendanceService } from '../attendance/attendance.service';
import { MembersService } from '../members/members.service';
import { AuthService } from '../../core/auth/auth.service';
import { RouterLink } from '@angular/router';

// Temporary mock binding – will be replaced with auth→member mapping in a later phase
const CURRENT_MEMBER_ID = 1;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  nextEvent = signal<AppEvent | null>(null);
  pinnedPosts = signal<Post[] | null>(null);
  pendingAttendance = signal<{ event: AppEvent; record: AttendanceRecord }[]>([]);
  loading = signal(true);
  currentMemberId = signal<number | null>(null);

  isUnread = (post: Post): boolean => {
    const memberId = this.currentMemberId();
    return memberId ? !post.readers || !post.readers.includes(memberId) : false;
  };

  constructor(
    private auth: AuthService,
    private eventsService: EventsService,
    private postsService: PostsService,
    private attendanceService: AttendanceService,
    private membersService: MembersService
  ) { }

  ngOnInit(): void {
    const now = new Date().toISOString();
    let loaded = 0;
    const done = () => { if (++loaded === 3) this.loading.set(false); };

    const user = this.auth.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
      const member = members.find((m) => m.email === user.email);
      if (member) {
        this.currentMemberId.set(member.id);
      }

      this.postsService.getPosts().subscribe((posts) => {
        this.pinnedPosts.set(posts.filter((p) => p.isPinned).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
        done();
      });

    });

    this.eventsService.getEvents().subscribe((events) => {
      const upcoming = events
        .filter((e) => e.startsAt >= now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      this.nextEvent.set(upcoming[0] ?? null);
      done();
    });

    this.postsService.getPosts().subscribe((posts) => {
      this.pinnedPosts.set(posts.filter((p) => p.isPinned).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
      done();
    });

    this.eventsService.getEvents().subscribe((events) => {
      this.attendanceService.getMemberAttendance(CURRENT_MEMBER_ID).subscribe((records) => {
        const pending = events
          .filter((e) => e.startsAt >= now)
          .map((event) => ({
            event,
            record: records.find((r) => r.eventId === event.id),
          }))
          .filter((item) => !item.record || item.record.status === 'pending')
          .map((item) => ({
            event: item.event,
            record: item.record ?? { eventId: item.event.id, memberId: CURRENT_MEMBER_ID, status: 'pending' as const },
          }));
        this.pendingAttendance.set(pending);
        done();
      });
    });
  }
}
