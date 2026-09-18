import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { AppEvent } from './models/event.model';
import { MOCK_EVENTS } from './data/mock-events';
import { AttendanceService } from '../attendance/attendance.service';

const createInitialCache = (): AppEvent[] => MOCK_EVENTS.map(event => ({ ...event }));

@Injectable({ providedIn: 'root' })
export class EventsService {
  private eventsSubject = new BehaviorSubject<AppEvent[]>(createInitialCache());
  private readonly eventsWithAttendance$: Observable<AppEvent[]>;

  constructor(private attendanceService: AttendanceService) {
    this.eventsWithAttendance$ = combineLatest([
      this.eventsSubject,
      this.attendanceService.records$,
    ]).pipe(
      map(([events, records]) =>
        events.map(event => ({
          ...event,
          attendance: records.filter(r => r.eventId === event.id),
        })),
      ),
    );
  }

  getEvents(): Observable<AppEvent[]> {
    return this.eventsWithAttendance$.pipe(delay(300));
  }

  getEvent(id: number): Observable<AppEvent | undefined> {
    return this.eventsWithAttendance$.pipe(
      delay(300),
      map(events => events.find(e => e.id === id)),
    );
  }

  createEvent(event: Omit<AppEvent, 'id'>): Observable<AppEvent> {
    const newId = Math.max(...this.eventsSubject.value.map((e) => e.id), 0) + 1;
    const newEvent: AppEvent = { ...event, id: newId };
    const updated = [...this.eventsSubject.value, newEvent];
    this.eventsSubject.next(updated);
    return of(newEvent).pipe(delay(300));
  }

  updateEvent(id: number, event: Omit<AppEvent, 'id'>): Observable<AppEvent | undefined> {
    const current = this.eventsSubject.value;
    const index = current.findIndex((e) => e.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    const updated: AppEvent = { ...event, id };
    const newEvents = [...current];
    newEvents[index] = updated;
    this.eventsSubject.next(newEvents);
    return of(updated).pipe(delay(300));
  }

  deleteEvent(id: number): Observable<boolean> {
    const current = this.eventsSubject.value;
    const index = current.findIndex((e) => e.id === id);
    if (index === -1) {
      return of(false).pipe(delay(300));
    }
    const newEvents = current.filter((_, i) => i !== index);
    this.eventsSubject.next(newEvents);
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    this.eventsSubject.next(createInitialCache());
  }
}
