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
import { IconComponent } from '../../../shared/icon/icon.component';

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
  allRecords = signal<AttendanceRecord[]>([]);
  noteOpen = signal(false);
  noteValue = signal('');
  loading = signal(true);
  notFound = signal(false);
  currentMemberId = signal<number | null>(null);
  targetGroupNames = signal<string>('');

  readonly statuses: AttendanceStatus[] = ['yes', 'no', 'maybe'];
  readonly statusLabels = STATUS_LABELS;

  readonly attendanceSummary = computed(() => {
    const records = this.allRecords();
    return {
      yes: records.filter((r) => r.status === 'yes').length,
      no: records.filter((r) => r.status === 'no').length,
      maybe: records.filter((r) => r.status === 'maybe').length,
      pending: records.filter((r) => r.status === 'pending').length,
    };
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
      const member = members.find((m) => m.email === user.email);
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

        this.loadTargetGroupNames(event.targetGroupIds);
        this.attendanceService.getMemberAttendance(member.id).subscribe((allRecords) => {
          const r = allRecords.find((r) => r.eventId === id);
          this.record.set(r);
          this.noteValue.set(r?.note ?? '');

          const eventRecords = allRecords.filter((r) => r.eventId === id);
          this.allRecords.set(eventRecords);
          this.loading.set(false);
        });
      });
    });
  }

  private loadTargetGroupNames(groupIds: number[]): void {
    if (!groupIds || groupIds.length === 0) return;

    this.groupsService.getGroupsByIds(groupIds).subscribe((groups) => {
      const names = groups.map((g) => g.name).join(', ');
      this.targetGroupNames.set(names);
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
    this.attendanceService.updateAttendance(updated).subscribe(() => this.record.set(updated));
  }

  clearStatus(): void {
    const event = this.event();
    const memberId = this.currentMemberId();
    if (!event || !memberId) return;
    const cleared: AttendanceRecord = { eventId: event.id, memberId, status: 'pending' };
    this.attendanceService.updateAttendance(cleared).subscribe(() => {
      this.record.set(cleared);
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
      this.record.set(updated);
      this.noteValue.set(note.trim());
      this.noteOpen.set(false);
    });
  }
}
