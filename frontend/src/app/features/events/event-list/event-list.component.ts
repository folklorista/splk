import { Component, computed, input, output } from '@angular/core';
import { AppEvent } from '../models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';
import { AttendanceCounts, ownAttendanceStatus } from '../utils/event-filters';
import { EventRsvpRowComponent } from '../event-rsvp-row/event-rsvp-row.component';
import { groupByMonth } from '../utils/event-format';

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
      @for (month of upcomingByMonth(); track month.key) {
        <section class="event-month">
          <h2 class="event-month__title">{{ month.label }} <span class="event-month__count">{{ month.items.length }}</span></h2>
          <ul class="rsvp-list">
            @for (event of month.items; track event.id) {
              <li><app-event-rsvp-row [event]="event" [status]="status(event)" [counts]="countsFor()(event)" (statusChange)="statusChange.emit({ eventId: event.id, status: $event })" /></li>
            }
          </ul>
        </section>
      }
    }
    @if (past().length) {
      <details class="events-past">
        <summary class="toggle-divider"><span class="toggle-divider__btn">Uplynulé ({{ past().length }})</span></summary>
        @for (month of pastByMonth(); track month.key) {
          <section class="event-month">
            <h2 class="event-month__title">{{ month.label }} <span class="event-month__count">{{ month.items.length }}</span></h2>
            <ul class="rsvp-list">
              @for (event of month.items; track event.id) {
                <li><app-event-rsvp-row [event]="event" [status]="status(event)" [counts]="countsFor()(event)" /></li>
              }
            </ul>
          </section>
        }
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

  // Dlouhé seznamy členěné po měsících (nadcházející chronologicky, uplynulé od nejnovější)
  readonly upcomingByMonth = computed(() => groupByMonth(this.upcoming()));
  readonly pastByMonth = computed(() => groupByMonth(this.past()));

  status(event: AppEvent): AttendanceStatus {
    return ownAttendanceStatus(event, this.memberId());
  }
}
