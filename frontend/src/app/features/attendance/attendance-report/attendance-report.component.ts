import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EventsService } from '../../events/events.service';
import { MembersService } from '../../members/members.service';
import { ActualAttendanceService } from '../actual-attendance.service';
import { AppEvent, EventType } from '../../events/models/event.model';
import { Member } from '../../../core/models/member.model';
import { ActualAttendance } from '../models/actual-attendance.model';
import {
  AttendanceCell,
  buildAttendanceCsv,
  buildAttendanceReport,
  defaultPeriod,
  filterPeriodEvents,
  formatSummary,
} from '../utils/actual-attendance.utils';
import { downloadTextFile } from '../../../core/utils/download.utils';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  rehearsal: 'Zkouška',
  performance: 'Vystoupení',
  camp: 'Soustředění',
  meeting: 'Schůzka',
  other: 'Jiné',
};

// Přehled skutečné docházky za období (výbor, admin) – tabulka členové × proběhlé akce
@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './attendance-report.component.html',
})
export class AttendanceReportComponent implements OnInit {
  private eventsService = inject(EventsService);
  private membersService = inject(MembersService);
  private actualAttendanceService = inject(ActualAttendanceService);
  private destroyRef = inject(DestroyRef);

  private events = signal<AppEvent[]>([]);
  private members = signal<Member[]>([]);
  private records = signal<ActualAttendance[]>([]);
  loading = signal(true);

  from = signal(defaultPeriod().from);
  to = signal(defaultPeriod().to);
  type = signal<EventType | 'all'>('all');

  readonly typeOptions = Object.entries(EVENT_TYPE_LABELS) as [EventType, string][];
  readonly formatSummary = formatSummary;

  readonly report = computed(() => {
    const events = filterPeriodEvents(this.events(), { from: this.from(), to: this.to(), type: this.type() });
    return buildAttendanceReport(events, this.members(), this.records());
  });

  ngOnInit(): void {
    this.membersService.getMembers().subscribe((members) => this.members.set(members));
    this.actualAttendanceService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((records) => this.records.set(records));
    this.eventsService.getEvents()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((events) => {
        this.events.set(events);
        this.loading.set(false);
      });
  }

  typeLabel(type: EventType): string {
    return EVENT_TYPE_LABELS[type] ?? type;
  }

  cellSymbol(cell: AttendanceCell): string {
    if (cell === true) return '✓';
    if (cell === false) return '✗';
    return cell === null ? '–' : '';
  }

  cellTitle(cell: AttendanceCell): string {
    if (cell === true) return 'Přítomen';
    if (cell === false) return 'Nepřítomen';
    return cell === null ? 'Nezapsáno' : 'Akce pro člena nebyla';
  }

  setType(value: string): void {
    this.type.set(value === 'all' ? 'all' : (value as EventType));
  }

  exportCsv(): void {
    downloadTextFile(`dochazka_${this.from()}_${this.to()}.csv`, buildAttendanceCsv(this.report()), 'text/csv;charset=utf-8');
  }
}
