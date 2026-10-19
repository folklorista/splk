import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Group } from '../../../core/models/group.model';
import { AccessService } from '../../../core/access/access.service';
import { canSeeEvent } from '../../../core/access/access.utils';
import { EventsService } from '../../events/events.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { AppEvent } from '../../events/models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';
import { EventListComponent } from '../../events/event-list/event-list.component';

export type GroupEventRole = 'all' | 'organizer' | 'target';

// Akce skupiny: pořádá ji skupina, nebo je skupina mezi cílovými („Pro koho“)
export function groupEvents(events: AppEvent[], groupId: number, role: GroupEventRole): AppEvent[] {
  return events.filter((e) => {
    const organizer = (e.organizerGroupIds ?? []).includes(groupId);
    const target = e.targetGroupIds.includes(groupId);
    return role === 'organizer' ? organizer : role === 'target' ? target : organizer || target;
  });
}

// Záložka Akce ve skupině – stejný seznam jako stránka Akce (stejný detail akce, ne „skupinový typ akce“)
@Component({
  selector: 'app-group-events',
  standalone: true,
  imports: [EventListComponent],
  template: `
    <div class="events-filters">
      <label class="events-filters__field">
        <span>Akce skupiny</span>
        <select [value]="role()" (change)="role.set($any($event.target).value)">
          <option value="all">Vše</option>
          <option value="organizer">Pořádá skupina</option>
          <option value="target">Pro skupinu</option>
        </select>
      </label>
    </div>
    <app-event-list [upcoming]="upcoming()" [past]="past()" [memberId]="memberId()" emptyText="Skupina nemá žádné nadcházející akce."
      (statusChange)="setStatus($event.eventId, $event.status)" />
  `,
})
export class GroupEventsComponent {
  readonly group = input.required<Group>();

  private access = inject(AccessService);
  private attendance = inject(AttendanceService);
  private events = toSignal(inject(EventsService).getEvents(), { initialValue: [] });
  readonly memberId = this.access.memberId;
  readonly role = signal<GroupEventRole>('all');

  private matching = computed(() => {
    const subject = this.access.subject();
    return groupEvents(this.events(), this.group().id, this.role()).filter((e) => canSeeEvent(subject, e));
  });
  readonly upcoming = computed(() => {
    const now = new Date();
    return this.matching().filter((e) => new Date(e.endsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });
  readonly past = computed(() => {
    const now = new Date();
    return this.matching().filter((e) => new Date(e.endsAt) < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  });

  setStatus(eventId: number, status: AttendanceStatus): void {
    const memberId = this.memberId();
    if (memberId) this.attendance.setStatus(eventId, memberId, status).subscribe();
  }
}
