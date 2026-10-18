import { Component, DestroyRef, OnInit, signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppEvent } from '../models/event.model';
import { AttendanceRecord, AttendanceStatus } from '../../attendance/models/attendance.model';
import { EventsService } from '../events.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { GroupsService } from '../../groups/groups.service';
import { Group } from '../../../core/models/group.model';
import { Member } from '../../../core/models/member.model';
import { IconComponent } from '../../../shared/icon/icon.component';
import { AccessService } from '../../../core/access/access.service';
import { canEditEvent, canRecordAttendance, canSeeEvent, canSeeEventResponses, isEventAudience } from '../../../core/access/access.utils';
import { ActualAttendanceService } from '../../attendance/actual-attendance.service';
import { ActualAttendance } from '../../attendance/models/actual-attendance.model';
import { hasEventStarted } from '../../attendance/utils/actual-attendance.utils';

const EVENT_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Zkouška',
  performance: 'Vystoupení',
  camp: 'Soustředění',
  meeting: 'Schůzka',
  other: 'Jiné',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  yes: 'Přijdu',
  no: 'Nepřijdu',
  maybe: 'Možná',
  pending: 'Nezadáno',
};

import { isSoftDeadlinePassed, needsResponse } from '../utils/event-reminders';
@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, IconComponent],
  templateUrl: './event-detail.component.html',
  styles: [`.detail__deadline { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--spacing-sm); } .detail__deadline--due { color: var(--color-primary); font-weight: 600; }`],
})
export class EventDetailComponent implements OnInit {
  event = signal<AppEvent | null>(null);
  record = signal<AttendanceRecord | undefined>(undefined);
  eventRecords = signal<AttendanceRecord[]>([]);
  allMembers = signal<Member[]>([]);
  noteOpen = signal(false);
  noteValue = signal('');
  loading = signal(true);
  notFound = signal(false);
  currentMemberId = signal<number | null>(null);
  targetGroups = signal<Group[]>([]);

  readonly statuses: AttendanceStatus[] = ['yes', 'no', 'maybe'];
  // Na mobilu (bez hoveru) se poznámka rozbalí kliknutím na jméno
  openNoteMemberId = signal<number | null>(null);

  // Poznámky k účasti vidí všichni, kdo akci vidí
  noteFor = (memberId: number): string | undefined =>
    this.eventRecords().find((r) => r.memberId === memberId)?.note;

  toggleNote(memberId: number): void {
    this.openNoteMemberId.update((current) => (current === memberId ? null : memberId));
  }
  readonly statusLabels = STATUS_LABELS;

  readonly visibleMembers = computed(() => {
    const event = this.event();
    if (!event) return [];
    return this.allMembers().filter((m) => isEventAudience(m, event));
  });

  // Měkká uzávěrka a aktivní výzva (docs/07 kap. 18)
  readonly needsMyResponse = computed(() => {
    const event = this.event();
    return !!event && needsResponse(event, this.record()?.status ?? 'pending');
  });
  readonly deadlineText = computed(() => {
    const event = this.event();
    if (!event?.responseDeadline || new Date(event.startsAt) < new Date()) return '';
    const date = new Date(event.responseDeadline).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    return isSoftDeadlinePassed(event) ? `Termín definitivní odpovědi (${date}) uplynul – odpověď lze stále změnit.` : `Odpovězte prosím definitivně (Přijdu / Nepřijdu) do ${date}.`;
  });

  // Členové rozdělení podle stavu účasti – chybějící záznam se počítá jako "pending"
  readonly membersByStatus = computed(() => {
    const records = this.eventRecords();
    const byStatus: Record<AttendanceStatus, Member[]> = { yes: [], no: [], maybe: [], pending: [] };
    for (const member of this.visibleMembers()) {
      const record = records.find((r) => r.memberId === member.id);
      const status: AttendanceStatus = record?.status ?? 'pending';
      byStatus[status].push(member);
    }
    return byStatus;
  });

  readonly attendanceSummary = computed(() => {
    const byStatus = this.membersByStatus();
    return {
      yes: byStatus.yes.length,
      no: byStatus.no.length,
      maybe: byStatus.maybe.length,
      pending: byStatus.pending.length,
    };
  });

  // Kdo si akci alespoň zobrazil (bez ohledu na to, jestli už vyjádřil účast) – jen pro admina
  readonly viewedStatus = computed(() => {
    const records = this.eventRecords();
    const viewed: Member[] = [];
    const notViewed: Member[] = [];
    for (const member of this.visibleMembers()) {
      const record = records.find((r) => r.memberId === member.id);
      (record?.firstViewedAt ? viewed : notViewed).push(member);
    }
    return { viewed, notViewed };
  });

  // Skutečná docházka – zapisuje výbor/admin od začátku akce, nahlášenou účast nemění
  private actualAttendanceService = inject(ActualAttendanceService);
  private destroyRef = inject(DestroyRef);
  actualRecords = signal<ActualAttendance[]>([]);

  private access = inject(AccessService);

  readonly canRecordActual = computed(() => {
    const event = this.event();
    return !!event && canRecordAttendance(this.access.subject(), event) && hasEventStarted(event);
  });

  readonly canEdit = computed(() => {
    const event = this.event();
    return !!event && canEditEvent(this.access.subject(), event);
  });

  // Počty odpovědí a kdo akci viděl – organizátor a evidence docházky
  readonly canSeeResponses = computed(() => {
    const event = this.event();
    return !!event && canSeeEventResponses(this.access.subject(), event);
  });

  // Účast potvrzuje ten, komu je akce určena (organizátor mimo cílové skupiny ne)
  readonly isAudience = computed(() => {
    const event = this.event();
    const member = this.access.currentMember();
    return !!event && !!member && isEventAudience(member, event);
  });

  readonly organizerGroups = computed(() => this.groupNames(this.event()?.organizerGroupIds));
  readonly guests = computed(() =>
    (this.event()?.guestMemberIds ?? []).map((id) => this.allMembers().find((m) => m.id === id)).filter((m): m is Member => !!m),
  );

  private groupNames(ids: number[] | undefined): Group[] {
    return this.groupsService.groups().filter((g) => ids?.includes(g.id));
  }

  // Očekávaní členové s nahlášenou účastí a skutečnou přítomností (null = nezkontrolováno)
  readonly actualRows = computed(() => {
    const rsvp = this.eventRecords();
    const actual = this.actualRecords();
    return this.visibleMembers().map((member) => ({
      member,
      rsvp: rsvp.find((r) => r.memberId === member.id)?.status ?? ('pending' as AttendanceStatus),
      present: actual.find((r) => r.memberId === member.id)?.present ?? null,
    }));
  });

  readonly actualSummary = computed(() => {
    const rows = this.actualRows();
    return {
      present: rows.filter((r) => r.present === true).length,
      absent: rows.filter((r) => r.present === false).length,
      unchecked: rows.filter((r) => r.present === null).length,
    };
  });

  constructor(
    private route: ActivatedRoute,
    private eventsService: EventsService,
    private attendanceService: AttendanceService,
    private auth: AuthService,
    private membersService: MembersService,
    private groupsService: GroupsService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.membersService.getMembers().subscribe((members) => {
      this.allMembers.set(members);
      const member = members.find((m) => m.userId === user.id);
      if (!member) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }

      this.currentMemberId.set(member.id);
      const id = Number(this.route.snapshot.paramMap.get('id'));
      this.eventsService.getEvent(id).subscribe((event) => {
        // Bez oprávnění akci vidět se tváří jako neexistující (i při přímé URL)
        if (!event || !canSeeEvent(this.access.subject(), event)) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }
        this.event.set(event);

        this.loadTargetGroups(event.targetGroupIds);
        if (this.canRecordActual()) {
          this.actualAttendanceService.getForEvent(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((records) => this.actualRecords.set(records));
        }
        if (isEventAudience(member, event)) this.attendanceService.markViewed(id, member.id).subscribe();
        this.attendanceService.getAttendance(id).subscribe((records) => {
          this.eventRecords.set(records);
          const r = records.find((r) => r.memberId === member.id);
          this.record.set(r);
          this.noteValue.set(r?.note ?? '');
          this.loading.set(false);
        });
      });
    });
  }

  private patchOwnRecord(record: AttendanceRecord): void {
    this.record.set(record);
    this.eventRecords.update((records) => [
      ...records.filter((r) => r.memberId !== record.memberId),
      record,
    ]);
  }

  private loadTargetGroups(groupIds: number[]): void {
    this.targetGroups.set(this.groupNames(groupIds));
  }

  typeLabel(type: string): string {
    return EVENT_TYPE_LABELS[type] ?? type;
  }

  statusLabel(status: AttendanceStatus | undefined): string {
    return status ? STATUS_LABELS[status] : STATUS_LABELS['pending'];
  }

  setStatus(status: AttendanceStatus): void {
    const event = this.event();
    const memberId = this.currentMemberId();
    if (!event || !memberId) return;
    const updated: AttendanceRecord = {
      eventId: event.id,
      memberId,
      status,
      note: this.noteValue() || undefined,
    };
    this.attendanceService.updateAttendance(updated).subscribe(() => this.patchOwnRecord(updated));
  }

  clearStatus(): void {
    const event = this.event();
    const memberId = this.currentMemberId();
    if (!event || !memberId) return;
    const cleared: AttendanceRecord = { eventId: event.id, memberId, status: 'pending' };
    this.attendanceService.updateAttendance(cleared).subscribe(() => {
      this.patchOwnRecord(cleared);
      this.noteValue.set('');
      this.noteOpen.set(false);
    });
  }

  saveNote(note: string): void {
    const event = this.event();
    const memberId = this.currentMemberId();
    if (!event || !memberId) return;
    const updated: AttendanceRecord = {
      eventId: event.id,
      memberId,
      status: this.record()?.status ?? 'pending',
      note: note.trim() || undefined,
    };
    this.attendanceService.updateAttendance(updated).subscribe(() => {
      this.patchOwnRecord(updated);
      this.noteValue.set(note.trim());
      this.noteOpen.set(false);
    });
  }

  // Opětovné klepnutí na už zvolený stav záznam zruší (oprava omylu)
  markActual(memberId: number, present: boolean): void {
    const event = this.event();
    const recorderId = this.currentMemberId();
    if (!event || !recorderId) return;
    const current = this.actualRecords().find((r) => r.memberId === memberId);
    if (current?.present === present) {
      this.actualAttendanceService.clear(event.id, memberId).subscribe();
    } else {
      this.actualAttendanceService.mark(event.id, memberId, present, recorderId).subscribe();
    }
  }

  markRestAbsent(): void {
    const event = this.event();
    const recorderId = this.currentMemberId();
    if (!event || !recorderId) return;
    const unchecked = this.actualRows().filter((r) => r.present === null).map((r) => r.member.id);
    if (!unchecked.length) return;
    this.actualAttendanceService.markMany(event.id, unchecked, false, recorderId).subscribe();
  }
}
