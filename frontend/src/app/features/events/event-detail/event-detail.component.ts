import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppEvent } from '../models/event.model';
import { AttendanceRecord, AttendanceStatus } from '../../attendance/models/attendance.model';
import { EventsService } from '../events.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { GroupsService } from '../../../core/services/groups.service';
import { Group } from '../../../core/models/group.model';
import { Member } from '../../../core/models/member.model';
import { IconComponent } from '../../../shared/icon/icon.component';
import { isItemVisibleToUser } from '../../../core/utils/visibility.utils';

const EVENT_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Zkouška',
  performance: 'Vystoupení',
  camp: 'Soustředění',
  meeting: 'Schůzka',
  other: 'Jiné',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  yes: 'Přijdu',
  no: 'Nepřijdu',
  maybe: 'Možná',
  pending: 'Nezadáno',
};

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, IconComponent],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit {
  event = signal<AppEvent | null>(null);
  record = signal<AttendanceRecord | undefined>(undefined);
  eventRecords = signal<AttendanceRecord[]>([]);
  allMembers = signal<Member[]>([]);
  noteOpen = signal(false);
  noteValue = signal('');
  loading = signal(true);
  notFound = signal(false);
  currentMemberId = signal<number | null>(null);
  targetGroups = signal<Group[]>([]);

  readonly statuses: AttendanceStatus[] = ['yes', 'no', 'maybe'];
  readonly statusLabels = STATUS_LABELS;

  readonly visibleMembers = computed(() => {
    const event = this.event();
    if (!event) return [];
    return this.allMembers().filter((m) => isItemVisibleToUser(event.targetGroupIds, m.groupIds));
  });

  // Členové rozdělení podle stavu účasti – chybějící záznam se počítá jako "pending"
  readonly membersByStatus = computed(() => {
    const records = this.eventRecords();
    const byStatus: Record<AttendanceStatus, Member[]> = { yes: [], no: [], maybe: [], pending: [] };
    for (const member of this.visibleMembers()) {
      const record = records.find((r) => r.memberId === member.id);
      const status: AttendanceStatus = record?.status ?? 'pending';
      byStatus[status].push(member);
    }
    return byStatus;
  });

  readonly attendanceSummary = computed(() => {
    const byStatus = this.membersByStatus();
    return {
      yes: byStatus.yes.length,
      no: byStatus.no.length,
      maybe: byStatus.maybe.length,
      pending: byStatus.pending.length,
    };
  });

  // Kdo si akci alespoň zobrazil (bez ohledu na to, jestli už vyjádřil účast) – jen pro admina
  readonly viewedStatus = computed(() => {
    const records = this.eventRecords();
    const viewed: Member[] = [];
    const notViewed: Member[] = [];
    for (const member of this.visibleMembers()) {
      const record = records.find((r) => r.memberId === member.id);
      (record?.firstViewedAt ? viewed : notViewed).push(member);
    }
    return { viewed, notViewed };
  });

  constructor(
    private route: ActivatedRoute,
    private eventsService: EventsService,
    private attendanceService: AttendanceService,
    private auth: AuthService,
    private membersService: MembersService,
    private groupsService: GroupsService,
  ) {}

  get isLeader(): boolean {
    return this.auth.currentUser()?.roles.includes('leader') ?? false;
  }

  get isAdmin(): boolean {
    return this.auth.currentUser()?.roles.includes('admin') ?? false;
  }

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
      this.allMembers.set(members);
      const member = members.find((m) => m.userId === user.id);
      if (!member) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }

      this.currentMemberId.set(member.id);
      const id = Number(this.route.snapshot.paramMap.get('id'));
      this.eventsService.getEvent(id).subscribe((event) => {
        if (!event) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }
        this.event.set(event);

        this.loadTargetGroups(event.targetGroupIds);
        this.attendanceService.markViewed(id, member.id).subscribe();
        this.attendanceService.getAttendance(id).subscribe((records) => {
          this.eventRecords.set(records);
          const r = records.find((r) => r.memberId === member.id);
          this.record.set(r);
          this.noteValue.set(r?.note ?? '');
          this.loading.set(false);
        });
      });
    });
  }

  private patchOwnRecord(record: AttendanceRecord): void {
    this.record.set(record);
    this.eventRecords.update((records) => [
      ...records.filter((r) => r.memberId !== record.memberId),
      record,
    ]);
  }

  private loadTargetGroups(groupIds: number[]): void {
    if (!groupIds || groupIds.length === 0) return;

    this.groupsService.getGroupsByIds(groupIds).subscribe((groups) => {
      this.targetGroups.set(groups);
    });
  }

  typeLabel(type: string): string {
    return EVENT_TYPE_LABELS[type] ?? type;
  }

  statusLabel(status: AttendanceStatus | undefined): string {
    return status ? STATUS_LABELS[status] : STATUS_LABELS['pending'];
  }

  setStatus(status: AttendanceStatus): void {
    const event = this.event();
    const memberId = this.currentMemberId();
    if (!event || !memberId) return;
    const updated: AttendanceRecord = {
      eventId: event.id,
      memberId,
      status,
      note: this.noteValue() || undefined,
    };
    this.attendanceService.updateAttendance(updated).subscribe(() => this.patchOwnRecord(updated));
  }

  clearStatus(): void {
    const event = this.event();
    const memberId = this.currentMemberId();
    if (!event || !memberId) return;
    const cleared: AttendanceRecord = { eventId: event.id, memberId, status: 'pending' };
    this.attendanceService.updateAttendance(cleared).subscribe(() => {
      this.patchOwnRecord(cleared);
      this.noteValue.set('');
      this.noteOpen.set(false);
    });
  }

  saveNote(note: string): void {
    const event = this.event();
    const memberId = this.currentMemberId();
    if (!event || !memberId) return;
    const updated: AttendanceRecord = {
      eventId: event.id,
      memberId,
      status: this.record()?.status ?? 'pending',
      note: note.trim() || undefined,
    };
    this.attendanceService.updateAttendance(updated).subscribe(() => {
      this.patchOwnRecord(updated);
      this.noteValue.set(note.trim());
      this.noteOpen.set(false);
    });
  }
}
