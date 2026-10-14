import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppEvent } from '../models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';
import { weekdayLabel } from '../utils/calendar.utils';
import { AttendanceCounts } from '../utils/event-filters';

type QuickStatus = Exclude<AttendanceStatus, 'pending'>;

const QUICK_LABELS: Record<QuickStatus, string> = {
  yes: 'Ano',
  maybe: 'Možná',
  no: 'Ne',
};

// Na úzkém displeji se místo textu ukáže jen ikona (CSS), aby zůstalo místo na název akce
const QUICK_ICONS: Record<QuickStatus, string> = {
  yes: '✓',
  maybe: '?',
  no: '✗',
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
  // Počty odpovědí – předává se jen výboru, ostatní je nevidí
  @Input() counts: AttendanceCounts | null = null;
  @Output() statusChange = new EventEmitter<AttendanceStatus>();

  readonly quickStatuses: QuickStatus[] = ['yes', 'maybe', 'no'];
  readonly quickLabels = QUICK_LABELS;
  readonly quickIcons = QUICK_ICONS;

  get countsTitle(): string {
    const c = this.counts;
    return c ? `Přijde ${c.yes}, možná ${c.maybe}, nepřijde ${c.no}, neodpovědělo ${c.pending}` : '';
  }

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
