import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppEvent } from '../models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';
import { weekdayLabel } from '../utils/calendar.utils';

const QUICK_LABELS: Record<Exclude<AttendanceStatus, 'pending'>, string> = {
  yes: 'Ano',
  maybe: 'Možná',
  no: 'Ne',
};

// Kompaktní řádek akce s rychlým potvrzením účasti – jen zobrazuje a hlásí volbu, data neukládá
@Component({
  selector: 'app-event-rsvp-row',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './event-rsvp-row.component.html',
})
export class EventRsvpRowComponent {
  @Input({ required: true }) event!: AppEvent;
  @Input() status: AttendanceStatus = 'pending';
  @Input() showDate = true;
  @Output() statusChange = new EventEmitter<AttendanceStatus>();

  readonly quickStatuses: Exclude<AttendanceStatus, 'pending'>[] = ['yes', 'maybe', 'no'];
  readonly quickLabels = QUICK_LABELS;

  get isPast(): boolean {
    return new Date(this.event.startsAt) < new Date();
  }

  get weekday(): string {
    return weekdayLabel(this.event.startsAt);
  }

  select(status: AttendanceStatus): void {
    if (status !== this.status) {
      this.statusChange.emit(status);
    }
  }
}
