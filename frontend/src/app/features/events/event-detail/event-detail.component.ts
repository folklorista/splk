import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppEvent } from '../models/event.model';
import { AttendanceRecord, AttendanceStatus } from '../../attendance/models/attendance.model';
import { EventsService } from '../events.service';
import { AttendanceService } from '../../attendance/attendance.service';

// Temporary mock binding – will be replaced with auth→member mapping in a later phase
const CURRENT_MEMBER_ID = 1;

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
  imports: [DatePipe, RouterLink, FormsModule],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit {
  event = signal<AppEvent | null>(null);
  record = signal<AttendanceRecord | undefined>(undefined);
  noteOpen = signal(false);
  noteValue = signal('');
  loading = signal(true);
  notFound = signal(false);

  readonly statuses: AttendanceStatus[] = ['yes', 'no', 'maybe'];
  readonly statusLabels = STATUS_LABELS;

  constructor(
    private route: ActivatedRoute,
    private eventsService: EventsService,
    private attendanceService: AttendanceService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.eventsService.getEvent(id).subscribe((event) => {
      if (!event) { this.notFound.set(true); this.loading.set(false); return; }
      this.event.set(event);
      this.attendanceService.getMemberAttendance(CURRENT_MEMBER_ID).subscribe((records) => {
        const r = records.find((r) => r.eventId === id);
        this.record.set(r);
        this.noteValue.set(r?.note ?? '');
        this.loading.set(false);
      });
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
    if (!event) return;
    const updated: AttendanceRecord = {
      eventId: event.id,
      memberId: CURRENT_MEMBER_ID,
      status,
      note: this.noteValue() || undefined,
    };
    this.attendanceService.updateAttendance(updated).subscribe(() => this.record.set(updated));
  }

  clearStatus(): void {
    const event = this.event();
    if (!event) return;
    const cleared: AttendanceRecord = { eventId: event.id, memberId: CURRENT_MEMBER_ID, status: 'pending' };
    this.attendanceService.updateAttendance(cleared).subscribe(() => {
      this.record.set(cleared);
      this.noteValue.set('');
      this.noteOpen.set(false);
    });
  }

  saveNote(note: string): void {
    const event = this.event();
    if (!event) return;
    const updated: AttendanceRecord = {
      eventId: event.id,
      memberId: CURRENT_MEMBER_ID,
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
