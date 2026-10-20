import { Injectable, Injector, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { EventsService } from '../events/events.service';
import { AccessService } from '../../core/access/access.service';
import { RuleViolationError } from '../../core/access/mandate-rules';
import { isResponseClosed } from '../events/utils/event-reminders';
import { delay, map } from 'rxjs/operators';
import { AttendanceRecord, AttendanceStatus } from './models/attendance.model';
import { MOCK_ATTENDANCE } from './data/mock-attendance';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private recordsSubject = new BehaviorSubject<AttendanceRecord[]>(loadDemoData('attendance', () => [...MOCK_ATTENDANCE]));

  readonly records$ = this.recordsSubject.asObservable();

  private injector = inject(Injector);

  constructor() {
    this.recordsSubject.subscribe((records) => saveDemoData('attendance', records));
  }

  getAttendance(eventId: number): Observable<AttendanceRecord[]> {
    return this.records$.pipe(
      delay(300),
      map((records) => records.filter((r) => r.eventId === eventId)),
    );
  }

  getMemberAttendance(memberId: number): Observable<AttendanceRecord[]> {
    return this.records$.pipe(
      delay(300),
      map((records) => records.filter((r) => r.memberId === memberId)),
    );
  }

  // Otevření detailu akce: první a poslední zobrazení (jediný údaj osoba × akce), beze změny účasti.
  // Rychlá odpověď ze seznamu se sem nevolá – není to zobrazení detailu.
  // Odpověděla osoba někdy na akci? (samotné zobrazení detailu se nepočítá)
  hasResponses(memberId: number): boolean {
    return this.recordsSubject.value.some((r) => r.memberId === memberId && r.status !== 'pending');
  }

  markViewed(eventId: number, memberId: number, at = new Date().toISOString()): Observable<void> {
    this.patchRecord(eventId, memberId, (r) => ({ ...r, firstViewedAt: r.firstViewedAt ?? at, lastViewedAt: at }));
    return of(undefined).pipe(delay(300));
  }

  // Výslovné potvrzení důležité změny akce
  confirmImportantChange(eventId: number, memberId: number, at = new Date().toISOString()): Observable<void> {
    this.patchRecord(eventId, memberId, (r) => ({ ...r, confirmedAt: at, lastViewedAt: r.lastViewedAt && r.lastViewedAt > at ? r.lastViewedAt : at }));
    return of(undefined).pipe(delay(300));
  }

  private patchRecord(eventId: number, memberId: number, change: (record: AttendanceRecord) => AttendanceRecord): void {
    const records = this.recordsSubject.value;
    const index = records.findIndex((r) => r.eventId === eventId && r.memberId === memberId);
    const updated = [...records];
    if (index !== -1) updated[index] = change(updated[index]);
    else updated.push(change({ eventId, memberId, status: 'pending' }));
    this.recordsSubject.next(updated);
  }

  // Rychlá změna stavu (přehled, kalendář) – poznámka a firstViewedAt zůstávají zachované
  setStatus(eventId: number, memberId: number, status: AttendanceStatus): Observable<AttendanceRecord> {
    const existing = this.recordsSubject.value.find((r) => r.eventId === eventId && r.memberId === memberId);
    return this.updateAttendance({ ...(existing ?? { eventId, memberId }), status });
  }

  updateAttendance(record: AttendanceRecord): Observable<AttendanceRecord> {
    // Po skončení akce už člen svou odpověď nemění (kontrola jako na serveru, ne jen vypnutá tlačítka).
    // EventsService se bere líně – sám na AttendanceService závisí.
    const event = this.injector.get(EventsService).findEvent(record.eventId);
    if (event && record.memberId === this.injector.get(AccessService).memberId() && isResponseClosed(event)) {
      return throwError(() => new RuleViolationError('Akce už proběhla – odpověď ani poznámku nelze měnit.'));
    }
    const records = this.recordsSubject.value;
    const index = records.findIndex(
      (r) => r.eventId === record.eventId && r.memberId === record.memberId,
    );
    const updated = [...records];
    if (index !== -1) {
      updated[index] = { ...record };
    } else {
      updated.push({ ...record });
    }
    this.recordsSubject.next(updated);
    return of({ ...record }).pipe(delay(300));
  }
}
