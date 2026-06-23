import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AppEvent } from './models/event.model';
import { MOCK_EVENTS } from './data/mock-events';

let eventsCache = [...MOCK_EVENTS];

@Injectable({ providedIn: 'root' })
export class EventsService {
  getEvents(): Observable<AppEvent[]> {
    return of([...eventsCache]).pipe(delay(300));
  }

  getEvent(id: number): Observable<AppEvent | undefined> {
    return of(eventsCache.find((e) => e.id === id)).pipe(delay(300));
  }

  createEvent(event: Omit<AppEvent, 'id'>): Observable<AppEvent> {
    const newId = Math.max(...eventsCache.map((e) => e.id), 0) + 1;
    const newEvent: AppEvent = { ...event, id: newId };
    eventsCache.push(newEvent);
    return of(newEvent).pipe(delay(300));
  }

  updateEvent(id: number, event: Omit<AppEvent, 'id'>): Observable<AppEvent | undefined> {
    const index = eventsCache.findIndex((e) => e.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    const updated: AppEvent = { ...event, id };
    eventsCache[index] = updated;
    return of(updated).pipe(delay(300));
  }

  deleteEvent(id: number): Observable<boolean> {
    const index = eventsCache.findIndex((e) => e.id === id);
    if (index === -1) {
      return of(false).pipe(delay(300));
    }
    eventsCache.splice(index, 1);
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    eventsCache = [...MOCK_EVENTS];
  }
}
