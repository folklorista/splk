import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { AttendanceRecord } from './models/attendance.model';
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
