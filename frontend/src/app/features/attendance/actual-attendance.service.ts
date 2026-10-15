import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { ActualAttendance } from './models/actual-attendance.model';
import { MOCK_ACTUAL_ATTENDANCE } from './data/mock-actual-attendance';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

// Skutečná docházka (kdo opravdu přišel). Nahlášenou účast (AttendanceService) nikdy nemění.
@Injectable({ providedIn: 'root' })
export class ActualAttendanceService {
  private recordsSubject = new BehaviorSubject<ActualAttendance[]>(
    loadDemoData('actual-attendance', () => [...MOCK_ACTUAL_ATTENDANCE]),
  );

  readonly records$ = this.recordsSubject.asObservable();

  constructor() {
    this.recordsSubject.subscribe((records) => saveDemoData('actual-attendance', records));
  }

  getAll(): Observable<ActualAttendance[]> {
    return this.records$.pipe(delay(300));
  }

  getForEvent(eventId: number): Observable<ActualAttendance[]> {
    return this.records$.pipe(
      delay(300),
      map((records) => records.filter((r) => r.eventId === eventId)),
    );
  }

  // Zapíše (nebo opraví) přítomnost jednoho člena
  mark(eventId: number, memberId: number, present: boolean, recordedByMemberId: number): Observable<ActualAttendance> {
    const [record] = this.upsert(eventId, [memberId], present, recordedByMemberId);
    return of({ ...record }).pipe(delay(300));
  }

  // Hromadný zápis – např. „Ostatní nepřítomni“
  markMany(eventId: number, memberIds: number[], present: boolean, recordedByMemberId: number): Observable<ActualAttendance[]> {
    const records = this.upsert(eventId, memberIds, present, recordedByMemberId);
    return of(records.map((r) => ({ ...r }))).pipe(delay(300));
  }

  // Smaže záznam – člen je znovu „nezkontrolovaný“
  clear(eventId: number, memberId: number): Observable<void> {
    this.recordsSubject.next(
      this.recordsSubject.value.filter((r) => !(r.eventId === eventId && r.memberId === memberId)),
    );
    return of(undefined).pipe(delay(300));
  }

  private upsert(eventId: number, memberIds: number[], present: boolean, recordedByMemberId: number): ActualAttendance[] {
    const recordedAt = new Date().toISOString();
    const created = memberIds.map((memberId): ActualAttendance => ({ eventId, memberId, present, recordedByMemberId, recordedAt }));
    const ids = new Set(memberIds);
    this.recordsSubject.next([
      ...this.recordsSubject.value.filter((r) => !(r.eventId === eventId && ids.has(r.memberId))),
      ...created,
    ]);
    return created;
  }
}
