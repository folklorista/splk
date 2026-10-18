import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { EventsService } from '../events.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { MembersService } from '../../members/members.service';
import { GroupsService } from '../../groups/groups.service';
import { AccessService } from '../../../core/access/access.service';
import { canEditEvent, eventOrganizerScope, isEventAudience } from '../../../core/access/access.utils';
import { AppEvent, EventType } from '../models/event.model';
import { MAX_REMINDER_LEAD_DAYS, defaultReminderLeadDays } from '../utils/event-reminders';
import { AvailabilityService } from '../../availability/availability.service';
import { formatRange } from '../../availability/unavailability.utils';
import { AttendanceRecord, AttendanceStatus } from '../../attendance/models/attendance.model';
import { Member } from '../../../core/models/member.model';
import { ActionFeedback } from '../../../shared/ui/form-ui';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

const STATUS_LABELS: Record<AttendanceStatus, string> = { yes: 'Přijde', no: 'Nepřijde', maybe: 'Možná', pending: 'Nezadáno' };

export const EVENT_TYPE_OPTIONS: [EventType, string][] = [
  ['rehearsal', 'Zkouška'],
  ['performance', 'Vystoupení'],
  ['camp', 'Soustředění'],
  ['meeting', 'Schůzka'],
  ['other', 'Jiné'],
];

// Založení a úprava akce přímo v modulu Akce (dřív v Administraci). Smí jen pověřený organizátor:
// pro celý soubor, pro akce své skupiny, nebo pro tuto konkrétní akci.
@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [RouterLink, RelativeTimePipe],
  template: `
    <div class="page">
      <a class="back-link" [routerLink]="backLink()">← Zpět</a>
      <h1 class="page__title">{{ eventId ? 'Upravit akci' : 'Nová akce' }}</h1>

      @if (eventId && !loaded()) {
        <p class="state-note">Načítání…</p>
      } @else if (!allowed()) {
        <p class="state-note">Tuto akci nemůžete upravovat – spravuje ji pověřený organizátor.</p>
      } @else {
        <form class="cs-form event-form" (submit)="$event.preventDefault(); save()">
          <label class="cs-field">
            <span>Název *</span>
            <input type="text" required [value]="title()" (input)="title.set($any($event.target).value)" />
          </label>

          <div class="cs-form__row">
            <label class="cs-field">
              <span>Typ *</span>
              <select (change)="type.set($any($event.target).value)">
                @for (option of typeOptions; track option[0]) {
                  <option [value]="option[0]" [selected]="type() === option[0]">{{ option[1] }}</option>
                }
              </select>
            </label>
            <label class="cs-field">
              <span>Začátek *</span>
              <input type="datetime-local" required [value]="startsAt()" (input)="startsAt.set($any($event.target).value)" />
            </label>
            <label class="cs-field">
              <span>Konec *</span>
              <input type="datetime-local" required [value]="endsAt()" (input)="endsAt.set($any($event.target).value)" />
            </label>
          </div>

          @if (unavailable().length) {
            <p class="event-form__unavailable" role="status">
              V tomto termínu {{ unavailable().length === 1 ? 'je nedostupný 1 oslovený člen' : 'je nedostupných ' + unavailable().length + ' oslovených členů' }}:
              @for (row of unavailable(); track row.id; let last = $last) { {{ row.name }} ({{ row.range }}@if (row.note) {, {{ row.note }}}){{ last ? '' : ',' }} }
            </p>
          }

          <label class="cs-field">
            <span>Místo *</span>
            <input type="text" required [value]="location()" (input)="location.set($any($event.target).value)" />
          </label>

          <label class="cs-field">
            <span>Popis</span>
            <textarea rows="3" [value]="description()" (input)="description.set($any($event.target).value)"></textarea>
          </label>

          <fieldset class="event-form__fieldset">
            <legend>Výzva k odpovědi</legend>
            <div class="cs-form__row">
              <label class="cs-field">
                <span>Vyzvat dní předem</span>
                <input type="number" min="0" [max]="maxLeadDays" [placeholder]="defaultLeadDays()" [value]="leadDays()" (input)="leadDays.set($any($event.target).value)" />
                <span class="cs-hint">Prázdné = výchozí pro typ akce ({{ defaultLeadDays() }} dní). Odpovědět lze kdykoli, výzva a badge se objeví až v předstihu.</span>
              </label>
              <label class="cs-field">
                <span>Odpovědět definitivně do</span>
                <input type="datetime-local" [value]="responseDeadline()" (input)="responseDeadline.set($any($event.target).value)" />
                <span class="cs-hint">Nepovinné. Po termínu se výzva zopakuje těm, kdo odpověděli MOŽNÁ nebo vůbec. Změnit odpověď jde i potom.</span>
              </label>
            </div>
          </fieldset>

          <fieldset class="event-form__fieldset">
            <legend>Pořádá</legend>
            <p class="cs-hint">Pořádající skupina akci spravuje jen tehdy, má-li její člověk pověření Organizace akcí pro tuto skupinu.</p>
            <div class="event-form__options">
              @for (group of organizerOptions(); track group.id) {
                <label class="cs-field cs-field--inline">
                  <input type="checkbox" [checked]="organizerGroupIds().includes(group.id)" (change)="toggle(organizerGroupIds, group.id)" />
                  {{ group.name }}
                </label>
              }
            </div>
          </fieldset>

          <fieldset class="event-form__fieldset">
            <legend>Pro koho</legend>
            <p class="cs-hint">Nic nevybráno = všichni členové souboru. Pozvaná skupina akci vidí, ale nespravuje ji.</p>
            <div class="event-form__options">
              @for (group of groups(); track group.id) {
                <label class="cs-field cs-field--inline">
                  <input type="checkbox" [checked]="targetGroupIds().includes(group.id)" (change)="toggle(targetGroupIds, group.id)" />
                  {{ group.name }}
                </label>
              }
            </div>
          </fieldset>

          <fieldset class="event-form__fieldset">
            <legend>Hosté</legend>
            <p class="cs-hint">Jednotlivci mimo cílové skupiny (např. externista na jeden zájezd). Pozvání na akci nedává přístup do skupin.</p>
            @if (guests().length) {
              <ul class="event-form__guests">
                @for (guest of guests(); track guest.id) {
                  <li>
                    {{ guest.nickname }} @if (guest.isExternal) { <span class="badge">externista</span> }
                    <button type="button" class="cs-btn" (click)="toggle(guestMemberIds, guest.id)">Odebrat</button>
                  </li>
                }
              </ul>
            }
            <select class="cs-input" (change)="addGuest($any($event.target))">
              <option value="">+ Přidat hosta…</option>
              @for (person of guestCandidates(); track person.id) {
                <option [value]="person.id">{{ person.nickname }}{{ person.isExternal ? ' (externista)' : '' }}</option>
              }
            </select>
          </fieldset>

          @if (eventId && audience().length) {
            <details class="cs-panel">
              <summary>Odpovědi za členy ({{ audience().length }})</summary>
              <div class="cs-panel__body">
                <p class="cs-hint">Když se někdo omluví jinou cestou. Změny se uloží s akcí.</p>
                <table class="event-form__table">
                  <tbody>
                    @for (member of audience(); track member.id) {
                      <tr>
                        <td>{{ member.nickname }}</td>
                        <td>
                          <select class="cs-input" (change)="setStatus(member.id, $any($event.target).value)">
                            @for (status of statuses; track status) {
                              <option [value]="status" [selected]="statusOf(member.id) === status">{{ statusLabels[status] }}</option>
                            }
                          </select>
                        </td>
                        <td class="cs-muted">
                          @if (recordOf(member.id)?.firstViewedAt; as viewedAt) { viděl/a {{ viewedAt | relativeTime }} } @else { nezobrazeno }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </details>
          }

          @if (feedback.error()) {
            <p class="cs-error" role="alert">{{ feedback.error() }}</p>
          }

          <div class="cs-form__actions">
            <button type="submit" class="cs-btn cs-btn--primary" [disabled]="feedback.busy() || !valid()">
              {{ feedback.busy() ? 'Ukládám…' : eventId ? 'Uložit' : 'Založit akci' }}
            </button>
            <a class="cs-btn" [routerLink]="backLink()">Zrušit</a>
            @if (eventId) {
              <span class="cs-toolbar__spacer"></span>
              <button type="button" class="cs-btn cs-btn--danger" (click)="remove()">Smazat akci</button>
            }
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .event-form { max-width: 640px; }
      .event-form__unavailable { font-size: var(--font-size-sm); padding: var(--spacing-sm) var(--spacing-md); border-left: 4px solid #e0a800; background: var(--color-surface-alt); border-radius: 6px; }
      .event-form__fieldset { border: 1px solid var(--color-border); border-radius: 8px; padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md); display: flex; flex-direction: column; gap: var(--spacing-sm); }
      .event-form__fieldset legend { font-size: var(--font-size-sm); font-weight: 600; padding: 0 4px; }
      .event-form__options { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--spacing-xs); }
      .event-form__guests { list-style: none; display: flex; flex-direction: column; gap: var(--spacing-xs); font-size: var(--font-size-sm); }
      .event-form__guests li { display: flex; align-items: center; gap: var(--spacing-sm); }
      .event-form__table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
      .event-form__table td { padding: 4px; border-bottom: 1px solid var(--color-border); }
    `,
  ],
})
export class EventFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private eventsService = inject(EventsService);
  private attendanceService = inject(AttendanceService);
  private membersService = inject(MembersService);
  private groupsService = inject(GroupsService);
  private access = inject(AccessService);

  readonly feedback = new ActionFeedback();
  readonly typeOptions = EVENT_TYPE_OPTIONS;
  readonly statuses: AttendanceStatus[] = ['pending', 'yes', 'no', 'maybe'];
  readonly statusLabels = STATUS_LABELS;
  readonly eventId = Number(this.route.snapshot.paramMap.get('id')) || null;

  readonly loaded = signal(false);
  private original = signal<AppEvent | null>(null);
  readonly title = signal('');
  readonly type = signal<EventType>('rehearsal');
  readonly startsAt = signal('');
  readonly endsAt = signal('');
  readonly location = signal('');
  readonly description = signal('');
  readonly leadDays = signal('');
  readonly responseDeadline = signal('');
  readonly maxLeadDays = MAX_REMINDER_LEAD_DAYS;
  readonly defaultLeadDays = computed(() => defaultReminderLeadDays(this.type()));
  readonly targetGroupIds = signal<number[]>([]);
  readonly organizerGroupIds = signal<number[]>([]);
  readonly guestMemberIds = signal<number[]>([]);
  private records = signal<AttendanceRecord[]>([]);
  private statusOverrides = signal(new Map<number, AttendanceStatus>());

  readonly groups = this.groupsService.groups;
  private scope = computed(() => eventOrganizerScope(this.access.subject()));

  // Pořádat lze za skupiny v rozsahu pověření; již nastavené pořadatele nelze ztratit z výběru
  readonly organizerOptions = computed(() => {
    const scope = this.scope();
    return this.groups().filter(
      (g) => scope.ensembleWide || scope.groupIds.includes(g.id) || this.original()?.organizerGroupIds?.includes(g.id),
    );
  });

  readonly allowed = computed(() => {
    const event = this.original();
    if (event) return canEditEvent(this.access.subject(), event);
    return this.access.canCreateEvents();
  });

  readonly guests = computed(() =>
    this.guestMemberIds()
      .map((id) => this.membersService.members().find((m) => m.id === id))
      .filter((m): m is Member => !!m),
  );

  readonly guestCandidates = computed(() =>
    this.membersService
      .members()
      .filter((m) => m.isActive && !this.guestMemberIds().includes(m.id))
      .sort((a, b) => Number(!!b.isExternal) - Number(!!a.isExternal) || a.nickname.localeCompare(b.nickname, 'cs')),
  );

  readonly audience = computed(() => {
    const scope = { id: this.eventId ?? 0, targetGroupIds: this.targetGroupIds(), guestMemberIds: this.guestMemberIds() };
    return this.membersService.members().filter((m) => isEventAudience(m, scope));
  });

  // Dlouhodobá nedostupnost oslovených členů v termínu (jen informace pro organizátora)
  private availability = inject(AvailabilityService);
  readonly unavailable = computed(() => {
    const members = this.audience();
    return this.availability.forPlanning(this.startsAt(), this.endsAt(), members.map((m) => m.id)).map((u) => ({
      id: u.id,
      name: members.find((m) => m.id === u.memberId)?.nickname ?? '?',
      range: formatRange(u),
      note: u.note,
    }));
  });

  readonly valid = computed(() => {
    const scope = this.scope();
    const organizerOk = scope.ensembleWide || !!this.eventId || this.organizerGroupIds().some((g) => scope.groupIds.includes(g));
    return !!this.title().trim() && !!this.startsAt() && !!this.endsAt() && !!this.location().trim() && this.endsAt() >= this.startsAt() && organizerOk;
  });

  ngOnInit(): void {
    if (!this.eventId) {
      const scope = this.scope();
      if (!scope.ensembleWide && scope.groupIds.length) this.organizerGroupIds.set([scope.groupIds[0]]);
      this.loaded.set(true);
      return;
    }
    this.eventsService.getEvent(this.eventId).subscribe((event) => {
      if (!event || this.loaded()) {
        this.loaded.set(true);
        return;
      }
      this.original.set(event);
      this.title.set(event.title);
      this.type.set(event.type);
      this.startsAt.set(event.startsAt.slice(0, 16));
      this.endsAt.set(event.endsAt.slice(0, 16));
      this.location.set(event.location);
      this.description.set(event.description ?? '');
      this.leadDays.set(event.reminderLeadDays !== undefined ? String(event.reminderLeadDays) : '');
      this.responseDeadline.set(event.responseDeadline?.slice(0, 16) ?? '');
      this.targetGroupIds.set([...(event.targetGroupIds ?? [])]);
      this.organizerGroupIds.set([...(event.organizerGroupIds ?? [])]);
      this.guestMemberIds.set([...(event.guestMemberIds ?? [])]);
      this.records.set(event.attendance ?? []);
      this.loaded.set(true);
    });
  }

  // Prázdné = výchozí podle typu; jinak 0–365 dní
  private parsedLeadDays(): number | undefined {
    const value = String(this.leadDays()).trim();
    if (!value) return undefined;
    const days = Math.round(Number(value));
    return Number.isFinite(days) ? Math.min(Math.max(0, days), MAX_REMINDER_LEAD_DAYS) : undefined;
  }

  backLink(): string[] {
    return this.eventId ? ['/app/events', String(this.eventId)] : ['/app/events'];
  }

  toggle(list: ReturnType<typeof signal<number[]>>, id: number): void {
    list.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  addGuest(select: HTMLSelectElement): void {
    const id = Number(select.value);
    if (id) this.guestMemberIds.update((ids) => [...ids, id]);
    select.value = '';
  }

  recordOf(memberId: number): AttendanceRecord | undefined {
    return this.records().find((r) => r.memberId === memberId);
  }

  statusOf(memberId: number): AttendanceStatus {
    return this.statusOverrides().get(memberId) ?? this.recordOf(memberId)?.status ?? 'pending';
  }

  setStatus(memberId: number, status: AttendanceStatus): void {
    this.statusOverrides.update((map) => new Map(map).set(memberId, status));
  }

  private saveStatuses(eventId: number): Observable<unknown> {
    const changes = [...this.statusOverrides().entries()].filter(([memberId, status]) => this.recordOf(memberId)?.status !== status);
    if (!changes.length) return of(null);
    return forkJoin(
      changes.map(([memberId, status]) => this.attendanceService.updateAttendance({ ...(this.recordOf(memberId) ?? { eventId, memberId }), status })),
    );
  }

  save(): void {
    if (!this.valid()) return;
    const data: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: this.title().trim(),
      type: this.type(),
      startsAt: this.startsAt(),
      endsAt: this.endsAt(),
      location: this.location().trim(),
      description: this.description().trim() || undefined,
      reminderLeadDays: this.parsedLeadDays(),
      responseDeadline: this.responseDeadline() || undefined,
      targetGroupIds: this.targetGroupIds(),
      organizerGroupIds: this.organizerGroupIds().length ? this.organizerGroupIds() : undefined,
      guestMemberIds: this.guestMemberIds().length ? this.guestMemberIds() : undefined,
    };
    const request = this.eventId
      ? this.eventsService.updateEvent(this.eventId, data).pipe(switchMap(() => this.saveStatuses(this.eventId!)))
      : this.eventsService.createEvent(data);
    this.feedback.run(request, (result) => {
      const id = this.eventId ?? (result as AppEvent).id;
      this.router.navigate(['/app/events', id]);
    });
  }

  remove(): void {
    if (!this.eventId || !confirm('Opravdu akci smazat? Smaže se i nahlášená účast.')) return;
    this.feedback.run(this.eventsService.deleteEvent(this.eventId), () => this.router.navigate(['/app/events']));
  }
}
