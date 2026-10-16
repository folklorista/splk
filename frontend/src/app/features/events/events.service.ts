import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { AppEvent } from './models/event.model';
import { MOCK_EVENTS } from './data/mock-events';
import { AttendanceService } from '../attendance/attendance.service';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { canEditEvent, eventOrganizerScope } from '../../core/access/access.utils';
import { AuditService } from '../audit/audit.service';

// Neutrální popis podstatné změny akce pro členy (posun začátku, místo, název) – jde i do chatu skupin
export function describeEventChange(before: Omit<AppEvent, 'id'>, after: Omit<AppEvent, 'id'>): string | null {
  const changes: string[] = [];
  const time = (iso: string) => `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(11, 16)}`;
  if (before.startsAt.slice(0, 16) !== after.startsAt.slice(0, 16)) changes.push(`začátek ${time(before.startsAt)} → ${time(after.startsAt)}`);
  else if (before.endsAt.slice(0, 16) !== after.endsAt.slice(0, 16)) changes.push(`konec ${time(after.endsAt)}`);
  if (before.location !== after.location) changes.push(`místo: ${after.location}`);
  if (before.title !== after.title) changes.push(`nový název „${after.title}“`);
  return changes.length ? changes.join(', ') : null;
}

const eventGroupIds = (event: Pick<AppEvent, 'targetGroupIds' | 'organizerGroupIds'>) => [
  ...new Set([...(event.targetGroupIds ?? []), ...(event.organizerGroupIds ?? [])]),
];

const createInitialCache = (): AppEvent[] => MOCK_EVENTS.map(event => ({ ...event }));

@Injectable({ providedIn: 'root' })
export class EventsService {
  private eventsSubject = new BehaviorSubject<AppEvent[]>(loadDemoData('events', createInitialCache));
  private readonly eventsWithAttendance$: Observable<AppEvent[]>;

  constructor(
    private attendanceService: AttendanceService,
    private access: AccessService,
    private audit: AuditService,
  ) {
    // Účast se ukládá zvlášť (AttendanceService), k akcím se jen připojuje
    this.eventsSubject.subscribe((events) => saveDemoData('events', events.map(({ attendance, ...event }) => event)));

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

  // Založit smí pověřený organizátor; s rozsahem jen na skupinu musí akci pořádat jeho skupina
  createEvent(event: Omit<AppEvent, 'id'>): Observable<AppEvent> {
    const scope = eventOrganizerScope(this.access.subject());
    const allowed = scope.ensembleWide || (event.organizerGroupIds ?? []).some((g) => scope.groupIds.includes(g));
    if (!allowed) return throwError(() => new AccessDeniedError('Akce zakládá pověřený organizátor.'));
    const newId = Math.max(...this.eventsSubject.value.map((e) => e.id), 0) + 1;
    const newEvent: AppEvent = { ...event, id: newId };
    const updated = [...this.eventsSubject.value, newEvent];
    this.eventsSubject.next(updated);
    this.audit.record({ action: 'event-created', actorId: this.access.memberId() ?? 0, eventId: newId, groupIds: eventGroupIds(newEvent) });
    return of(newEvent).pipe(delay(300));
  }

  updateEvent(id: number, event: Omit<AppEvent, 'id'>): Observable<AppEvent | undefined> {
    const current = this.eventsSubject.value;
    const index = current.findIndex((e) => e.id === id);
    if (index === -1) {
      return of(undefined).pipe(delay(300));
    }
    if (!canEditEvent(this.access.subject(), current[index])) {
      return throwError(() => new AccessDeniedError('Akci upravuje její pověřený organizátor.'));
    }
    const updated: AppEvent = { ...event, id };
    const change = describeEventChange(current[index], updated);
    if (change) {
      this.audit.record({
        action: 'event-updated',
        actorId: this.access.memberId() ?? 0,
        eventId: id,
        groupIds: eventGroupIds(updated),
        details: change,
      });
    }
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
    if (!canEditEvent(this.access.subject(), current[index])) {
      return throwError(() => new AccessDeniedError());
    }
    const newEvents = current.filter((_, i) => i !== index);
    this.eventsSubject.next(newEvents);
    return of(true).pipe(delay(300));
  }

  resetCache(): void {
    this.eventsSubject.next(createInitialCache());
  }
}
