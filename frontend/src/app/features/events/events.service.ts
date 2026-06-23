import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AppEvent } from './models/event.model';
import { MOCK_EVENTS } from './data/mock-events';

@Injectable({ providedIn: 'root' })
export class EventsService {
  getEvents(): Observable<AppEvent[]> {
    return of([...MOCK_EVENTS]).pipe(delay(300));
  }

  getEvent(id: number): Observable<AppEvent | undefined> {
    return of(MOCK_EVENTS.find((e) => e.id === id)).pipe(delay(300));
  }
}
