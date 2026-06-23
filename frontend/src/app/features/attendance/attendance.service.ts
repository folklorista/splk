import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { AttendanceRecord } from './models/attendance.model';
import { MOCK_ATTENDANCE } from './data/mock-attendance';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private records: AttendanceRecord[] = [...MOCK_ATTENDANCE];

  getAttendance(eventId: number): Observable<AttendanceRecord[]> {
    return of(this.records.filter((r) => r.eventId === eventId)).pipe(delay(300));
  }

  getMemberAttendance(memberId: number): Observable<AttendanceRecord[]> {
    return of(this.records.filter((r) => r.memberId === memberId)).pipe(delay(300));
  }

  updateAttendance(record: AttendanceRecord): Observable<AttendanceRecord> {
    const index = this.records.findIndex(
      (r) => r.eventId === record.eventId && r.memberId === record.memberId,
    );
    if (index !== -1) {
      this.records[index] = { ...record };
    } else {
      this.records.push({ ...record });
    }
    return of({ ...record }).pipe(delay(300));
  }
}
