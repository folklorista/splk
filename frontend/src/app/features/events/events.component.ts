import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppEvent } from './models/event.model';
import { EventsService } from './events.service';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { Member } from '../../core/models/member.model';
import { isItemVisibleToUser } from '../../core/utils/visibility.utils';

const EVENT_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Zkouška',
  performance: 'Vystoupení',
  camp: 'Soustředění',
  meeting: 'Schůzka',
  other: 'Jiné',
};

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './events.component.html',
})
export class EventsComponent implements OnInit {
  events = signal<AppEvent[]>([]);
  loading = signal(true);
  currentMemberId = signal<number | null>(null);
  allMembers = signal<Member[]>([]);

  visibleEvents = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    const memberId = this.currentMemberId();
    return this.events().filter(e => isItemVisibleToUser(e.targetGroupIds, user.groupIds, e.targetMemberIds, memberId));
  });

  getUserAttendanceStatus = (event: AppEvent): string | null => {
    const memberId = this.currentMemberId();
    if (!event.attendance || event.attendance.length === 0 || memberId === null) return null;
    const attendance = event.attendance.find(a => a.memberId === memberId);
    return attendance?.status || null;
  };

  isWaitingForResponse = (event: AppEvent): boolean => {
    const memberId = this.currentMemberId();
    if (memberId === null) return false;
    const own = event.attendance?.find(a => a.memberId === memberId);
    return !own || own.status === 'pending';
  };

  getAttendanceLabel = (status: string | null): string => {
    if (!status) return '';
    const labels: Record<string, string> = {
      yes: 'ANO',
      no: 'NE',
      maybe: 'MOŽNÁ',
    };
    return labels[status] ?? '';
  };

  attendanceSummary = (event: AppEvent): { yes: number; no: number; maybe: number; pending: number } => {
    const visibleMembers = this.allMembers().filter((m) => isItemVisibleToUser(event.targetGroupIds, m.groupIds, event.targetMemberIds, m.id));
    const records = event.attendance ?? [];
    let yes = 0, no = 0, maybe = 0;
    for (const member of visibleMembers) {
      const status = records.find((r) => r.memberId === member.id)?.status;
      if (status === 'yes') yes++;
      else if (status === 'no') no++;
      else if (status === 'maybe') maybe++;
    }
    return { yes, no, maybe, pending: visibleMembers.length - yes - no - maybe };
  };

  constructor(
    private eventsService: EventsService,
    private auth: AuthService,
    private membersService: MembersService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.membersService.getMembers().subscribe((members) => {
        this.allMembers.set(members);
        const member = members.find((m) => m.email === user.email);
        this.currentMemberId.set(member?.id ?? null);
      });
    }

    this.eventsService.getEvents().subscribe((events) => {
      this.events.set(events);
      this.loading.set(false);
    });
  }

  typeLabel(type: string): string {
    return EVENT_TYPE_LABELS[type] ?? type;
  }
}
