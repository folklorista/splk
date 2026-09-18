import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { EventsService } from '../../../../features/events/events.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { MembersService } from '../../../../features/members/members.service';
import { AttendanceService } from '../../../../features/attendance/attendance.service';
import { AppEvent, EventType } from '../../../../features/events/models/event.model';
import { AttendanceRecord, AttendanceStatus } from '../../../../features/attendance/models/attendance.model';
import { Member } from '../../../../core/models/member.model';
import { isItemVisibleToUser } from '../../../../core/utils/visibility.utils';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  yes: 'Přijde',
  no: 'Nepřijde',
  maybe: 'Možná',
  pending: 'Nezadáno',
};

@Component({
  selector: 'app-admin-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RelativeTimePipe],
  template: `
    <div class="admin-event-form">
      <div class="admin-event-form__header">
        <h2>{{ isEditMode ? 'Upravit akci' : 'Nová akce' }}</h2>
        <a [routerLink]="'/app/admin/events'" class="admin-event-form__back-link">← Zpět na seznam</a>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="admin-event-form__form">
        <div class="admin-event-form__field">
          <label for="title">Název *</label>
          <input id="title" type="text" formControlName="title" placeholder="Název akce" required />
          @if (form.get('title')?.invalid && form.get('title')?.touched) {
            <span class="admin-event-form__error">Název je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="type">Typ *</label>
          <select id="type" formControlName="type" required>
            <option value="">-- Vyberte typ --</option>
            <option value="rehearsal">Zkouška</option>
            <option value="performance">Vystoupení</option>
            <option value="camp">Soustředění</option>
            <option value="meeting">Schůzka</option>
            <option value="other">Jiné</option>
          </select>
          @if (form.get('type')?.invalid && form.get('type')?.touched) {
            <span class="admin-event-form__error">Typ je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="startsAt">Začátek *</label>
          <input id="startsAt" type="datetime-local" formControlName="startsAt" required />
          @if (form.get('startsAt')?.invalid && form.get('startsAt')?.touched) {
            <span class="admin-event-form__error">Čas začátku je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="endsAt">Konec *</label>
          <input id="endsAt" type="datetime-local" formControlName="endsAt" required />
          @if (form.get('endsAt')?.invalid && form.get('endsAt')?.touched) {
            <span class="admin-event-form__error">Čas konce je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="location">Místo *</label>
          <input id="location" type="text" formControlName="location" placeholder="Místo konání" required />
          @if (form.get('location')?.invalid && form.get('location')?.touched) {
            <span class="admin-event-form__error">Místo je povinné</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="description">Popis</label>
          <textarea id="description" formControlName="description" placeholder="Popis akce" rows="4"></textarea>
        </div>

        @if (isEditMode) {
          <div class="admin-event-form__field">
            <label>Účast</label>
            <p class="admin-event-form__hint">Změny stavu se uloží až po kliknutí na „Uložit“.</p>
            @if (attendanceMembers().length === 0) {
              <p class="admin-event-form__empty">Žádní členové nemají na tuto akci přístup.</p>
            } @else {
              <table class="admin-event-form__attendance-table">
                <thead>
                  <tr>
                    <th>Člen</th>
                    <th>Stav účasti</th>
                    <th>Poznámka</th>
                    <th>Poprvé zobrazeno</th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of attendanceMembers(); track member.id) {
                    <tr>
                      <td>{{ member.name }}</td>
                      <td>
                        <select
                          [value]="pendingStatuses().get(member.id)"
                          (change)="setMemberStatus(member.id, $any($event.target).value)"
                        >
                          @for (status of statuses; track status) {
                            <option [value]="status">{{ statusLabels[status] }}</option>
                          }
                        </select>
                      </td>
                      <td>
                        @if (noteByMember().get(member.id); as note) {
                          {{ note }}
                        } @else {
                          <span class="admin-event-form__empty">—</span>
                        }
                      </td>
                      <td>
                        @if (viewedAtByMember().get(member.id); as viewedAt) {
                          {{ viewedAt | relativeTime }}
                        } @else {
                          <span class="admin-event-form__empty">Nezobrazeno</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }

        <div class="admin-event-form__actions">
          <button type="submit" class="admin-event-form__btn-primary" [disabled]="form.invalid || isSubmitting">
            {{ isSubmitting ? 'Ukládám...' : (isEditMode ? 'Uložit' : 'Vytvořit') }}
          </button>
          <a [routerLink]="'/app/admin/events'" class="admin-event-form__btn-secondary">Zrušit</a>
        </div>

        @if (submitError) {
          <div class="admin-event-form__error-message">{{ submitError }}</div>
        }
      </form>
    </div>
  `,
  styles: [`
    .admin-event-form { max-width: 600px; margin: 0 auto; }
    .admin-event-form__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
    .admin-event-form__header h2 { margin: 0; font-size: 1.25rem; }
    .admin-event-form__back-link { font-size: 0.9rem; color: #0066cc; text-decoration: none; }
    .admin-event-form__back-link:hover { text-decoration: underline; }
    .admin-event-form__form { display: flex; flex-direction: column; gap: 1.5rem; }
    .admin-event-form__field { display: flex; flex-direction: column; gap: 0.5rem; }
    .admin-event-form__field label { font-weight: 500; color: #333; font-size: 0.95rem; }
    .admin-event-form__field input[type="text"],
    .admin-event-form__field input[type="datetime-local"],
    .admin-event-form__field select,
    .admin-event-form__field textarea { padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; font-family: inherit; outline: none; }
    .admin-event-form__field input:focus,
    .admin-event-form__field select:focus,
    .admin-event-form__field textarea:focus { border-color: #0066cc; }
    .admin-event-form__error { font-size: 0.85rem; color: #d32f2f; }
    .admin-event-form__actions { display: flex; gap: 1rem; margin-top: 1rem; }
    .admin-event-form__btn-primary,
    .admin-event-form__btn-secondary { padding: 0.75rem 1.5rem; border-radius: 4px; font-size: 0.95rem; font-weight: 500; border: none; cursor: pointer; }
    .admin-event-form__btn-primary { background: #0066cc; color: #fff; }
    .admin-event-form__btn-primary:hover:not(:disabled) { background: #0052a3; }
    .admin-event-form__btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .admin-event-form__btn-secondary { background: #f0f0f0; color: #333; text-decoration: none; display: inline-block; text-align: center; }
    .admin-event-form__btn-secondary:hover { background: #e0e0e0; }
    .admin-event-form__error-message { padding: 0.75rem; background: #ffebee; color: #d32f2f; border-radius: 4px; border-left: 4px solid #d32f2f; }
    .admin-event-form__hint { color: #999; font-size: 0.85rem; margin: 0; }
    .admin-event-form__empty { color: #999; font-style: italic; margin: 0; }
    .admin-event-form__attendance-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .admin-event-form__attendance-table th { text-align: left; padding: 0.5rem; border-bottom: 2px solid #ddd; color: #666; font-weight: 600; }
    .admin-event-form__attendance-table td { padding: 0.5rem; border-bottom: 1px solid #eee; }
    .admin-event-form__attendance-table select { padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
  `],
})
export class AdminEventFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  readonly statuses: AttendanceStatus[] = ['pending', 'yes', 'no', 'maybe'];
  readonly statusLabels = STATUS_LABELS;
  private allEventMembers = signal<Member[]>([]);
  pendingStatuses = signal<Map<number, AttendanceStatus>>(new Map());
  viewedAtByMember = signal<Map<number, string | undefined>>(new Map());
  noteByMember = signal<Map<number, string | undefined>>(new Map());
  readonly attendanceMembers = () => this.allEventMembers();
  private originalStatuses = new Map<number, AttendanceStatus>();
  private originalRecords = new Map<number, AttendanceRecord>();
  private eventId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private eventsService: EventsService,
    private authService: AuthService,
    private membersService: MembersService,
    private attendanceService: AttendanceService,
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      type: ['', Validators.required],
      startsAt: ['', Validators.required],
      endsAt: ['', Validators.required],
      location: ['', Validators.required],
      description: [''],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.eventId = parseInt(idParam, 10);
      this.loadEvent(this.eventId);
    }
  }

  setMemberStatus(memberId: number, status: AttendanceStatus): void {
    this.pendingStatuses.update((map) => {
      const next = new Map(map);
      next.set(memberId, status);
      return next;
    });
  }

  private loadEvent(id: number): void {
    this.eventsService.getEvent(id).subscribe({
      next: (event) => {
        if (event) {
          this.form.patchValue({
            title: event.title,
            type: event.type,
            startsAt: event.startsAt.substring(0, 16),
            endsAt: event.endsAt.substring(0, 16),
            location: event.location,
            description: event.description || '',
          });
          this.loadAttendance(id, event.targetGroupIds);
        }
      },
    });
  }

  private loadAttendance(eventId: number, targetGroupIds: number[]): void {
    this.membersService.getMembers().subscribe((members) => {
      const visible = members.filter((m) => isItemVisibleToUser(targetGroupIds, m.groupIds));
      this.allEventMembers.set(visible);

      this.attendanceService.getAttendance(eventId).subscribe((records) => {
        const statuses = new Map<number, AttendanceStatus>();
        const viewedAt = new Map<number, string | undefined>();
        const notes = new Map<number, string | undefined>();
        const recordsByMember = new Map<number, AttendanceRecord>();

        for (const member of visible) {
          const record = records.find((r) => r.memberId === member.id);
          statuses.set(member.id, record?.status ?? 'pending');
          viewedAt.set(member.id, record?.firstViewedAt);
          notes.set(member.id, record?.note);
          if (record) recordsByMember.set(member.id, record);
        }

        this.originalStatuses = new Map(statuses);
        this.originalRecords = recordsByMember;
        this.pendingStatuses.set(statuses);
        this.viewedAtByMember.set(viewedAt);
        this.noteByMember.set(notes);
      });
    });
  }

  private saveAttendanceChanges(): Observable<unknown> {
    if (this.eventId === null) return of(null);
    const eventId = this.eventId;
    const pending = this.pendingStatuses();

    const changedMemberIds = [...pending.entries()]
      .filter(([memberId, status]) => this.originalStatuses.get(memberId) !== status)
      .map(([memberId]) => memberId);
    if (changedMemberIds.length === 0) return of(null);

    const updates = changedMemberIds.map((memberId) => {
      const existing = this.originalRecords.get(memberId);
      const record: AttendanceRecord = {
        eventId,
        memberId,
        status: pending.get(memberId)!,
        note: existing?.note,
        firstViewedAt: existing?.firstViewedAt,
      };
      return this.attendanceService.updateAttendance(record);
    });
    return forkJoin(updates);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const formValue = this.form.value;
    const eventData: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: formValue.title,
      type: formValue.type as EventType,
      startsAt: formValue.startsAt,
      endsAt: formValue.endsAt,
      location: formValue.location,
      description: formValue.description || undefined,
      targetGroupIds: [],
    };

    if (this.isEditMode && this.eventId !== null) {
      this.eventsService.updateEvent(this.eventId, eventData).subscribe({
        next: () => {
          this.saveAttendanceChanges().subscribe({
            next: () => this.router.navigate(['/app/admin/events']),
            error: () => {
              this.isSubmitting = false;
              this.submitError = 'Akce byla uložena, ale nepodařilo se uložit účast';
            },
          });
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se uložit akci';
        },
      });
    } else {
      this.eventsService.createEvent(eventData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/events']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se vytvořit akci';
        },
      });
    }
  }
}
