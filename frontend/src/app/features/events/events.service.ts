import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { AppEvent } from './models/event.model';
import { MOCK_EVENTS } from './data/mock-events';
import { MOCK_ATTENDANCE } from '../attendance/data/mock-attendance';

const createInitialCache = (): AppEvent[] =>
  MOCK_EVENTS.map(event => ({
    ...event,
    attendance: MOCK_ATTENDANCE.filter(a => a.eventId === event.id).map(a => ({ eventId: a.eventId, memberId: a.memberId, status: a.status, note: a.note })),
  }));

@Injectable({ providedIn: 'root' })
export class EventsService {
  private eventsSubject = new BehaviorSubject<AppEvent[]>(createInitialCache());

  getEvents(): Observable<AppEvent[]> {
    return this.eventsSubject.asObservable().pipe(delay(300));
  }

  getEvent(id: number): Observable<AppEvent | undefined> {
    return this.eventsSubject.pipe(
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
