import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { EventsService } from './events.service';
import { MOCK_EVENTS } from './data/mock-events';
import { AppEvent } from './models/event.model';
import { AttendanceService } from '../attendance/attendance.service';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { AuditService } from '../audit/audit.service';
import { createTestAccess, testMandate, testMember } from '../../testing/access.testing';

describe('EventsService', () => {
  let service: EventsService;
  let attendanceService: AttendanceService;
  let env: ReturnType<typeof createTestAccess>;

  beforeEach(() => {
    // Organizátor s pověřením pro celý soubor
    env = createTestAccess(testMember({ id: 1 }), { mandates: [testMandate(1, 'events')] });
    TestBed.configureTestingModule({ providers: [{ provide: AccessService, useValue: env.access }] });
    service = TestBed.inject(EventsService);
    attendanceService = TestBed.inject(AttendanceService);
    service.resetCache();
  });

  it('getEvents vrátí všechny akce', fakeAsync(() => {
    let result: unknown;
    service.getEvents().subscribe((events) => (result = events));
    tick(300);
    expect(Array.isArray(result)).toBeTrue();
    expect((result as unknown[]).length).toBe(MOCK_EVENTS.length);
  }));

  it('getEvents vrátí kopii pole, ne referenci na mock data', fakeAsync(() => {
    let result: unknown[];
    service.getEvents().subscribe((events) => (result = events));
    tick(300);
    expect(result!).not.toBe(MOCK_EVENTS);
  }));

  it('getEvent vrátí akci se správným id', fakeAsync(() => {
    let result: unknown;
    service.getEvent(2).subscribe((event) => (result = event));
    tick(300);
    expect((result as { id: number }).id).toBe(2);
  }));

  it('getEvent vrátí undefined pro neexistující id', fakeAsync(() => {
    let result: unknown = 'not-called';
    service.getEvent(9999).subscribe((event) => (result = event));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('getEvents obsahuje akce různých typů', fakeAsync(() => {
    let result: { type: string }[] = [];
    service.getEvents().subscribe((events) => (result = events));
    tick(300);
    const types = new Set(result.map((e) => e.type));
    expect(types.size).toBeGreaterThan(1);
  }));

  it('createEvent přidá novou akci', fakeAsync(() => {
    const newEvent: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: 'Nová akce',
      type: 'meeting',
      startsAt: '2026-07-01T18:00:00',
      endsAt: '2026-07-01T20:00:00',
      location: 'Sál',
      description: 'Popis',
      targetGroupIds: [],
    };
    let created: AppEvent | undefined;
    service.createEvent(newEvent).subscribe((e) => (created = e));
    tick(300);
    expect(created).toBeDefined();
    expect(created?.id).toBeGreaterThan(0);
    expect(created?.title).toBe('Nová akce');

    let allEvents: AppEvent[] = [];
    service.getEvents().subscribe((e) => (allEvents = e));
    tick(300);
    expect(allEvents.length).toBeGreaterThan(MOCK_EVENTS.length);
  }));

  it('updateEvent upraví existující akci', fakeAsync(() => {
    const updated: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: 'Upravená akce',
      type: 'rehearsal',
      startsAt: '2026-06-25T20:00:00',
      endsAt: '2026-06-25T22:00:00',
      location: 'Nová lokalita',
      targetGroupIds: [],
    };
    let result: AppEvent | undefined;
    service.updateEvent(1, updated).subscribe((e) => (result = e));
    tick(300);
    expect(result?.id).toBe(1);
    expect(result?.title).toBe('Upravená akce');
    expect(result?.location).toBe('Nová lokalita');
  }));

  it('updateEvent vrátí undefined pro neexistující id', fakeAsync(() => {
    const updated: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: 'Něco',
      type: 'meeting',
      startsAt: '2026-07-01T18:00:00',
      endsAt: '2026-07-01T20:00:00',
      location: 'Sál',
      targetGroupIds: [],
    };
    let result: AppEvent | undefined = {} as AppEvent;
    service.updateEvent(9999, updated).subscribe((e) => (result = e));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('deleteEvent odstraní akci', fakeAsync(() => {
    let deleted: boolean = false;
    service.deleteEvent(1).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeTrue();

    let events: AppEvent[] = [];
    service.getEvents().subscribe((e) => (events = e));
    tick(300);
    expect(events.find((e) => e.id === 1)).toBeUndefined();
  }));

  it('deleteEvent vrátí false pro neexistující id', fakeAsync(() => {
    let deleted: boolean = true;
    service.deleteEvent(9999).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeFalse();
  }));

  it('getEvent odráží aktuální stav účasti z AttendanceService', fakeAsync(() => {
    let before: AppEvent | undefined;
    service.getEvent(1).subscribe((e) => (before = e));
    tick(300);
    expect(before?.attendance?.find((a) => a.memberId === 1)?.status).toBe('yes');

    attendanceService.updateAttendance({ eventId: 1, memberId: 1, status: 'pending' }).subscribe();
    tick(300);

    let after: AppEvent | undefined;
    service.getEvent(1).subscribe((e) => (after = e));
    tick(300);
    expect(after?.attendance?.find((a) => a.memberId === 1)?.status).toBe('pending');
  }));

  it('bez pověření Organizace akcí akci nezaloží ani neupraví', fakeAsync(() => {
    env.mandates.set([]);
    const errors: unknown[] = [];
    const { id, ...data } = MOCK_EVENTS[0];
    service.createEvent(data).subscribe({ error: (e) => errors.push(e) });
    service.updateEvent(id, data).subscribe({ error: (e) => errors.push(e) });
    tick(300);
    expect(errors.length).toBe(2);
    expect(errors.every((e) => e instanceof AccessDeniedError)).toBeTrue();
  }));

  it('organizátor jen pro skupinu zakládá akce pořádané touto skupinou', fakeAsync(() => {
    env.mandates.set([testMandate(1, 'events', { groupId: 4 })]);
    const { id, ...data } = MOCK_EVENTS[0];
    let error: unknown;
    let created: AppEvent | undefined;
    service.createEvent({ ...data, organizerGroupIds: [5] }).subscribe({ error: (e) => (error = e) });
    service.createEvent({ ...data, organizerGroupIds: [4] }).subscribe((e) => (created = e));
    tick(300);
    expect(error).toEqual(jasmine.any(AccessDeniedError));
    expect(created?.organizerGroupIds).toEqual([4]);
  }));

  it('podstatná změna akce se zapíše do historie pro cílové skupiny (a tím do jejich chatu)', fakeAsync(() => {
    const event = MOCK_EVENTS.find((e) => e.targetGroupIds.length)!;
    const { id, ...data } = event;
    service.updateEvent(id, { ...data, startsAt: '2099-05-01T19:30:00', location: 'Náves' }).subscribe();
    tick(300);
    const entry = TestBed.inject(AuditService).entries().at(-1)!;
    expect(entry.action).toBe('event-updated');
    expect(entry.groupIds).toEqual(event.targetGroupIds);
    expect(entry.details).toContain('začátek');
    expect(entry.details).toContain('Náves');
  }));

  it('série: každý termín samostatná akce se stejným seriesId, vynechané s důvodem, jeden záznam historie', fakeAsync(() => {
    const audit = TestBed.inject(AuditService);
    const before = audit.entries().length;
    const { id, ...data } = MOCK_EVENTS[0];
    let created: AppEvent[] = [];
    service.createSeries({ ...data, title: 'Nácvik' }, [
      { startsAt: '2026-11-05T18:00', endsAt: '2026-11-05T20:00' },
      { startsAt: '2026-11-12T18:00', endsAt: '2026-11-12T20:00', skippedReason: 'Podzimní prázdniny' },
    ]).subscribe((e) => (created = e));
    tick(300);
    expect(created.length).toBe(2);
    expect(new Set(created.map((e) => e.seriesId)).size).toBe(1);
    expect(created[1].skippedReason).toBe('Podzimní prázdniny');
    expect(new Set(created.map((e) => e.id)).size).toBe(2);
    expect(audit.entries().length - before).toBe(1);
    expect(audit.entries().some((e) => e.action === 'series-created')).toBeTrue();

    env.mandates.set([]);
    let error: unknown;
    service.createSeries(data, [{ startsAt: '2026-11-05T18:00', endsAt: '2026-11-05T20:00' }]).subscribe({ error: (e) => (error = e) });
    expect(error).toEqual(jasmine.any(AccessDeniedError));
  }));
});
