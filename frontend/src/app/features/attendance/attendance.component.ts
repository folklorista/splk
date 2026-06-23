import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppEvent } from '../events/models/event.model';
import { AttendanceRecord, AttendanceStatus } from './models/attendance.model';
import { EventsService } from '../events/events.service';
import { AttendanceService } from './attendance.service';

// Temporary mock binding – will be replaced with auth→member mapping in a later phase
const CURRENT_MEMBER_ID = 1;

interface EventWithAttendance {
  event: AppEvent;
  record: AttendanceRecord | undefined;
  noteOpen: boolean;
  noteValue: string;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  yes: 'Přijdu',
  no: 'Nepřijdu',
  maybe: 'Možná',
  pending: 'Nezadáno',
};

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './attendance.component.html',
})
export class AttendanceComponent implements OnInit {
  items = signal<EventWithAttendance[]>([]);
  loading = signal(true);

  readonly statuses: AttendanceStatus[] = ['yes', 'no', 'maybe'];
  readonly statusLabels = STATUS_LABELS;

  constructor(
    private eventsService: EventsService,
    private attendanceService: AttendanceService,
  ) {}

  ngOnInit(): void {
    this.eventsService.getEvents().subscribe((events) => {
      this.attendanceService.getMemberAttendance(CURRENT_MEMBER_ID).subscribe((records) => {
        const items = events.map((event) => {
          const record = records.find((r) => r.eventId === event.id);
          return { event, record, noteOpen: false, noteValue: record?.note ?? '' };
        });
        this.items.set(items);
        this.loading.set(false);
      });
    });
  }

  statusLabel(status: AttendanceStatus | undefined): string {
    return status ? STATUS_LABELS[status] : STATUS_LABELS['pending'];
  }

  setStatus(eventId: number, status: AttendanceStatus): void {
    this.items.update((items) =>
      items.map((item) => {
        if (item.event.id !== eventId) return item;
        const record: AttendanceRecord = {
          eventId,
          memberId: CURRENT_MEMBER_ID,
          status,
          note: item.noteValue || undefined,
        };
        this.attendanceService.updateAttendance(record).subscribe();
        return { ...item, record };
      }),
    );
  }

  clearStatus(eventId: number): void {
    this.items.update((items) =>
      items.map((item) => {
        if (item.event.id !== eventId) return item;
        const record: AttendanceRecord = {
          eventId,
          memberId: CURRENT_MEMBER_ID,
          status: 'pending',
          note: undefined,
        };
        this.attendanceService.updateAttendance(record).subscribe();
        return { ...item, record, noteValue: '', noteOpen: false };
      }),
    );
  }

  toggleNote(eventId: number): void {
    this.items.update((items) =>
      items.map((item) =>
        item.event.id === eventId ? { ...item, noteOpen: !item.noteOpen } : item,
      ),
    );
  }

  saveNote(eventId: number, note: string): void {
    this.items.update((items) =>
      items.map((item) => {
        if (item.event.id !== eventId) return item;
        const currentStatus = item.record?.status ?? 'pending';
        const record: AttendanceRecord = {
          eventId,
          memberId: CURRENT_MEMBER_ID,
          status: currentStatus,
          note: note.trim() || undefined,
        };
        this.attendanceService.updateAttendance(record).subscribe();
        return { ...item, record, noteValue: note.trim() };
      }),
    );
  }
}
