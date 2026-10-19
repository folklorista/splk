import { Component, input, output } from '@angular/core';
import { AppEvent } from '../models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';
import { AttendanceCounts, ownAttendanceStatus } from '../utils/event-filters';
import { EventRsvpRowComponent } from '../event-rsvp-row/event-rsvp-row.component';

// Seznam akcí: nadcházející a pod nimi sbalená sekce „Uplynulé“ (nejnovější první).
// Používá stránka Akce i záložka Akce ve skupině.
@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [EventRsvpRowComponent],
  template: `
    @if (!upcoming().length) {
      <p class="state-note">{{ emptyText() }}</p>
    } @else {
      <ul class="rsvp-list">
        @for (event of upcoming(); track event.id) {
          <li><app-event-rsvp-row [event]="event" [status]="status(event)" [counts]="countsFor()(event)" (statusChange)="statusChange.emit({ eventId: event.id, status: $event })" /></li>
        }
      </ul>
    }
    @if (past().length) {
      <details class="events-past">
        <summary class="events-past__summary">Uplynulé ({{ past().length }})</summary>
        <ul class="rsvp-list">
          @for (event of past(); track event.id) {
            <li><app-event-rsvp-row [event]="event" [status]="status(event)" [counts]="countsFor()(event)" /></li>
          }
        </ul>
      </details>
    }
  `,
})
export class EventListComponent {
  readonly upcoming = input<AppEvent[]>([]);
  readonly past = input<AppEvent[]>([]);
  readonly memberId = input<number | null>(null);
  readonly emptyText = input('Žádné nadcházející akce.');
  // Počty odpovědí (jen pro ty, kdo je smějí vidět)
  readonly countsFor = input<(event: AppEvent) => AttendanceCounts | null>(() => null);
  readonly statusChange = output<{ eventId: number; status: AttendanceStatus }>();

  status(event: AppEvent): AttendanceStatus {
    return ownAttendanceStatus(event, this.memberId());
  }
}
