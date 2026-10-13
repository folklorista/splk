import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { AttendanceRecord, AttendanceStatus } from './models/attendance.model';
import { MOCK_ATTENDANCE } from './data/mock-attendance';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private recordsSubject = new BehaviorSubject<AttendanceRecord[]>([...MOCK_ATTENDANCE]);

  readonly records$ = this.recordsSubject.asObservable();

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

  // Zaznamená první otevření detailu akce daným členem, beze změny stavu účasti
  markViewed(eventId: number, memberId: number): Observable<void> {
    const records = this.recordsSubject.value;
    const index = records.findIndex((r) => r.eventId === eventId && r.memberId === memberId);
    if (index !== -1 && records[index].firstViewedAt) {
      return of(undefined).pipe(delay(300));
    }

    const updated = [...records];
    if (index !== -1) {
      updated[index] = { ...updated[index], firstViewedAt: new Date().toISOString() };
    } else {
      updated.push({ eventId, memberId, status: 'pending', firstViewedAt: new Date().toISOString() });
    }
    this.recordsSubject.next(updated);
    return of(undefined).pipe(delay(300));
  }

  // Rychlá změna stavu (přehled, kalendář) – poznámka a firstViewedAt zůstávají zachované
  setStatus(eventId: number, memberId: number, status: AttendanceStatus): Observable<AttendanceRecord> {
    const existing = this.recordsSubject.value.find((r) => r.eventId === eventId && r.memberId === memberId);
    return this.updateAttendance({ ...(existing ?? { eventId, memberId }), status });
  }

  updateAttendance(record: AttendanceRecord): Observable<AttendanceRecord> {
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
