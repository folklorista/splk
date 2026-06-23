import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AppEvent } from '../events/models/event.model';
import { AttendanceRecord, AttendanceStatus } from './models/attendance.model';
import { EventsService } from '../events/events.service';
import { AttendanceService } from './attendance.service';

// Temporary mock binding – will be replaced with auth→member mapping in a later phase
const CURRENT_MEMBER_ID = 1;

interface EventWithAttendance {
  event: AppEvent;
  record: AttendanceRecord | undefined;
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
  imports: [DatePipe],
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
        const items = events.map((event) => ({
          event,
          record: records.find((r) => r.eventId === event.id),
        }));
        this.items.set(items);
        this.loading.set(false);
      });
    });
  }

  statusLabel(status: AttendanceStatus | undefined): string {
    return status ? STATUS_LABELS[status] : STATUS_LABELS['pending'];
  }

  setStatus(eventId: number, status: AttendanceStatus): void {
    const record: AttendanceRecord = { eventId, memberId: CURRENT_MEMBER_ID, status };
    this.attendanceService.updateAttendance(record).subscribe(() => {
      this.items.update((items) =>
        items.map((item) =>
          item.event.id === eventId ? { ...item, record } : item,
        ),
      );
    });
  }
}
