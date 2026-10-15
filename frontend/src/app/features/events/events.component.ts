import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppEvent, EventType } from './models/event.model';
import { AttendanceCounts, DEFAULT_EVENT_FILTERS, EventFilters, ResponseFilter, filterEvents, ownAttendanceStatus } from './utils/event-filters';
import { EventsService } from './events.service';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { Member } from '../../core/models/member.model';
import { isItemVisibleToUser, isLeaderOrAdmin } from '../../core/utils/visibility.utils';
import { SettingsService } from '../../core/settings/settings.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceStatus } from '../attendance/models/attendance.model';
import { EventRsvpRowComponent } from './event-rsvp-row/event-rsvp-row.component';
import { MONTH_LABELS, WEEKDAY_LABELS, buildMonthGrid, eventsOnDay, toDateKey, weekdayLabel } from './utils/calendar.utils';

export type EventsView = 'list' | 'calendar';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  rehearsal: 'Zkouška',
  performance: 'Vystoupení',
  camp: 'Soustředění',
  meeting: 'Schůzka',
  other: 'Jiné',
};

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [EventRsvpRowComponent, RouterLink],
  templateUrl: './events.component.html',
})
export class EventsComponent implements OnInit {
  events = signal<AppEvent[]>([]);
  loading = signal(true);
  currentMemberId = signal<number | null>(null);
  allMembers = signal<Member[]>([]);
  view = signal<EventsView>('list');

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly todayKey = toDateKey(new Date());
  visibleMonth = signal({ year: new Date().getFullYear(), month: new Date().getMonth() });
  selectedDateKey = signal(this.todayKey);

  visibleEvents = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    return this.events().filter(e => isItemVisibleToUser(e.targetGroupIds, user.groupIds));
  });

  // Seznam ukazuje jen nadcházející akce chronologicky – historie je dostupná v kalendáři
  upcomingEvents = computed(() => {
    const now = new Date();
    return this.visibleEvents()
      .filter(e => new Date(e.endsAt) >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });

  monthTitle = computed(() => {
    const { year, month } = this.visibleMonth();
    return `${MONTH_LABELS[month]} ${year}`;
  });

  calendarWeeks = computed(() => {
    const { year, month } = this.visibleMonth();
    const events = this.visibleEvents();
    return buildMonthGrid(year, month).map(week =>
      week.map(day => ({ ...day, events: eventsOnDay(events, day.dateKey) })),
    );
  });

  // Tooltip dne (jen zařízení s hoverem): „18:00 – Nácvik“
  dayTooltip(events: AppEvent[]): string {
    return events.map((e) => `${e.startsAt.slice(11, 16)} – ${e.title}`).join('\n');
  }

  selectedDayEvents = computed(() => eventsOnDay(this.visibleEvents(), this.selectedDateKey()));

  ownStatus = (event: AppEvent): AttendanceStatus => ownAttendanceStatus(event, this.currentMemberId());

  filters = signal<EventFilters>(DEFAULT_EVENT_FILTERS);
  readonly typeOptions = Object.entries(EVENT_TYPE_LABELS) as [EventType, string][];

  filteredEvents = computed(() => filterEvents(this.upcomingEvents(), this.filters(), this.currentMemberId()));

  // Upozornění v záhlaví – jen nadcházející akce bez mé odpovědi
  pendingCount = computed(() =>
    filterEvents(this.upcomingEvents(), { type: 'all', response: 'pending' }, this.currentMemberId()).length,
  );

  // Počty odpovědí vidí jen výbor
  readonly isLeader = computed(() => this.auth.currentUser()?.roles.includes('leader') ?? false);

  // Odkaz na přehled skutečné docházky (výbor, admin)
  readonly canViewAttendance = computed(() => isLeaderOrAdmin(this.auth.currentUser()));

  attendanceCounts = (event: AppEvent): AttendanceCounts | null => {
    if (!this.isLeader()) return null;
    const visibleMembers = this.allMembers().filter((m) => m.isActive && isItemVisibleToUser(event.targetGroupIds, m.groupIds));
    const counts: AttendanceCounts = { yes: 0, no: 0, maybe: 0, pending: 0 };
    for (const member of visibleMembers) {
      counts[event.attendance?.find((r) => r.memberId === member.id)?.status ?? 'pending']++;
    }
    return counts;
  };

  constructor(
    private eventsService: EventsService,
    private attendanceService: AttendanceService,
    private auth: AuthService,
    private membersService: MembersService,
    private route: ActivatedRoute,
    private router: Router,
    private settings: SettingsService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const viewParam = params.get('view');
    this.view.set(viewParam === 'calendar' || viewParam === 'list' ? viewParam : this.settings.settings().eventsView);
    if (params.get('response') === 'pending') {
      this.filters.set({ ...DEFAULT_EVENT_FILTERS, response: 'pending' });
    }

    const user = this.auth.currentUser();
    if (user) {
      this.membersService.getMembers().subscribe((members) => {
        this.allMembers.set(members);
        const member = members.find((m) => m.userId === user.id);
        this.currentMemberId.set(member?.id ?? null);
      });
    }

    this.eventsService.getEvents().subscribe((events) => {
      this.events.set(events);
      this.loading.set(false);
    });
  }

  setTypeFilter(type: string): void {
    this.filters.update((f) => ({ ...f, type: type as EventFilters['type'] }));
  }

  setResponseFilter(response: string): void {
    this.filters.update((f) => ({ ...f, response: response as ResponseFilter }));
  }

  showPending(): void {
    this.filters.set({ ...DEFAULT_EVENT_FILTERS, response: 'pending' });
    this.setView('list');
  }

  setView(view: EventsView): void {
    this.view.set(view);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === this.settings.settings().eventsView ? null : view },
      replaceUrl: true,
    });
  }

  shiftMonth(delta: number): void {
    const { year, month } = this.visibleMonth();
    const target = new Date(year, month + delta, 1);
    this.visibleMonth.set({ year: target.getFullYear(), month: target.getMonth() });
    this.selectedDateKey.set(this.isTodayInVisibleMonth() ? this.todayKey : toDateKey(target));
  }

  goToToday(): void {
    const today = new Date();
    this.visibleMonth.set({ year: today.getFullYear(), month: today.getMonth() });
    this.selectedDateKey.set(this.todayKey);
  }

  selectDay(dateKey: string): void {
    this.selectedDateKey.set(dateKey);
    const [year, month] = dateKey.split('-').map(Number);
    this.visibleMonth.set({ year, month: month - 1 });
  }

  selectedDayLabel(): string {
    const [year, month, day] = this.selectedDateKey().split('-').map(Number);
    return `${weekdayLabel(this.selectedDateKey())} ${day}. ${month}. ${year}`;
  }

  setStatus(eventId: number, status: AttendanceStatus): void {
    const memberId = this.currentMemberId();
    if (!memberId) return;
    // Okamžitá odezva v UI, stream akcí po uložení stav potvrdí
    this.events.update(events => events.map(e => e.id !== eventId ? e : {
      ...e,
      attendance: [
        ...(e.attendance ?? []).filter(a => a.memberId !== memberId),
        { ...(e.attendance?.find(a => a.memberId === memberId) ?? { eventId, memberId }), status },
      ],
    }));
    this.attendanceService.setStatus(eventId, memberId, status).subscribe();
  }

  private isTodayInVisibleMonth(): boolean {
    const { year, month } = this.visibleMonth();
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month;
  }
}
